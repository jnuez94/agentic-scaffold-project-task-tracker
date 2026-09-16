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


class DecisionStatusTests(RecordTestCase):
    def seed(self) -> None:
        super().seed()
        self.temp.seed_session("s-1", "alice")
        self.session = "s-1"
        self.post(
            "/api/decisions",
            {
                "id": "DEC-1",
                "title": "Adopt the ledger layout",
                "owner": "alice",
                "context": "Two layouts were mocked.",
                "decision": "Ledger.",
            },
        )

    def rule(self, status: str, **extra: str) -> dict[str, object]:
        body: dict[str, object] = {"status": status, "actor": "alice", **extra}
        result: dict[str, object] = self.post("/api/decisions/DEC-1/status", body)
        return result

    def test_records_the_ruling_and_its_note_in_the_audit_trail(self) -> None:
        ruled = self.rule(
            "accepted", if_status="proposed", note="Operator confirmed on review."
        )
        self.assertEqual((ruled["previous_status"], ruled["status"]), ("proposed", "accepted"))
        decision = next(d for d in self.get("/api/decisions") if d["id"] == "DEC-1")
        self.assertEqual(decision["status"], "accepted")
        newest = self.get("/api/audit", object_id="DEC-1", limit="1")[0]
        self.assertEqual(newest["action"], "status")
        self.assertEqual(
            newest["detail"], "proposed -> accepted; Operator confirmed on review."
        )

    def test_if_status_refuses_a_decision_that_changed_underneath(self) -> None:
        self.rule("accepted", if_status="proposed")
        with self.assertRaises(CoordinationError) as caught:
            self.rule("superseded", if_status="proposed")
        self.assertEqual(caught.exception.code, "status_mismatch")
        self.assertEqual(caught.exception.http_status, 409)

    def test_status_must_be_one_of_the_four(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.rule("closed")
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_actor_is_required(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post("/api/decisions/DEC-1/status", {"status": "accepted"})


if __name__ == "__main__":
    unittest.main()
