"""``show`` routes: one stored row by id, for every entity that has one."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class ShowTests(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_session("s-1", "alice")
        self.session = "s-1"
        self.post(
            "/api/messages", {"id": "m-1", "sender": "alice", "recipient": "team", "body": "hi"}
        )
        self.post(
            "/api/decisions",
            {"id": "DEC-1", "title": "T", "owner": "alice", "context": "c", "decision": "d"},
        )
        self.post(
            "/api/reviews",
            {
                "id": "REV-1",
                "task": "T-1",
                "reviewer": "alice",
                "artifact": "a",
                "scope": "s",
                "decision": "accepted",
            },
        )
        self.post(
            "/api/artifacts",
            {
                "id": "ART-1",
                "uri": "docs/a.md",
                "owner": "alice",
                "type": "document",
                "tasks": ["T-1"],
            },
        )
        self.post(
            "/api/escalations",
            {
                "id": "ESC-1",
                "raised_by": "alice",
                "owner": "alice",
                "issue": "i",
                "requested_decision": "r",
            },
        )

    def test_every_entity_shows_its_stored_row(self) -> None:
        for path, key, value in (
            ("/api/agents/alice", "name", "alice"),
            ("/api/sessions/s-1", "agent_id", "alice"),
            ("/api/messages/m-1", "body", "hi"),
            ("/api/decisions/DEC-1", "status", "proposed"),
            ("/api/reviews/REV-1", "decision", "accepted"),
            ("/api/escalations/ESC-1", "status", "open"),
        ):
            with self.subTest(path=path):
                self.assertEqual(self.get(path)[key], value)

    def test_an_artifact_shows_its_related_tasks_and_reviewers(self) -> None:
        artifact = self.get("/api/artifacts/ART-1")
        self.assertEqual(artifact["related_tasks"], ["T-1"])
        self.assertEqual(artifact["reviewers"], [])

    def test_an_unknown_id_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/decisions/ABSENT")
        self.assertEqual(caught.exception.code, "not_found")
        self.assertEqual(caught.exception.http_status, 404)

    def test_an_id_that_is_not_an_identifier_is_refused_before_argv(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/agents/--actor")
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_show_does_not_shadow_the_existing_write_on_the_same_path(self) -> None:
        # POST /api/agents/{id} is the update; GET is the show. Same path, two verbs.
        updated = self.post("/api/agents/alice", {"role": "Principal"})
        self.assertEqual(updated["role"], "Principal")
        self.assertEqual(self.get("/api/agents/alice")["role"], "Principal")


if __name__ == "__main__":
    unittest.main()
