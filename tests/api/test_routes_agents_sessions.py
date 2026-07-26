"""Agent and session routes."""

from __future__ import annotations

import unittest

from coordination_ui.api import build_router
from coordination_ui.cli import CoordinationError

from ..support import TemporaryProject, cli_available


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class RouteTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.router = build_router(self.temp.project(), self.temp.cli())
        self.session: str | None = None

    def get(self, path: str, **query: str) -> object:
        return self.router.dispatch(
            "GET", path, {k: [v] for k, v in query.items()}, {}, self.session
        )

    def post(self, path: str, body: dict[str, object]) -> object:
        return self.router.dispatch("POST", path, {}, body, self.session)


class AgentRouteTests(RouteTestCase):
    def test_create_bootstraps_without_an_actor(self) -> None:
        created = self.post(
            "/api/agents", {"id": "alice", "name": "Alice", "role": "Engineer"}
        )
        self.assertEqual(created["id"], "alice")
        self.assertEqual(created["actor_type"], "ai")

    def test_create_accepts_the_full_profile(self) -> None:
        self.post(
            "/api/agents",
            {
                "id": "bob",
                "name": "Bob",
                "role": "Reviewer",
                "actor_type": "human",
                "goal": "Review things",
                "review_authority": "Frontend only",
            },
        )
        agent = next(a for a in self.get("/api/agents") if a["id"] == "bob")
        self.assertEqual(agent["actor_type"], "human")
        self.assertEqual(agent["review_authority"], "Frontend only")

    def test_create_rejects_an_invalid_actor_type(self) -> None:
        with self.assertRaises(CoordinationError):
            self.post(
                "/api/agents",
                {"id": "x", "name": "X", "role": "r", "actor_type": "robot"},
            )

    def test_create_rejects_an_invalid_identifier(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/agents", {"id": "--actor", "name": "X", "role": "r"})
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_list_hides_inactive_agents_by_default(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.post("/api/agents/bob", {"status": "inactive", "actor": "alice"})
        self.assertEqual([a["id"] for a in self.get("/api/agents")], ["alice"])

    def test_list_all_includes_inactive_agents(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.post("/api/agents/bob", {"status": "inactive", "actor": "alice"})
        self.assertEqual(len(self.get("/api/agents", all="1")), 2)

    def test_list_filters_by_actor_type(self) -> None:
        self.temp.seed_agent("alice")
        self.assertEqual(len(self.get("/api/agents", actor_type="ai")), 1)
        self.assertEqual(self.get("/api/agents", actor_type="human"), [])

    def test_update_requires_a_changed_field(self) -> None:
        self.temp.seed_agent("alice")
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/agents/alice", {"actor": "alice"})
        self.assertIn("changed field", caught.exception.message)

    def test_update_returns_the_complete_row(self) -> None:
        self.temp.seed_agent("alice")
        updated = self.post("/api/agents/alice", {"role": "Principal"})
        self.assertEqual(updated["role"], "Principal")
        self.assertIn("created_at", updated)


class SessionRouteTests(RouteTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.temp.seed_agent("alice")

    def test_start_returns_an_active_session(self) -> None:
        started = self.post(
            "/api/sessions", {"id": "s-1", "agent": "alice", "harness": "pytest"}
        )
        self.assertEqual(started["status"], "active")
        self.assertEqual(started["agent_id"], "alice")

    def test_start_defaults_the_model_to_empty(self) -> None:
        started = self.post(
            "/api/sessions", {"id": "s-2", "agent": "alice", "harness": "pytest"}
        )
        self.assertEqual(started["model"], "")

    def test_start_rejects_an_unknown_agent(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/sessions", {"id": "s-3", "agent": "ghost", "harness": "pytest"}
            )
        self.assertEqual(caught.exception.http_status, 404)

    def test_list_filters_by_status_and_agent(self) -> None:
        self.temp.seed_session("s-4", "alice")
        self.assertEqual(len(self.get("/api/sessions", status="active")), 1)
        self.assertEqual(self.get("/api/sessions", status="ended"), [])
        self.assertEqual(len(self.get("/api/sessions", agent="alice")), 1)

    def test_heartbeat_keeps_the_session_active(self) -> None:
        self.temp.seed_session("s-5", "alice")
        self.assertEqual(self.post("/api/sessions/s-5/heartbeat", {})["status"], "active")

    def test_end_closes_the_session(self) -> None:
        self.temp.seed_session("s-6", "alice")
        self.assertEqual(self.post("/api/sessions/s-6/end", {})["status"], "ended")

    def test_end_is_blocked_while_a_claim_is_held(self) -> None:
        self.temp.seed_session("s-7", "alice")
        self.temp.seed_task("T-1", actor="alice")
        self.session = "s-7"
        self.post("/api/tasks/T-1/claim", {"agent": "alice", "if_revision": 1})
        with self.assertRaises(CoordinationError) as caught:
            self.post("/api/sessions/s-7/end", {})
        self.assertEqual(caught.exception.code, "session_has_active_claims")
        self.assertEqual(caught.exception.details["tasks"], ["T-1"])

    def test_recover_requires_a_reason(self) -> None:
        self.temp.seed_session("s-8", "alice")
        with self.assertRaises(CoordinationError):
            self.post("/api/sessions/s-8/recover", {"actor": "alice"})

    def test_recover_refuses_a_session_that_is_not_stale(self) -> None:
        self.temp.seed_session("s-9", "alice")
        with self.assertRaises(CoordinationError) as caught:
            self.post(
                "/api/sessions/s-9/recover",
                {"actor": "alice", "reason": "stuck", "stale_after_seconds": 3600},
            )
        self.assertEqual(caught.exception.code, "session_not_stale")

    def test_recover_ends_a_stale_session(self) -> None:
        self.temp.seed_session("s-10", "alice")
        recovered = self.post(
            "/api/sessions/s-10/recover",
            {"actor": "alice", "reason": "harness died", "stale_after_seconds": 0},
        )
        self.assertEqual(recovered["status"], "ended")
        self.assertEqual(recovered["recovered_tasks"], [])


if __name__ == "__main__":
    unittest.main()
