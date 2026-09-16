"""Message list filters. Sending is covered with the broadcast routes."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class MessageListTests(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_task("T-2", actor="alice")
        self.temp.seed_session("s-1", "alice")
        self.session = "s-1"
        self.send("m-1", "team", task="T-1", body="about T-1 for everyone")
        self.send("m-2", "bob", task="T-1", body="about T-1 for bob")
        self.send("m-3", "team", task="T-2", body="about T-2")
        self.send("m-4", "team", body="no task at all")

    def send(self, message_id: str, recipient: str, body: str, task: str | None = None) -> None:
        payload = {"id": message_id, "sender": "alice", "recipient": recipient, "body": body}
        if task:
            payload["task"] = task
        self.post("/api/messages", payload)

    def test_task_returns_only_that_task_s_messages(self) -> None:
        ids = [row["id"] for row in self.get("/api/messages", task="T-1")]
        self.assertEqual(ids, ["m-1", "m-2"])

    def test_task_and_recipient_combine_with_and(self) -> None:
        ids = [row["id"] for row in self.get("/api/messages", task="T-1", recipient="alice")]
        # alice sees team traffic about T-1, not the message addressed to bob.
        self.assertEqual(ids, ["m-1"])

    def test_a_task_nobody_wrote_about_is_an_empty_list(self) -> None:
        self.temp.seed_task("T-9", actor="alice")
        self.assertEqual(self.get("/api/messages", task="T-9"), [])

    def test_task_must_be_an_identifier(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/messages", task="--recipient")
        self.assertEqual(caught.exception.code, "invalid_arguments")


if __name__ == "__main__":
    unittest.main()
