"""Artifact routes: registration, status with compare-and-swap, and correction in place."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class ArtifactTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_session("s-1", "alice")
        self.session = "s-1"
        self.post(
            "/api/artifacts",
            {
                "id": "ART-1",
                "uri": "docs/plan.md, docs/plan-appendix.md",
                "owner": "alice",
                "type": "document",
                "usage_boundaries": "Draft only.",
                "tasks": ["T-1"],
            },
        )

    def artifact(self) -> dict[str, object]:
        row: dict[str, object] = self.get("/api/artifacts/ART-1")
        return row


class StatusTests(ArtifactTestCase):
    def test_if_status_guards_the_change(self) -> None:
        self.post(
            "/api/artifacts/ART-1/status",
            {"status": "review", "actor": "alice", "if_status": "draft"},
        )
        self.assertEqual(self.artifact()["status"], "review")
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/artifacts/ART-1/status",
                {"status": "accepted", "actor": "alice", "if_status": "draft"},
            )
        self.assertEqual(caught.exception.code, "status_mismatch")
        self.assertEqual(caught.exception.http_status, 409)


class UpdateTests(ArtifactTestCase):
    def test_corrects_fields_in_place_and_returns_the_whole_row(self) -> None:
        updated = self.post(
            "/api/artifacts/ART-1/update",
            {"actor": "alice", "uri": "docs/plan-v2.md", "if_status": "draft"},
        )
        self.assertEqual(updated["uri"], "docs/plan-v2.md")
        self.assertEqual(updated["type"], "document")
        # The update returns the stored row; relations come with show and list.
        shown = self.artifact()
        self.assertEqual(shown["uri"], "docs/plan-v2.md")
        self.assertEqual(shown["related_tasks"], ["T-1"])

    def test_the_audit_row_names_the_changed_fields(self) -> None:
        self.post(
            "/api/artifacts/ART-1/update",
            {"actor": "alice", "type": "spec", "usage_boundaries": "Review copy."},
        )
        newest = self.get("/api/audit", object_id="ART-1", limit="1")[0]
        self.assertEqual(newest["action"], "update")
        self.assertIn("type", newest["detail"])
        self.assertIn("usage_boundaries", newest["detail"])

    def test_at_least_one_changed_field_is_required(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/artifacts/ART-1/update", {"actor": "alice"})
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_if_status_refuses_a_record_that_moved(self) -> None:
        self.post("/api/artifacts/ART-1/status", {"status": "review", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/artifacts/ART-1/update",
                {"actor": "alice", "type": "x", "if_status": "draft"},
            )
        self.assertEqual(caught.exception.code, "status_mismatch")

    def test_status_owner_and_relations_are_not_this_command_s(self) -> None:
        # Extra fields are ignored by the route rather than forwarded.
        updated = self.post(
            "/api/artifacts/ART-1/update",
            {"actor": "alice", "type": "spec", "status": "accepted", "owner": "bob"},
        )
        self.assertEqual(updated["status"], "draft")
        self.assertEqual(updated["owner_id"], "alice")

    def test_an_unknown_artifact_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/artifacts/NOPE/update", {"actor": "alice", "type": "x"})
        self.assertEqual(caught.exception.code, "not_found")


if __name__ == "__main__":
    unittest.main()
