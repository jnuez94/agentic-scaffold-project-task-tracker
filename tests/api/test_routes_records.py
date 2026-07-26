"""Evidence, dependency, review, decision, message, artifact, and escalation routes."""

from __future__ import annotations

import unittest

from coordination_ui.api import TextResponse, build_router
from coordination_ui.cli import CoordinationError

from ..support import TemporaryProject, cli_available


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class RecordRouteTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_task("T-2", actor="alice")
        self.router = build_router(self.temp.project(), self.temp.cli())

    def get(self, path: str, **query: str) -> object:
        return self.router.dispatch("GET", path, {k: [v] for k, v in query.items()})

    def post(self, path: str, body: dict[str, object]) -> object:
        return self.router.dispatch("POST", path, {}, body)


class EvidenceAndDependencyTests(RecordRouteTestCase):
    def test_add_evidence_defaults_the_type(self) -> None:
        self.post("/api/evidence", {"task": "T-1", "uri": "file://a", "actor": "alice"})
        self.assertEqual(self.get("/api/tasks/T-1/evidence")[0]["evidence_type"], "artifact")

    def test_add_evidence_accepts_an_explicit_type(self) -> None:
        self.post(
            "/api/evidence",
            {"task": "T-1", "uri": "file://b", "actor": "alice", "type": "test-run"},
        )
        self.assertEqual(self.get("/api/tasks/T-1/evidence")[0]["evidence_type"], "test-run")

    def test_evidence_for_an_unknown_task_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/tasks/ABSENT/evidence")
        self.assertEqual(caught.exception.http_status, 404)

    def test_add_dependency_defaults_to_blocks(self) -> None:
        added = self.post(
            "/api/dependencies", {"task": "T-1", "depends_on": "T-2", "actor": "alice"}
        )
        self.assertEqual(added["type"], "blocks")
        self.assertEqual(added["status"], "active")

    def test_dependency_rejects_an_unknown_type(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/dependencies",
                {"task": "T-1", "depends_on": "T-2", "actor": "alice", "type": "vibes"},
            )

    def test_dependency_cannot_reference_itself(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/dependencies",
                {"task": "T-1", "depends_on": "T-1", "actor": "alice"},
            )

    def test_resolve_dependency_marks_it_resolved(self) -> None:
        self.post("/api/dependencies", {"task": "T-1", "depends_on": "T-2", "actor": "alice"})
        resolved = self.post(
            "/api/dependencies/resolve",
            {"task": "T-1", "depends_on": "T-2", "actor": "alice"},
        )
        self.assertEqual(resolved["status"], "resolved")


