"""Message, artifact, and escalation routes."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class MessagingTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_task("T-2", actor="alice")


class MessageTests(MessagingTestCase):
    def test_send_and_list(self) -> None:
        self.post(
            "/api/messages",
            {"id": "MSG-1", "sender": "alice", "recipient": "team", "body": "hello"},
        )
        self.assertEqual(self.get("/api/messages")[0]["body"], "hello")

    def test_message_can_reference_a_task(self) -> None:
        self.post(
            "/api/messages",
            {
                "id": "MSG-2",
                "sender": "alice",
                "recipient": "bob",
                "body": "see this",
                "task": "T-1",
                "tags": "handoff",
            },
        )
        message = self.get("/api/messages")[0]
        self.assertEqual(message["task_id"], "T-1")
        self.assertEqual(message["tags"], "handoff")

    def test_recipient_filter_includes_team_messages(self) -> None:
        self.post(
            "/api/messages",
            {"id": "MSG-3", "sender": "alice", "recipient": "team", "body": "broadcast"},
        )
        self.assertEqual(len(self.get("/api/messages", recipient="bob")), 1)

    def test_recipient_filter_excludes_other_direct_messages(self) -> None:
        self.post(
            "/api/messages",
            {"id": "MSG-4", "sender": "alice", "recipient": "carol", "body": "private"},
        )
        self.assertEqual(self.get("/api/messages", recipient="bob"), [])

    def test_message_requires_a_body(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/messages", {"id": "MSG-5", "sender": "alice", "recipient": "team"}
            )


class ArtifactTests(MessagingTestCase):
    def test_add_returns_draft_by_default(self) -> None:
        added = self.post(
            "/api/artifacts",
            {"id": "ART-1", "uri": "file://doc", "owner": "alice", "type": "design"},
        )
        self.assertEqual(added["status"], "draft")

    def test_uri_is_unique(self) -> None:
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

    def test_links_tasks_and_reviewers_as_sorted_arrays(self) -> None:
        self.post(
            "/api/artifacts",
            {
                "id": "ART-4",
                "uri": "file://linked",
                "owner": "alice",
                "type": "design",
                "tasks": ["T-2", "T-1"],
                "reviewers": ["alice"],
            },
        )
        artifact = next(a for a in self.get("/api/artifacts") if a["id"] == "ART-4")
        self.assertEqual(artifact["related_tasks"], ["T-1", "T-2"])
        self.assertEqual(artifact["reviewers"], ["alice"])

    def test_status_transition(self) -> None:
        self.post(
            "/api/artifacts",
            {"id": "ART-5", "uri": "file://s", "owner": "alice", "type": "design"},
        )
        moved = self.post(
            "/api/artifacts/ART-5/status", {"status": "accepted", "actor": "alice"}
        )
        self.assertEqual(moved["status"], "accepted")

    def test_status_rejects_an_unknown_value(self) -> None:
        self.post(
            "/api/artifacts",
            {"id": "ART-6", "uri": "file://u", "owner": "alice", "type": "design"},
        )
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/artifacts/ART-6/status", {"status": "published", "actor": "alice"}
            )

    def test_list_filters_by_status(self) -> None:
        self.post(
            "/api/artifacts",
            {"id": "ART-7", "uri": "file://f", "owner": "alice", "type": "design"},
        )
        self.assertEqual(len(self.get("/api/artifacts", status="draft")), 1)
        self.assertEqual(self.get("/api/artifacts", status="accepted"), [])


class EscalationTests(MessagingTestCase):
    def open_one(self, identifier: str = "ESC-1") -> None:
        self.post(
            "/api/escalations",
            {
                "id": identifier,
                "raised_by": "alice",
                "owner": "product",
                "issue": "Ambiguous scope",
                "requested_decision": "Confirm the boundary",
            },
        )

    def test_add_opens_it(self) -> None:
        self.open_one()
        self.assertEqual(self.get("/api/escalations")[0]["status"], "open")

    def test_owner_is_free_text_not_an_agent_identifier(self) -> None:
        self.post(
            "/api/escalations",
            {
                "id": "ESC-2",
                "raised_by": "alice",
                "owner": "the product council",
                "issue": "x",
                "requested_decision": "y",
            },
        )
        self.assertEqual(self.get("/api/escalations")[0]["owner"], "the product council")

    def test_needed_by_defaults_to_null(self) -> None:
        self.open_one("ESC-3")
        self.assertIsNone(self.get("/api/escalations")[0]["needed_by"])

    def test_requires_an_issue_and_requested_decision(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/escalations",
                {"id": "ESC-4", "raised_by": "alice", "owner": "product"},
            )

    def test_resolve(self) -> None:
        self.open_one("ESC-5")
        resolved = self.post(
            "/api/escalations/ESC-5/resolve", {"resolution": "Agreed", "actor": "alice"}
        )
        self.assertEqual(resolved["status"], "resolved")

    def test_resolve_can_close_without_action(self) -> None:
        self.open_one("ESC-6")
        closed = self.post(
            "/api/escalations/ESC-6/resolve",
            {"resolution": "Not needed", "actor": "alice", "status": "closed_no_action"},
        )
        self.assertEqual(closed["status"], "closed_no_action")

    def test_resolve_rejects_an_unsupported_status(self) -> None:
        self.open_one("ESC-7")
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/escalations/ESC-7/resolve",
                {"resolution": "x", "actor": "alice", "status": "open"},
            )

    def test_list_filters_by_status(self) -> None:
        self.assertEqual(self.get("/api/escalations", status="open"), [])


if __name__ == "__main__":
    unittest.main()
