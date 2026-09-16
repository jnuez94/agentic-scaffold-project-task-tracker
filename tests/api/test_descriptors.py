"""The descriptor table: what reaches argv as --where and --order-by, and what does not."""

from __future__ import annotations

import unittest

from coordination_ui.api.descriptors import (
    ENTITIES,
    KIND_OPERATORS,
    parse_order_by,
    parse_updated_since,
    parse_where,
)
from coordination_ui.cli import ArgumentError


class WhereTests(unittest.TestCase):
    def test_a_listed_column_with_an_allowed_operator_passes_through_unchanged(self) -> None:
        self.assertEqual(parse_where("task", "status:in=todo,review"), "status:in=todo,review")
        self.assertEqual(parse_where("task", "priority:le=2"), "priority:le=2")
        self.assertEqual(parse_where("agent", "name:eq=Alice"), "name:eq=Alice")

    def test_an_unlisted_column_is_refused_naming_the_allowed_ones(self) -> None:
        with self.assertRaises(ArgumentError) as caught:
            parse_where("task", "description:eq=x")
        self.assertEqual(caught.exception.details["field"], "where")
        self.assertIn("status", caught.exception.details["columns"])

    def test_operators_follow_the_column_kind(self) -> None:
        with self.assertRaises(ArgumentError):
            parse_where("task", "title:in=a,b")  # text takes eq, ne
        with self.assertRaises(ArgumentError):
            parse_where("task", "created_at:eq=2026-01-01T00:00:00+00:00")  # timestamps: ge, le
        with self.assertRaises(ArgumentError):
            parse_where("task", "priority:in=1,2")  # integers: eq, ne, ge, le

    def test_timestamps_must_be_the_contract_s_utc_form(self) -> None:
        self.assertEqual(
            parse_where("task", "updated_at:ge=2026-01-31T12:00:00+00:00"),
            "updated_at:ge=2026-01-31T12:00:00+00:00",
        )
        for bad in ("updated_at:ge=2026-01-31T12:00:00Z", "updated_at:ge=2026-01-31"):
            with self.assertRaises(ArgumentError):
                parse_where("task", bad)

    def test_malformed_clauses_are_refused(self) -> None:
        for bad in ("status", "status=todo", ":eq=x", "status:eq="):
            with self.assertRaises(ArgumentError):
                parse_where("task", bad)


class OrderByTests(unittest.TestCase):
    def test_orderable_columns_with_an_optional_direction(self) -> None:
        self.assertEqual(parse_order_by("task", "priority"), "priority")
        self.assertEqual(parse_order_by("task", "updated_at:desc"), "updated_at:desc")

    def test_unorderable_columns_and_bad_directions_are_refused(self) -> None:
        with self.assertRaises(ArgumentError):
            parse_order_by("evidence", "task_id")  # filterable, not orderable
        with self.assertRaises(ArgumentError):
            parse_order_by("task", "priority:down")


class UpdatedSinceTests(unittest.TestCase):
    def test_only_entities_with_updated_at(self) -> None:
        self.assertEqual(
            parse_updated_since("decision", "2026-01-31T12:00:00+00:00"),
            "2026-01-31T12:00:00+00:00",
        )
        with self.assertRaises(ArgumentError):
            parse_updated_since("session", "2026-01-31T12:00:00+00:00")
        with self.assertRaises(ArgumentError):
            parse_updated_since("decision", "2026-01-31")


class TableTests(unittest.TestCase):
    def test_every_entity_lists_id_and_every_kind_has_operators(self) -> None:
        for name, descriptor in ENTITIES.items():
            with self.subTest(entity=name):
                self.assertIn("id", descriptor.filterable)
                for kind in descriptor.filterable.values():
                    self.assertIn(kind, KIND_OPERATORS)

    def test_the_five_with_updated_at_match_the_contract(self) -> None:
        with_updated = sorted(name for name, d in ENTITIES.items() if d.has_updated_at)
        self.assertEqual(with_updated, ["agent", "artifact", "decision", "escalation", "task"])


if __name__ == "__main__":
    unittest.main()
