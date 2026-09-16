"""Inbox routes: the acting actor's unread messages and the explicit read mark."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class InboxTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_session("s-a", "alice")
        self.temp.seed_session("s-b", "bob")

    def send(self, message_id: str, sender: str, recipient: str, session: str) -> None:
        self.post(
            "/api/messages",
            {"id": message_id, "sender": sender, "recipient": recipient, "body": message_id},
            session=session,
        )


class InboxListTests(InboxTestCase):
    def test_a_new_agent_starts_with_an_empty_inbox_and_the_envelope(self) -> None:
        inbox = self.get("/api/inbox", agent="bob")
        self.assertEqual(inbox["agent"], "bob")
        self.assertEqual(inbox["messages"], [])
        self.assertGreater(inbox["head"], 0)
        self.assertLessEqual(inbox["cursor"], inbox["head"])

    def test_messages_to_the_agent_and_to_team_arrive_with_their_audit_id(self) -> None:
        self.send("m-team", "alice", "team", "s-a")
        self.send("m-bob", "alice", "bob", "s-a")
        self.send("m-alice", "bob", "alice", "s-b")
        inbox = self.get("/api/inbox", agent="bob")
        self.assertEqual([m["id"] for m in inbox["messages"]], ["m-team", "m-bob"])
        self.assertTrue(all(isinstance(m["audit_id"], int) for m in inbox["messages"]))
        self.assertEqual(inbox["messages"][0]["body"], "m-team")

    def test_the_owner_is_required(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/inbox")
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_listing_never_moves_the_cursor(self) -> None:
        self.send("m-team", "alice", "team", "s-a")
        before = self.get("/api/inbox", agent="bob")["cursor"]
        self.get("/api/inbox", agent="bob")
        self.assertEqual(self.get("/api/inbox", agent="bob")["cursor"], before)


class MarkReadTests(InboxTestCase):
    def test_marking_at_the_head_empties_the_inbox(self) -> None:
        self.send("m-team", "alice", "team", "s-a")
        inbox = self.get("/api/inbox", agent="bob")
        self.assertEqual(len(inbox["messages"]), 1)

        self.session = "s-b"
        marked = self.post("/api/inbox/mark-read", {"agent": "bob", "cursor": inbox["head"]})
        self.assertEqual(marked["cursor"], inbox["head"])
        self.assertEqual(marked["previous_cursor"], inbox["cursor"])
        self.assertEqual(self.get("/api/inbox", agent="bob")["messages"], [])

    def test_the_cursor_moves_forward_only(self) -> None:
        self.send("m-team", "alice", "team", "s-a")
        inbox = self.get("/api/inbox", agent="bob")
        self.session = "s-b"
        self.post("/api/inbox/mark-read", {"agent": "bob", "cursor": inbox["head"]})
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/inbox/mark-read", {"agent": "bob", "cursor": inbox["cursor"]})
        self.assertEqual(caught.exception.code, "cursor_not_monotonic")
        self.assertEqual(caught.exception.http_status, 409)

    def test_a_cursor_past_the_head_is_refused(self) -> None:
        self.session = "s-b"
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/inbox/mark-read", {"agent": "bob", "cursor": 999999})
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_the_mark_is_audited_on_the_agent(self) -> None:
        self.session = "s-b"
        head = self.get("/api/inbox", agent="bob")["head"]
        self.post("/api/inbox/mark-read", {"agent": "bob", "cursor": head})
        newest = self.get("/api/audit", limit="1")[0]
        self.assertEqual(
            (newest["action"], newest["object_type"], newest["object_id"]),
            ("mark_read", "agent", "bob"),
        )


if __name__ == "__main__":
    unittest.main()
