"""Task routes against a real database."""

from __future__ import annotations

import unittest

from coordination_ui.api import build_router
from coordination_ui.cli import CoordinationError

from ..support import TemporaryProject, cli_available


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class TaskRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.temp.seed_agent("alice")
        self.session = self.temp.seed_session("s-1", "alice")
        self.router = build_router(self.temp.project(), self.temp.cli())

    def get(self, path: str, **query: str) -> object:
        return self.router.dispatch(
            "GET", path, {k: [v] for k, v in query.items()}, {}, self.session
        )

    def post(self, path: str, body: dict[str, object], session: str | None = "keep") -> object:
        actual = self.session if session == "keep" else session
        return self.router.dispatch("POST", path, {}, body, actual)

    # -- create and read ----------------------------------------------------

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
            {"id": "T-2", "title": "x", "actor": "alice", "assignees": ["alice", "bob"]},
        )
        self.assertEqual(created["assignees"], ["alice", "bob"])

    def test_create_rejects_a_duplicate_id_as_a_conflict(self) -> None:
        self.post("/api/tasks", {"id": "T-3", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks", {"id": "T-3", "title": "y", "actor": "alice"})
        self.assertEqual(caught.exception.code, "constraint_violation")
        self.assertEqual(caught.exception.http_status, 409)

    def test_create_requires_an_actor(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks", {"id": "T-4", "title": "x"})
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_list_includes_aggregate_fields(self) -> None:
        self.post("/api/tasks", {"id": "T-5", "title": "x", "actor": "alice"})
        row = self.get("/api/tasks")[0]
        self.assertIn("evidence_count", row)
        self.assertIn("assignees", row)
        self.assertIsNone(row["claimed_by"])

    def test_list_filters_by_status(self) -> None:
        self.post("/api/tasks", {"id": "T-6", "title": "x", "actor": "alice"})
        self.assertEqual(len(self.get("/api/tasks", status="todo")), 1)
        self.assertEqual(self.get("/api/tasks", status="done"), [])

    def test_list_rejects_an_unknown_status(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/tasks", status="archived")
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_show_includes_nested_collections(self) -> None:
        self.post("/api/tasks", {"id": "T-7", "title": "x", "actor": "alice"})
        shown = self.get("/api/tasks/T-7")
        for key in ("evidence", "dependencies", "reviews"):
            self.assertEqual(shown[key], [])

    def test_show_missing_task_is_not_found(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.get("/api/tasks/ABSENT")
        self.assertEqual(caught.exception.http_status, 404)

    # -- claim and status ---------------------------------------------------

    def test_claim_moves_the_task_to_in_progress(self) -> None:
        self.post("/api/tasks", {"id": "T-8", "title": "x", "actor": "alice"})
        claimed = self.post(
            "/api/tasks/T-8/claim", {"agent": "alice", "if_revision": 1}
        )
        self.assertEqual(claimed["status"], "in_progress")
        self.assertEqual(claimed["revision"], 2)
        self.assertTrue(claimed["claimed"])

    def test_claim_without_a_session_is_refused_before_the_cli_runs(self) -> None:
        self.post("/api/tasks", {"id": "T-9", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-9/claim", {"agent": "alice", "if_revision": 1}, session=None
            )
        self.assertEqual(caught.exception.code, "session_required")
        self.assertEqual(caught.exception.http_status, 400)

    def test_claim_replay_is_idempotent(self) -> None:
        self.post("/api/tasks", {"id": "T-10", "title": "x", "actor": "alice"})
        self.post("/api/tasks/T-10/claim", {"agent": "alice", "if_revision": 1})
        replay = self.post("/api/tasks/T-10/claim", {"agent": "alice", "if_revision": 1})
        self.assertFalse(replay["claimed"])
        self.assertTrue(replay["idempotent_replay"])

    def test_stale_revision_is_a_conflict_carrying_the_actual_revision(self) -> None:
        self.post("/api/tasks", {"id": "T-11", "title": "x", "actor": "alice"})
        self.post("/api/tasks/T-11/claim", {"agent": "alice", "if_revision": 1})
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-11/status",
                {"status": "review", "actor": "alice", "if_revision": 1},
            )
        self.assertEqual(caught.exception.code, "stale_task_revision")
        self.assertEqual(caught.exception.http_status, 409)
        self.assertEqual(caught.exception.details["actual_revision"], 2)

    def test_entering_in_progress_by_status_is_refused(self) -> None:
        self.post("/api/tasks", {"id": "T-12", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-12/status",
                {"status": "in_progress", "actor": "alice", "if_revision": 1},
            )
        self.assertEqual(caught.exception.code, "task_claim_required")

    def test_done_without_evidence_is_refused(self) -> None:
        self.post("/api/tasks", {"id": "T-13", "title": "x", "actor": "alice"})
        self.post("/api/tasks/T-13/claim", {"agent": "alice", "if_revision": 1})
        self.post(
            "/api/tasks/T-13/status",
            {"status": "review", "actor": "alice", "if_revision": 2},
        )
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/tasks/T-13/status",
                {"status": "done", "actor": "alice", "if_revision": 3},
            )

    def test_done_succeeds_once_evidence_exists(self) -> None:
        self.post("/api/tasks", {"id": "T-14", "title": "x", "actor": "alice"})
        self.post("/api/tasks/T-14/claim", {"agent": "alice", "if_revision": 1})
        self.post("/api/evidence", {"task": "T-14", "uri": "file://x", "actor": "alice"})
        self.post(
            "/api/tasks/T-14/status",
            {"status": "review", "actor": "alice", "if_revision": 2},
        )
        done = self.post(
            "/api/tasks/T-14/status",
            {"status": "done", "actor": "alice", "if_revision": 3},
        )
        self.assertEqual(done["status"], "done")

    def test_release_returns_the_task_to_a_claimable_state(self) -> None:
        self.post("/api/tasks", {"id": "T-15", "title": "x", "actor": "alice"})
        self.post("/api/tasks/T-15/claim", {"agent": "alice", "if_revision": 1})
        released = self.post(
            "/api/tasks/T-15/release", {"to": "todo", "actor": "alice", "if_revision": 2}
        )
        self.assertEqual(released["status"], "todo")

    def test_release_rejects_an_invalid_target(self) -> None:
        self.post("/api/tasks", {"id": "T-16", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/tasks/T-16/release",
                {"to": "done", "actor": "alice", "if_revision": 1},
            )

    # -- update and assign --------------------------------------------------

    def test_update_requires_a_content_field(self) -> None:
        self.post("/api/tasks", {"id": "T-17", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks/T-17/update", {"actor": "alice", "if_revision": 1})
        self.assertIn("content field", caught.exception.message)

    def test_update_increments_the_revision(self) -> None:
        self.post("/api/tasks", {"id": "T-18", "title": "x", "actor": "alice"})
        updated = self.post(
            "/api/tasks/T-18/update",
            {"actor": "alice", "if_revision": 1, "title": "renamed"},
        )
        self.assertEqual(updated["revision"], 2)
        self.assertIn("title", updated["updated_fields"])

    def test_assign_requires_an_add_or_remove(self) -> None:
        self.post("/api/tasks", {"id": "T-19", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks/T-19/assign", {"actor": "alice", "if_revision": 1})
        self.assertIn("add or remove", caught.exception.message)

    def test_assign_rejects_overlapping_sets_before_the_cli_runs(self) -> None:
        self.post("/api/tasks", {"id": "T-20", "title": "x", "actor": "alice"})
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-20/assign",
                {"actor": "alice", "if_revision": 1, "add": ["alice"], "remove": ["alice"]},
            )
        self.assertEqual(caught.exception.details["overlapping"], ["alice"])

    def test_assign_returns_the_sorted_assignee_set(self) -> None:
        self.temp.seed_agent("bob")
        self.post("/api/tasks", {"id": "T-21", "title": "x", "actor": "alice"})
        assigned = self.post(
            "/api/tasks/T-21/assign",
            {"actor": "alice", "if_revision": 1, "add": ["bob", "alice"]},
        )
        self.assertEqual(assigned["assignees"], ["alice", "bob"])


if __name__ == "__main__":
    unittest.main()
