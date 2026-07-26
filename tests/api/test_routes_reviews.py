"""Review and decision routes."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class RecordTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_task("T-2", actor="alice")


class ReviewTests(RecordTestCase):
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
        listed = self.get("/api/reviews", task="T-1")[0]
        self.assertEqual(listed["id"], "REV-1")
        self.assertEqual(listed["blocked_claims"], "Does not authorize release")

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

    def test_review_appears_on_the_task(self) -> None:
        self.post(
            "/api/reviews",
            {
                "id": "REV-3",
                "task": "T-1",
                "reviewer": "alice",
                "artifact": "a",
                "scope": "s",
                "decision": "rejected",
            },
        )
        self.assertEqual(len(self.get("/api/tasks/T-1")["reviews"]), 1)

    def test_review_rejects_an_unknown_decision(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/reviews",
                {
                    "id": "REV-4",
                    "reviewer": "alice",
                    "artifact": "a",
                    "scope": "s",
                    "decision": "lgtm",
                },
            )

    def test_review_requires_a_scope(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/reviews",
                {"id": "REV-5", "reviewer": "alice", "artifact": "a", "decision": "accepted"},
            )


class DecisionTests(RecordTestCase):
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

    def test_decision_accepts_an_explicit_status(self) -> None:
        added = self.post(
            "/api/decisions",
            {
                "id": "DEC-2",
                "title": "t",
                "owner": "alice",
                "context": "c",
                "decision": "d",
                "status": "accepted",
            },
        )
        self.assertEqual(added["status"], "accepted")

    def test_decision_requires_context_and_decision(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post("/api/decisions", {"id": "DEC-3", "title": "t", "owner": "alice"})

    def test_decision_list_is_returned(self) -> None:
        self.post(
            "/api/decisions",
            {"id": "DEC-4", "title": "t", "owner": "alice", "context": "c", "decision": "d"},
        )
        self.assertEqual(self.get("/api/decisions")[0]["id"], "DEC-4")


if __name__ == "__main__":
    unittest.main()
