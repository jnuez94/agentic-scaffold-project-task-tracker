"""Resolving an escalation from the console (UI-82): compare-and-swap and cause."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class ResolveTestCase(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_session("s-1", "alice")
        self.session = "s-1"
        self.post(
            "/api/escalations",
            {
                "id": "ESC-1",
                "raised_by": "alice",
                "owner": "alice",
                "related_tasks": "T-1",
                "issue": "Ambiguous scope",
                "requested_decision": "Confirm the boundary",
            },
        )

    def resolve(self, **fields: object) -> dict[str, object]:
        body = {"resolution": "Boundary confirmed by alice.", "actor": "alice", **fields}
        result: dict[str, object] = self.post("/api/escalations/ESC-1/resolve", body)
        return result

    def detail_of_last_resolve(self) -> str:
        rows = self.get(
            "/api/audit", object_type="escalation", object_id="ESC-1", action="resolve"
        )
        detail: str = rows[0]["detail"]
        return detail


class IfStatusTests(ResolveTestCase):
    def test_resolves_when_the_loaded_status_still_holds(self) -> None:
        self.assertEqual(self.resolve(if_status="open")["status"], "resolved")

    def test_refuses_an_escalation_answered_in_the_meantime(self) -> None:
        self.resolve(if_status="open")
        with self.assertRaises(CoordinationError) as caught:
            self.resolve(if_status="open", status="closed_no_action")
        self.assertEqual(caught.exception.code, "status_mismatch")
        self.assertEqual(caught.exception.http_status, 409)
        self.assertEqual(self.get("/api/escalations/ESC-1")["status"], "resolved")

    def test_an_unknown_status_is_refused_before_the_cli_runs(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.resolve(if_status="pending")
        self.assertEqual(caught.exception.http_status, 400)


class BecauseTests(ResolveTestCase):
    def test_the_cause_is_written_into_the_audit_detail(self) -> None:
        self.resolve(if_status="open", because="task:T-1")
        self.assertEqual(self.detail_of_last_resolve(), "open -> resolved; because=task:T-1")

    def test_a_cause_that_does_not_exist_is_refused(self) -> None:
        with self.assertRaises(CoordinationError):
            self.resolve(if_status="open", because="task:T-404")
        self.assertEqual(self.get("/api/escalations/ESC-1")["status"], "open")


if __name__ == "__main__":
    unittest.main()
