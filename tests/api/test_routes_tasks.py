"""Task creation, listing, and reading."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class TaskCreateTests(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")

    def test_create_returns_id_status_and_revision(self) -> None:
        created = self.post(
            "/api/tasks", {"id": "T-1", "title": "First", "actor": "alice"}
        )
        self.assertEqual(created["id"], "T-1")
        self.assertEqual(created["status"], "todo")
        self.assertEqual(created["revision"], 1)

    def test_create_accepts_assignees_as_a_list(self) -> None:
        self.temp.seed_agent("bob")
        created = self.post(
            "/api/tasks",
            {"id": "T-2", "title": "x", "actor": "alice", "assignees": ["bob", "alice"]},
        )
        self.assertEqual(created["assignees"], ["alice", "bob"])

    def test_create_rejects_duplicate_assignees(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/tasks",
                {"id": "T-3", "title": "x", "actor": "alice", "assignees": ["alice", "alice"]},
            )

    def test_create_rejects_a_duplicate_id_as_a_conflict(self) -> None:
        self.post("/api/tasks", {"id": "T-4", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks", {"id": "T-4", "title": "y", "actor": "alice"})
        self.assertEqual(caught.exception.code, "constraint_violation")
        self.assertEqual(caught.exception.http_status, 409)

    def test_create_requires_an_actor(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks", {"id": "T-5", "title": "x"})
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_create_requires_a_title(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post("/api/tasks", {"id": "T-6", "actor": "alice"})

    def test_create_rejects_an_out_of_range_priority(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/tasks",
                {"id": "T-7", "title": "x", "actor": "alice", "priority": 9},
            )

    def test_create_stores_the_full_content_set(self) -> None:
        self.post(
            "/api/tasks",
            {
                "id": "T-8",
                "title": "Full",
                "actor": "alice",
                "description": "d",
                "tags": "a,b",
                "acceptance": "criteria",
                "next_steps": "steps",
                "blocked_claims": "not released",
                "priority": 1,
            },
        )
        task = self.get("/api/tasks/T-8")
        self.assertEqual(task["acceptance_criteria"], "criteria")
        self.assertEqual(task["blocked_claims"], "not released")
        self.assertEqual(task["priority"], 1)

    def test_a_title_beginning_with_a_dash_is_not_parsed_as_an_option(self) -> None:
        self.post("/api/tasks", {"id": "T-9", "title": "--force", "actor": "alice"})
        self.assertEqual(self.get("/api/tasks/T-9")["title"], "--force")


class TaskReadTests(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.temp.seed_task("T-1", actor="alice", assignee="alice")
        self.temp.seed_task("T-2", actor="alice", priority="1")

    def test_list_includes_aggregate_fields(self) -> None:
        row = next(t for t in self.get("/api/tasks") if t["id"] == "T-1")
        self.assertEqual(row["evidence_count"], 0)
        self.assertEqual(row["assignees"], ["alice"])
        self.assertIsNone(row["claimed_by"])

    def test_list_is_ordered_by_priority(self) -> None:
        self.assertEqual([t["id"] for t in self.get("/api/tasks")], ["T-2", "T-1"])

    def test_list_filters_by_status(self) -> None:
        self.assertEqual(len(self.get("/api/tasks", status="todo")), 2)
        self.assertEqual(self.get("/api/tasks", status="done"), [])

    def test_list_filters_by_assignee(self) -> None:
        self.assertEqual([t["id"] for t in self.get("/api/tasks", assignee="alice")], ["T-1"])
        self.assertEqual(self.get("/api/tasks", assignee="bob"), [])

    def test_list_rejects_an_unknown_status(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/tasks", status="archived")
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_list_honors_limit_and_offset(self) -> None:
        self.assertEqual(len(self.get("/api/tasks", limit="1")), 1)
        self.assertEqual(len(self.get("/api/tasks", limit="1", offset="2")), 0)

    def test_show_includes_nested_collections(self) -> None:
        shown = self.get("/api/tasks/T-1")
        for key in ("evidence", "dependencies", "reviews"):
            self.assertEqual(shown[key], [])

    def test_show_missing_task_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/tasks/ABSENT")
        self.assertEqual(caught.exception.http_status, 404)

    def test_show_rejects_an_invalid_identifier(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.router.dispatch("GET", "/api/tasks/--force")
        self.assertEqual(caught.exception.code, "invalid_arguments")


if __name__ == "__main__":
    unittest.main()
