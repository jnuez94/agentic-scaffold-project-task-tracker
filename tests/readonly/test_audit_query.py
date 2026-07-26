"""AuditQuery."""

from __future__ import annotations

import unittest

from coordination_ui.readonly import AuditQuery, ReadOnlyConnection
from coordination_ui.readonly.audit_query import DEFAULT_LIMIT, MAX_LIMIT

from ..support import TemporaryProject, cli_available


class ClampTests(unittest.TestCase):
    def test_limit_is_bounded_to_the_contract_range(self) -> None:
        self.assertEqual(AuditQuery.clamp_limit(0), 1)
        self.assertEqual(AuditQuery.clamp_limit(-5), 1)
        self.assertEqual(AuditQuery.clamp_limit(10), 10)
        self.assertEqual(AuditQuery.clamp_limit(10_000), MAX_LIMIT)

    def test_offset_is_never_negative(self) -> None:
        self.assertEqual(AuditQuery.clamp_offset(-1), 0)
        self.assertEqual(AuditQuery.clamp_offset(7), 7)


class BuildWhereTests(unittest.TestCase):
    def test_no_filters_yields_no_clause(self) -> None:
        self.assertEqual(AuditQuery.build_where({}, None), ("", []))

    def test_single_filter_is_parameterized(self) -> None:
        where, params = AuditQuery.build_where({"actor": "david"}, None)
        self.assertEqual(where, " WHERE actor = ?")
        self.assertEqual(params, ["david"])

    def test_filters_are_combined_with_and(self) -> None:
        where, params = AuditQuery.build_where(
            {"actor": "david", "object_type": "task"}, None
        )
        self.assertIn(" AND ", where)
        self.assertEqual(params, ["david", "task"])

    def test_unknown_keys_are_ignored_not_interpolated(self) -> None:
        where, params = AuditQuery.build_where({"; DROP TABLE tasks--": "x"}, None)
        self.assertEqual((where, params), ("", []))

    def test_search_covers_every_searchable_column(self) -> None:
        where, params = AuditQuery.build_where({}, "claim")
        self.assertEqual(where.count("LIKE ?"), 4)
        self.assertEqual(params, ["%claim%"] * 4)

    def test_search_value_stays_a_bound_parameter(self) -> None:
        where, params = AuditQuery.build_where({}, "' OR 1=1--")
        self.assertNotIn("OR 1=1", where)
        self.assertIn("%' OR 1=1--%", params)


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class FetchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.temp.seed_task("T-1", actor="alice")
        self.temp.seed_task("T-2", actor="bob")
        self.query = AuditQuery(ReadOnlyConnection(self.temp.database))

    def test_returns_entries_and_total(self) -> None:
        page = self.query.fetch()
        self.assertEqual(page["total"], 4)
        self.assertEqual(len(page["entries"]), 4)

    def test_entries_are_newest_first(self) -> None:
        ids = [entry["id"] for entry in self.query.fetch()["entries"]]
        self.assertEqual(ids, sorted(ids, reverse=True))

    def test_entry_shape_matches_the_audit_columns(self) -> None:
        entry = self.query.fetch(limit=1)["entries"][0]
        self.assertEqual(
            set(entry),
            {
                "id",
                "actor",
                "session_id",
                "action",
                "object_type",
                "object_id",
                "detail",
                "created_at",
            },
        )

    def test_filters_by_actor(self) -> None:
        page = self.query.fetch(actor="alice")
        self.assertEqual(page["total"], 2)
        self.assertTrue(all(e["actor"] == "alice" for e in page["entries"]))

    def test_filters_by_object_type(self) -> None:
        self.assertEqual(self.query.fetch(object_type="task")["total"], 2)

    def test_filters_by_object_id(self) -> None:
        self.assertEqual(self.query.fetch(object_id="T-1")["total"], 1)

    def test_search_matches_object_id(self) -> None:
        self.assertEqual(self.query.fetch(search="T-2")["total"], 1)

    def test_total_ignores_paging(self) -> None:
        page = self.query.fetch(limit=1)
        self.assertEqual(page["total"], 4)
        self.assertEqual(len(page["entries"]), 1)

    def test_offset_pages_through_results(self) -> None:
        first = self.query.fetch(limit=2)["entries"]
        second = self.query.fetch(limit=2, offset=2)["entries"]
        self.assertEqual(len(second), 2)
        self.assertFalse({e["id"] for e in first} & {e["id"] for e in second})

    def test_offset_past_the_end_is_empty(self) -> None:
        self.assertEqual(self.query.fetch(offset=500)["entries"], [])

    def test_reports_the_clamped_paging_back(self) -> None:
        page = self.query.fetch(limit=9999, offset=-3)
        self.assertEqual(page["limit"], MAX_LIMIT)
        self.assertEqual(page["offset"], 0)

    def test_default_limit_is_applied(self) -> None:
        self.assertEqual(self.query.fetch()["limit"], DEFAULT_LIMIT)

    def test_facets_list_distinct_values(self) -> None:
        facets = self.query.fetch()["facets"]
        self.assertEqual(facets["actors"], ["alice", "bob"])
        self.assertIn("task", facets["object_types"])
        self.assertEqual(facets["actions"], sorted(facets["actions"]))

    def test_empty_database_returns_an_empty_page(self) -> None:
        with TemporaryProject() as empty:
            page = AuditQuery(ReadOnlyConnection(empty.database)).fetch()
        self.assertEqual(page["total"], 0)
        self.assertEqual(page["entries"], [])
        self.assertEqual(page["facets"]["actors"], [])


if __name__ == "__main__":
    unittest.main()
