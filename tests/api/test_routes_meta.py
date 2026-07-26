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
        self.assertEqual(meta["cli_version"], "1.2.0")
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

    def test_summary_reports_totals(self) -> None:
        summary = self.get("/api/summary")
        self.assertEqual(summary["totals"]["tasks"], 2)
        self.assertEqual(summary["totals"]["agents"], 1)

    def test_summary_includes_the_task_histogram(self) -> None:
        self.assertEqual(self.get("/api/summary")["task_status"], {"todo": 2})

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


class AuditAndExportTests(MetaTestCase):
    def test_audit_returns_entries_and_facets(self) -> None:
        audit = self.get("/api/audit")
        self.assertGreater(audit["total"], 0)
        self.assertIn("alice", audit["facets"]["actors"])

    def test_audit_filters_by_object_id(self) -> None:
        self.assertEqual(self.get("/api/audit", object_id="T-1")["total"], 1)

    def test_audit_rejects_a_non_numeric_limit(self) -> None:
        from coordination_ui.cli import CoordinationError

        with self.assertRaises(CoordinationError):
            self.get("/api/audit", limit="lots")

    def test_export_returns_markdown_not_json(self) -> None:
        response = self.get("/api/export")
        self.assertIsInstance(response, TextResponse)
        self.assertEqual(response.content_type, "text/markdown; charset=utf-8")
        self.assertIn("#", response.body)

    def test_export_mentions_seeded_tasks(self) -> None:
        self.assertIn("T-1", self.get("/api/export").body)


if __name__ == "__main__":
    unittest.main()
