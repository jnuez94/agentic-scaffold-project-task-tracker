"""Meta, doctor, summary, health, audit, and export routes."""

from __future__ import annotations

import unittest

from coordination_ui.api import TextResponse

from .route_case import RouteTestCase


class MetaTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_task("T-2", actor="alice")


class MetaTests(MetaTestCase):
    def test_reports_cli_and_schema_versions(self) -> None:
        meta = self.get("/api/meta")
        self.assertEqual(meta["cli_version"], "1.4.0")
        self.assertEqual(meta["schema_version"], 1)

    def test_includes_resolved_paths(self) -> None:
        meta = self.get("/api/meta")
        self.assertEqual(meta["database"], str(self.temp.database))
        self.assertEqual(meta["project_root"], str(self.temp.root))

    def test_includes_contract_enums(self) -> None:
        statuses = self.get("/api/meta")["statuses"]
        self.assertIn("in_progress", statuses["task"])
        self.assertIn("evidence_required", statuses["dependency"])

    def test_includes_the_transition_table(self) -> None:
        transitions = self.get("/api/meta")["transitions"]
        self.assertEqual(transitions["done"], [])
        self.assertIn("review", transitions["in_progress"])


class DoctorAndSummaryTests(MetaTestCase):
    def test_doctor_reports_a_healthy_database(self) -> None:
        doctor = self.get("/api/doctor")
        self.assertTrue(doctor["healthy"])
        self.assertEqual(doctor["integrity_check"], "ok")
        self.assertEqual(doctor["journal_mode"], "wal")

    def test_summary_is_the_cli_envelope(self) -> None:
        summary = self.get("/api/summary")
        self.assertEqual(summary["totals"]["tasks"], 2)
        self.assertEqual(summary["totals"]["agents"], 1)
        self.assertIn("audit_cursor", summary)

    def test_summary_includes_the_task_histogram(self) -> None:
        self.assertEqual(self.get("/api/summary")["task_status"]["todo"], 2)

    def test_summary_includes_workload(self) -> None:
        workload = self.get("/api/summary")["workload"]
        self.assertEqual(workload[0]["agent_id"], "alice")


class HealthTests(MetaTestCase):
    def test_flags_unowned_tasks(self) -> None:
        health = self.get("/api/health")
        self.assertFalse(health["healthy"])
        self.assertEqual(len(health["unowned_tasks"]), 2)

    def test_reports_every_documented_section(self) -> None:
        health = self.get("/api/health")
        for section in (
            "unowned_tasks",
            "stale_tasks",
            "stale_sessions",
            "unclaimed_in_progress_tasks",
            "invalid_active_claims",
            "active_blockers",
            "done_without_evidence",
            "open_escalations",
            "truncated_sections",
        ):
            with self.subTest(section=section):
                self.assertIn(section, health)

    def test_accepts_threshold_parameters(self) -> None:
        health = self.get("/api/health", stale_days="30", stale_session_minutes="120")
        self.assertEqual(health["stale_tasks"], [])

    def test_limit_truncation_is_reported(self) -> None:
        health = self.get("/api/health", limit="1")
        self.assertEqual(len(health["unowned_tasks"]), 1)
        self.assertIn("unowned_tasks", health["truncated_sections"])

    def test_a_healthy_project_reports_true(self) -> None:
        self.post(
            "/api/tasks/T-1/assign", {"actor": "alice", "if_revision": 1, "add": ["alice"]}
        )
        self.post(
            "/api/tasks/T-2/assign", {"actor": "alice", "if_revision": 1, "add": ["alice"]}
        )
        self.assertTrue(self.get("/api/health")["healthy"])


class AuditTests(MetaTestCase):
    """The audit route composes ``summary`` and ``audit list`` into the newest window."""

    def test_audit_is_a_bare_list_newest_first(self) -> None:
        ids = [row["id"] for row in self.get("/api/audit")]
        self.assertGreater(len(ids), 0)
        self.assertEqual(ids, sorted(ids, reverse=True))

    def test_audit_rows_carry_the_contract_columns(self) -> None:
        newest = self.get("/api/audit")[0]
        self.assertEqual(
            set(newest),
            {
                "id",
                "actor",
                "session_id",
                "action",
                "object_type",
                "object_id",
                "detail",
                "created_at",
            },
        )
        self.assertEqual(newest["object_id"], "T-2")

    def test_audit_limit_bounds_the_newest_window(self) -> None:
        everything = self.get("/api/audit")
        self.assertEqual(self.get("/api/audit", limit="2"), everything[:2])

    def test_audit_filters_by_object_id(self) -> None:
        rows = self.get("/api/audit", object_id="T-1")
        self.assertEqual([row["object_id"] for row in rows], ["T-1"])

    def test_audit_filters_reach_matches_older_than_the_window(self) -> None:
        # The newest audit id belongs to T-2. A filtered request still finds
        # T-1: the limit bounds matches, not audit ids, so a record's history
        # is complete however far back it sits.
        rows = self.get("/api/audit", object_id="T-1", limit="1")
        self.assertEqual([row["object_id"] for row in rows], ["T-1"])

    def test_audit_filters_by_actor(self) -> None:
        rows = self.get("/api/audit", actor="alice")
        self.assertGreater(len(rows), 0)
        self.assertEqual({row["actor"] for row in rows}, {"alice"})

    def test_audit_rejects_a_non_numeric_limit(self) -> None:
        from coordination_ui.cli import CoordinationError

        with self.assertRaises(CoordinationError):
            self.get("/api/audit", limit="lots")

    def test_audit_clamps_an_oversized_limit(self) -> None:
        # The CLI rejects --limit above 500; the route clamps rather than relays.
        self.assertGreater(len(self.get("/api/audit", limit="9999")), 0)

    def test_audit_before_pages_back_from_an_id(self) -> None:
        everything = self.get("/api/audit")
        older = self.get("/api/audit", before=str(everything[1]["id"]))
        self.assertEqual(older, everything[2:])

    def test_audit_rejects_a_non_positive_before(self) -> None:
        from coordination_ui.cli import CoordinationError

        with self.assertRaises(CoordinationError):
            self.get("/api/audit", before="0")

    def test_audit_can_exclude_heartbeats_and_keep_the_window_full(self) -> None:
        self.temp.seed_session("s-hb", "alice")
        for _ in range(3):
            self.temp.run("session", "heartbeat", "s-hb")
        everything = self.get("/api/audit")
        self.assertIn("heartbeat", {row["action"] for row in everything})

        quiet = self.get("/api/audit", exclude_action="heartbeat")
        self.assertNotIn("heartbeat", {row["action"] for row in quiet})
        self.assertIn("start", {row["action"] for row in quiet})
        self.assertEqual(len(quiet), len(everything) - 3)

    def test_audit_rejects_a_malformed_exclusion(self) -> None:
        from coordination_ui.cli import CoordinationError

        with self.assertRaises(CoordinationError):
            self.get("/api/audit", exclude_action="--actor")

    def test_audit_rejects_a_malformed_actor(self) -> None:
        from coordination_ui.cli import CoordinationError

        with self.assertRaises(CoordinationError):
            self.get("/api/audit", actor="--actor")


class ExportTests(MetaTestCase):
    def test_export_returns_markdown_not_json(self) -> None:
        response = self.get("/api/export")
        self.assertIsInstance(response, TextResponse)
        self.assertEqual(response.content_type, "text/markdown; charset=utf-8")
        self.assertIn("#", response.body)

    def test_export_mentions_seeded_tasks(self) -> None:
        self.assertIn("T-1", self.get("/api/export").body)


if __name__ == "__main__":
    unittest.main()