class ReviewAndDecisionTests(RecordRouteTestCase):
    def test_add_review_records_the_decision(self) -> None:
        added = self.post(
            "/api/reviews",
            {
                "id": "REV-1",
                "task": "T-1",
                "reviewer": "alice",
                "artifact": "file://x",
                "scope": "API surface",
                "decision": "accepted",
                "blocked_claims": "Does not authorize release",
            },
        )
        self.assertEqual(added["decision"], "accepted")
        self.assertEqual(self.get("/api/reviews", task="T-1")[0]["id"], "REV-1")

    def test_review_task_is_optional(self) -> None:
        self.post(
            "/api/reviews",
            {
                "id": "REV-2",
                "reviewer": "alice",
                "artifact": "file://y",
                "scope": "docs",
                "decision": "changes_requested",
            },
        )
        self.assertIsNone(self.get("/api/reviews")[0]["task_id"])

    def test_review_rejects_an_unknown_decision(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/reviews",
                {
                    "id": "REV-3",
                    "reviewer": "alice",
                    "artifact": "a",
                    "scope": "s",
                    "decision": "lgtm",
                },
            )

    def test_add_decision_defaults_to_proposed(self) -> None:
        added = self.post(
            "/api/decisions",
            {
                "id": "DEC-1",
                "title": "Pick a stack",
                "owner": "alice",
                "context": "We need one",
                "decision": "React",
            },
        )
        self.assertEqual(added["status"], "proposed")

    def test_decision_requires_context_and_decision(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post("/api/decisions", {"id": "DEC-2", "title": "t", "owner": "alice"})


class MessageArtifactEscalationTests(RecordRouteTestCase):
    def test_send_and_list_messages(self) -> None:
        self.post(
            "/api/messages",
            {"id": "MSG-1", "sender": "alice", "recipient": "team", "body": "hello"},
        )
        self.assertEqual(self.get("/api/messages")[0]["body"], "hello")

    def test_recipient_filter_includes_team_messages(self) -> None:
        self.post(
            "/api/messages",
            {"id": "MSG-2", "sender": "alice", "recipient": "team", "body": "broadcast"},
        )
        self.assertEqual(len(self.get("/api/messages", recipient="bob")), 1)

    def test_add_artifact_returns_draft_by_default(self) -> None:
        added = self.post(
            "/api/artifacts",
            {"id": "ART-1", "uri": "file://doc", "owner": "alice", "type": "design"},
        )
        self.assertEqual(added["status"], "draft")

    def test_artifact_uri_is_unique(self) -> None:
        self.post(
            "/api/artifacts",
            {"id": "ART-2", "uri": "file://same", "owner": "alice", "type": "design"},
        )
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/artifacts",
                {"id": "ART-3", "uri": "file://same", "owner": "alice", "type": "design"},
            )
        self.assertEqual(caught.exception.http_status, 409)

    def test_artifact_links_tasks_and_reviewers(self) -> None:
        self.post(
            "/api/artifacts",
            {
                "id": "ART-4",
                "uri": "file://linked",
                "owner": "alice",
                "type": "design",
                "tasks": ["T-1", "T-2"],
                "reviewers": ["alice"],
            },
        )
        artifact = next(a for a in self.get("/api/artifacts") if a["id"] == "ART-4")
        self.assertEqual(artifact["related_tasks"], ["T-1", "T-2"])
        self.assertEqual(artifact["reviewers"], ["alice"])

    def test_artifact_status_transition(self) -> None:
        self.post(
            "/api/artifacts",
            {"id": "ART-5", "uri": "file://s", "owner": "alice", "type": "design"},
        )
        moved = self.post("/api/artifacts/ART-5/status", {"status": "accepted", "actor": "alice"})
        self.assertEqual(moved["status"], "accepted")

    def test_add_escalation_opens_it(self) -> None:
        added = self.post(
            "/api/escalations",
            {
                "id": "ESC-1",
                "raised_by": "alice",
                "owner": "product",
                "issue": "Ambiguous scope",
                "requested_decision": "Confirm the boundary",
            },
        )
        self.assertEqual(added["status"], "open")

    def test_resolve_escalation(self) -> None:
        self.post(
            "/api/escalations",
            {
                "id": "ESC-2",
                "raised_by": "alice",
                "owner": "product",
                "issue": "x",
                "requested_decision": "y",
            },
        )
        resolved = self.post(
            "/api/escalations/ESC-2/resolve", {"resolution": "Agreed", "actor": "alice"}
        )
        self.assertEqual(resolved["status"], "resolved")

    def test_escalation_list_filters_by_status(self) -> None:
        self.assertEqual(self.get("/api/escalations", status="open"), [])


class MetaRouteTests(RecordRouteTestCase):
    def test_meta_reports_versions_and_contract_enums(self) -> None:
        meta = self.get("/api/meta")
        self.assertEqual(meta["cli_version"], "1.2.0")
        self.assertEqual(meta["schema_version"], 1)
        self.assertIn("in_progress", meta["statuses"]["task"])
        self.assertEqual(meta["transitions"]["done"], [])

    def test_meta_includes_resolved_paths(self) -> None:
        meta = self.get("/api/meta")
        self.assertEqual(meta["database"], str(self.temp.database))

    def test_doctor_reports_a_healthy_database(self) -> None:
        self.assertTrue(self.get("/api/doctor")["healthy"])

    def test_summary_reports_totals(self) -> None:
        self.assertEqual(self.get("/api/summary")["totals"]["tasks"], 2)

    def test_health_flags_unowned_tasks(self) -> None:
        health = self.get("/api/health")
        self.assertFalse(health["healthy"])
        self.assertEqual(len(health["unowned_tasks"]), 2)

    def test_health_accepts_threshold_parameters(self) -> None:
        self.assertIn("stale_tasks", self.get("/api/health", stale_days="30"))

    def test_audit_returns_entries(self) -> None:
        self.assertGreater(self.get("/api/audit")["total"], 0)

    def test_export_returns_markdown_not_json(self) -> None:
        response = self.get("/api/export")
        self.assertIsInstance(response, TextResponse)
        self.assertEqual(response.content_type, "text/markdown; charset=utf-8")
        self.assertIn("#", response.body)


if __name__ == "__main__":
    unittest.main()
