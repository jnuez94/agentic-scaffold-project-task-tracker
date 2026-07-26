"""Task claim, status, release, update, and assignment."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class TaskLifecycleTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.session = self.temp.seed_session("s-1", "alice")
        self.temp.seed_task("T-1", actor="alice")


class ClaimTests(TaskLifecycleTestCase):
    def test_claim_moves_the_task_to_in_progress(self) -> None:
        claimed = self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        self.assertEqual(claimed["status"], "in_progress")
        self.assertEqual(claimed["revision"], 2)
        self.assertTrue(claimed["claimed"])
        self.assertFalse(claimed["idempotent_replay"])

    def test_claim_without_a_session_is_refused_before_the_cli_runs(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1}, session=None
            )
        self.assertEqual(caught.exception.code, "session_required")
        self.assertEqual(caught.exception.http_status, 400)

    def test_claim_replay_is_idempotent(self) -> None:
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        replay = self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        self.assertFalse(replay["claimed"])
        self.assertTrue(replay["idempotent_replay"])
        self.assertEqual(replay["revision"], 2)

    def test_claiming_an_in_progress_task_from_another_session_conflicts(self) -> None:
        self.temp.seed_agent("bob")
        self.temp.seed_session("s-2", "bob")
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/claim", {"agent": "bob", "if_revision": 2}, session="s-2"
            )
        self.assertEqual(caught.exception.http_status, 409)


class StatusTests(TaskLifecycleTestCase):
    def test_stale_revision_carries_the_actual_revision(self) -> None:
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/status",
                {"status": "review", "actor": "alice", "if_revision": 1},
            )
        self.assertEqual(caught.exception.code, "stale_task_revision")
        self.assertEqual(caught.exception.http_status, 409)
        self.assertEqual(caught.exception.details["actual_revision"], 2)

    def test_entering_in_progress_by_status_is_refused(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/status",
                {"status": "in_progress", "actor": "alice", "if_revision": 1},
            )
        self.assertEqual(caught.exception.code, "task_claim_required")

    def test_an_undocumented_transition_is_refused(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/status",
                {"status": "review", "actor": "alice", "if_revision": 1},
            )
        self.assertEqual(caught.exception.code, "invalid_task_transition")
        self.assertIn("allowed", caught.exception.details)

    def test_status_rejects_an_unknown_value(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/status",
                {"status": "archived", "actor": "alice", "if_revision": 1},
            )
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_done_without_evidence_is_refused(self) -> None:
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        self.post(
            "/api/tasks/T-1/status", {"status": "review", "actor": "alice", "if_revision": 2}
        )
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/tasks/T-1/status",
                {"status": "done", "actor": "alice", "if_revision": 3},
            )

    def test_done_succeeds_once_evidence_exists(self) -> None:
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        self.post("/api/evidence", {"task": "T-1", "uri": "file://x", "actor": "alice"})
        self.post(
            "/api/tasks/T-1/status", {"status": "review", "actor": "alice", "if_revision": 2}
        )
        done = self.post(
            "/api/tasks/T-1/status", {"status": "done", "actor": "alice", "if_revision": 3}
        )
        self.assertEqual(done["status"], "done")
        self.assertEqual(done["previous_status"], "review")


class ReleaseTests(TaskLifecycleTestCase):
    def test_release_returns_the_task_to_a_claimable_state(self) -> None:
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        released = self.post(
            "/api/tasks/T-1/release", {"to": "todo", "actor": "alice", "if_revision": 2}
        )
        self.assertEqual(released["status"], "todo")
        self.assertEqual(released["previous_status"], "in_progress")

    def test_release_rejects_a_target_outside_the_allowed_set(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/release",
                {"to": "done", "actor": "alice", "if_revision": 1},
            )
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_release_records_a_note(self) -> None:
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        self.post(
            "/api/tasks/T-1/release",
            {"to": "blocked", "actor": "alice", "if_revision": 2, "note": "waiting on UX"},
        )
        self.assertIn("waiting on UX", self.get("/api/tasks/T-1")["notes"])


class UpdateAndAssignTests(TaskLifecycleTestCase):
    def test_update_requires_a_content_field(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks/T-1/update", {"actor": "alice", "if_revision": 1})
        self.assertIn("content field", caught.exception.message)

    def test_update_increments_the_revision(self) -> None:
        updated = self.post(
            "/api/tasks/T-1/update",
            {"actor": "alice", "if_revision": 1, "title": "renamed"},
        )
        self.assertEqual(updated["revision"], 2)
        self.assertIn("title", updated["updated_fields"])

    def test_update_can_change_priority_alone(self) -> None:
        updated = self.post(
            "/api/tasks/T-1/update", {"actor": "alice", "if_revision": 1, "priority": 5}
        )
        self.assertEqual(updated["updated_fields"], ["priority"])

    def test_update_can_clear_an_optional_field(self) -> None:
        self.post(
            "/api/tasks/T-1/update", {"actor": "alice", "if_revision": 1, "tags": "a,b"}
        )
        self.post("/api/tasks/T-1/update", {"actor": "alice", "if_revision": 2, "tags": ""})
        self.assertEqual(self.get("/api/tasks/T-1")["tags"], "")

    def test_assign_requires_an_add_or_remove(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/tasks/T-1/assign", {"actor": "alice", "if_revision": 1})
        self.assertIn("add or remove", caught.exception.message)

    def test_assign_rejects_overlapping_sets_before_the_cli_runs(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/tasks/T-1/assign",
                {"actor": "alice", "if_revision": 1, "add": ["alice"], "remove": ["alice"]},
            )
        self.assertEqual(caught.exception.details["overlapping"], ["alice"])

    def test_assign_returns_the_sorted_assignee_set(self) -> None:
        self.temp.seed_agent("bob")
        assigned = self.post(
            "/api/tasks/T-1/assign",
            {"actor": "alice", "if_revision": 1, "add": ["bob", "alice"]},
        )
        self.assertEqual(assigned["assignees"], ["alice", "bob"])

    def test_assign_can_remove(self) -> None:
        self.post("/api/tasks/T-1/assign", {"actor": "alice", "if_revision": 1, "add": ["alice"]})
        removed = self.post(
            "/api/tasks/T-1/assign",
            {"actor": "alice", "if_revision": 2, "remove": ["alice"]},
        )
        self.assertEqual(removed["assignees"], [])


if __name__ == "__main__":
    unittest.main()
