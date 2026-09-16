"""--because on task status and release (1.4.0): the record a change follows from."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class BecauseTests(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_session("s-1", "alice")
        self.session = "s-1"
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        self.post(
            "/api/reviews",
            {
                "id": "REV-1",
                "task": "T-1",
                "reviewer": "alice",
                "artifact": "a",
                "scope": "s",
                "decision": "changes_requested",
            },
        )

    def revision(self) -> int:
        return int(self.get("/api/tasks/T-1")["revision"])

    def test_the_cause_lands_at_the_end_of_the_audit_detail(self) -> None:
        self.post(
            "/api/tasks/T-1/release",
            {
                "actor": "alice",
                "if_revision": self.revision(),
                "to": "review",
                "because": "review:REV-1",
            },
        )
        newest = self.get("/api/audit", object_id="T-1", limit="1")[0]
        self.assertEqual(newest["action"], "status")
        self.assertTrue(newest["detail"].endswith("because=review:REV-1"), newest["detail"])

    def test_a_status_change_takes_a_cause_too(self) -> None:
        self.post(
            "/api/tasks/T-1/release",
            {"actor": "alice", "if_revision": self.revision(), "to": "review"},
        )
        self.post(
            "/api/tasks/T-1/status",
            {
                "actor": "alice",
                "if_revision": self.revision(),
                "status": "blocked",
                "because": "review:REV-1",
            },
        )
        newest = self.get("/api/audit", object_id="T-1", limit="1")[0]
        self.assertIn("because=review:REV-1", newest["detail"])

    def test_an_unshaped_cause_never_reaches_the_cli(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/release",
                {
                    "actor": "alice",
                    "if_revision": self.revision(),
                    "to": "review",
                    "because": "REV-1",
                },
            )
        self.assertEqual(caught.exception.code, "invalid_arguments")
        self.assertIn("TYPE:ID", caught.exception.message)

    def test_a_cause_that_does_not_exist_is_refused_by_the_cli(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/release",
                {
                    "actor": "alice",
                    "if_revision": self.revision(),
                    "to": "review",
                    "because": "review:REV-404",
                },
            )
        self.assertIn(caught.exception.code, ("not_found", "invalid_arguments"))

    def test_no_cause_is_still_a_status_change(self) -> None:
        moved = self.post(
            "/api/tasks/T-1/release",
            {"actor": "alice", "if_revision": self.revision(), "to": "review"},
        )
        self.assertEqual(moved["status"], "review")


if __name__ == "__main__":
    unittest.main()
