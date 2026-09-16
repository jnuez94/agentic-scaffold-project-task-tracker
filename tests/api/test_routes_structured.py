"""--where, --order-by, --updated-since and the repeatable task status, end to end."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CoordinationError

from .route_case import RouteTestCase


class StructuredFilterTests(RouteTestCase):
    def seed(self) -> None:
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.temp.seed_task("T-1", actor="alice", priority="1")
        self.temp.seed_task("T-2", actor="bob", priority="3")
        self.temp.seed_task("T-3", actor="alice", priority="2")
        self.temp.seed_session("s-1", "alice")
        self.session = "s-1"
        self.post("/api/tasks/T-3/claim", {"agent": "alice", "if_revision": 1})

    def ids(self, path: str, **query: str | list[str]) -> list[str]:
        flat = {
            key: ([value] if isinstance(value, str) else value) for key, value in query.items()
        }
        rows = self.router.dispatch("GET", path, flat, {}, self.session)
        return [row["id"] for row in rows]

    def test_status_is_repeatable_so_open_work_is_one_request(self) -> None:
        self.post(
            "/api/tasks/T-1/assign", {"actor": "alice", "if_revision": 1, "add": ["alice"]}
        )
        # The CLI's order: priority, then updated_at, then id.
        self.assertEqual(
            self.ids("/api/tasks", status=["todo", "in_progress"]), ["T-1", "T-3", "T-2"]
        )
        self.assertEqual(self.ids("/api/tasks", status="in_progress"), ["T-3"])

    def test_a_bad_status_is_refused_before_argv(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.ids("/api/tasks", status=["todo", "finished"])
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_where_narrows_the_request(self) -> None:
        self.assertEqual(self.ids("/api/tasks", where="created_by:eq=bob"), ["T-2"])
        self.assertEqual(sorted(self.ids("/api/tasks", where="priority:le=2")), ["T-1", "T-3"])
        self.assertEqual(
            self.ids("/api/tasks", where=["created_by:eq=alice", "priority:ge=2"]), ["T-3"]
        )

    def test_order_by_reorders_the_request(self) -> None:
        self.assertEqual(
            self.ids("/api/tasks", order_by="priority:desc"), ["T-2", "T-3", "T-1"]
        )

    def test_updated_since_where_the_entity_has_it(self) -> None:
        self.assertEqual(
            self.ids("/api/tasks", updated_since="2000-01-01T00:00:00+00:00"),
            self.ids("/api/tasks"),
        )
        self.assertEqual(self.ids("/api/tasks", updated_since="2999-01-01T00:00:00+00:00"), [])
        with self.assertRaises(CoordinationError) as caught:
            self.ids("/api/sessions", updated_since="2000-01-01T00:00:00+00:00")
        self.assertEqual(caught.exception.details["field"], "updated_since")

    def test_an_unlisted_column_never_reaches_the_cli(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.ids("/api/tasks", where="description:eq=x")
        self.assertEqual(caught.exception.code, "invalid_arguments")
        self.assertEqual(caught.exception.details["field"], "where")

    def test_every_other_list_takes_where(self) -> None:
        self.assertEqual(self.ids("/api/agents", where="id:eq=bob"), ["bob"])
        self.assertEqual(self.ids("/api/sessions", where="agent_id:eq=alice"), ["s-1"])
        self.assertEqual(self.ids("/api/decisions", where="status:eq=proposed"), [])

    def test_tag_is_one_token(self) -> None:
        self.temp.seed_task("T-4", actor="alice", tags="frontend, urgent")
        self.assertEqual(self.ids("/api/tasks", tag="frontend"), ["T-4"])
        with self.assertRaises(CoordinationError):
            self.ids("/api/tasks", tag="frontend, urgent")

    def test_audit_ignores_the_structured_parameters(self) -> None:
        # Excluded by name: the audit list takes neither --where nor --order-by,
        # and the route never forwards them.
        rows = self.router.dispatch(
            "GET", "/api/audit", {"where": ["actor:eq=alice"], "limit": ["5"]}, {}, None
        )
        self.assertGreater(len(rows), 0)


if __name__ == "__main__":
    unittest.main()
