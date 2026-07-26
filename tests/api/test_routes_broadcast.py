"""Team broadcast behaviour against a real throwaway database.

Criterion 29 of .documents/human-operator-team-broadcast-task.md: one broadcast
creates exactly one Message row, and listing messages for two different
recipients returns that same ``team`` message.
"""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class BroadcastTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.run(
            "agent",
            "add",
            "--id=local-operator",
            "--name=Local Operator",
            "--role=Human Operator",
            "--actor-type=human",
        )
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.temp.seed_task("T-1", actor="alice")
        self.session = self.temp.seed_session("console-1", "local-operator")

    def broadcast(self, identifier: str, **extra: object) -> object:
        body = {
            "id": identifier,
            "sender": "local-operator",
            "recipient": "team",
            "body": "standup at ten",
            **extra,
        }
        return self.post("/api/messages", body)


class BroadcastCreatesOneRowTests(BroadcastTestCase):
    def test_creates_exactly_one_message(self) -> None:
        self.broadcast("bcast-1")
        self.assertEqual(len(self.get("/api/messages")), 1)

    def test_row_matches_the_existing_message_shape(self) -> None:
        self.broadcast("bcast-2", task="T-1", tags="status")
        message = self.get("/api/messages")[0]
        self.assertEqual(message["id"], "bcast-2")
        self.assertEqual(message["sender_id"], "local-operator")
        self.assertEqual(message["recipient"], "team")
        self.assertEqual(message["task_id"], "T-1")
        self.assertEqual(message["tags"], "status")
        self.assertEqual(message["body"], "standup at ten")
        self.assertIn("created_at", message)

    def test_the_session_is_audited_but_not_stored_on_the_row(self) -> None:
        self.broadcast("bcast-3")
        message = self.get("/api/messages")[0]
        self.assertNotIn("session_id", message)
        audit = self.api_audit(object_id="bcast-3")
        self.assertEqual(audit["entries"][0]["session_id"], "console-1")

    def api_audit(self, **query: str) -> dict:
        return self.get("/api/audit", **query)


class BroadcastReachesEveryRecipientTests(BroadcastTestCase):
    def test_two_different_recipients_both_see_the_team_message(self) -> None:
        self.broadcast("bcast-4")
        for recipient in ("alice", "bob"):
            with self.subTest(recipient=recipient):
                inbox = self.get("/api/messages", recipient=recipient)
                self.assertEqual([m["id"] for m in inbox], ["bcast-4"])

    def test_a_direct_message_is_not_visible_to_another_recipient(self) -> None:
        # Confirms the team result above is genuine and not a filter that
        # returns everything regardless of recipient.
        self.post(
            "/api/messages",
            {"id": "direct-1", "sender": "local-operator", "recipient": "alice", "body": "hi"},
        )
        self.assertEqual(self.get("/api/messages", recipient="bob"), [])
        self.assertEqual(len(self.get("/api/messages", recipient="alice")), 1)


class BroadcastFailureTests(BroadcastTestCase):
    def test_a_duplicate_id_is_refused_as_a_conflict(self) -> None:
        self.broadcast("bcast-5")
        with self.assertRaises(CoordinationError) as caught:
            self.broadcast("bcast-5")
        self.assertEqual(caught.exception.code, "constraint_violation")
        self.assertEqual(caught.exception.http_status, 409)

    def test_a_refused_duplicate_creates_no_second_row(self) -> None:
        self.broadcast("bcast-6")
        with self.assertRaises(CoordinationError):
            self.broadcast("bcast-6")
        self.assertEqual(len(self.get("/api/messages")), 1)

    def test_an_unknown_sender_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/messages",
                {"id": "bcast-7", "sender": "ghost", "recipient": "team", "body": "x"},
            )
        self.assertEqual(caught.exception.http_status, 404)

    def test_an_empty_body_is_refused(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/messages",
                {"id": "bcast-8", "sender": "local-operator", "recipient": "team", "body": "   "},
            )


if __name__ == "__main__":
    unittest.main()
