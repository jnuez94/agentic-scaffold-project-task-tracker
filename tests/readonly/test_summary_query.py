"""SummaryQuery and the ReadOnlyDatabase facade."""

from __future__ import annotations

import unittest

from coordination_ui.readonly import (
    COUNTED_TABLES,
    ReadOnlyConnection,
    ReadOnlyDatabase,
    SummaryQuery,
)

from ..support import TemporaryProject, cli_available


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class EmptyDatabaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.summary = SummaryQuery(ReadOnlyConnection(self.temp.database)).fetch()

    def test_counts_every_table_as_zero(self) -> None:
        self.assertEqual(set(self.summary["totals"]), set(COUNTED_TABLES))
        self.assertEqual(set(self.summary["totals"].values()), {0})

    def test_histograms_are_empty(self) -> None:
        self.assertEqual(self.summary["task_status"], {})
        self.assertEqual(self.summary["escalation_status"], {})

    def test_collections_are_empty(self) -> None:
        self.assertEqual(self.summary["workload"], [])
        self.assertEqual(self.summary["recent_audit"], [])


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class PopulatedDatabaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.temp.seed_agent("alice")
        self.temp.seed_agent("bob")
        self.temp.seed_task("T-1", actor="alice", priority="1", assignee="alice")
        self.temp.seed_task("T-2", actor="alice", priority="1", assignee="bob")
        self.temp.seed_task("T-3", actor="bob", priority="4")
        self.summary = ReadOnlyDatabase(self.temp.database).summary()

    def test_totals_reflect_seeded_rows(self) -> None:
        self.assertEqual(self.summary["totals"]["agents"], 2)
        self.assertEqual(self.summary["totals"]["tasks"], 3)

    def test_task_status_histogram(self) -> None:
        self.assertEqual(self.summary["task_status"], {"todo": 3})

    def test_task_priority_keys_are_strings_for_json(self) -> None:
        self.assertEqual(self.summary["task_priority"], {"1": 2, "4": 1})
        for key in self.summary["task_priority"]:
            self.assertIsInstance(key, str)

    def test_workload_counts_assignments_per_agent(self) -> None:
        workload = {row["agent_id"]: row for row in self.summary["workload"]}
        self.assertEqual(workload["alice"]["assigned"], 1)
        self.assertEqual(workload["bob"]["assigned"], 1)

    def test_workload_includes_unassigned_agents(self) -> None:
        self.temp.seed_agent("carol")
        summary = ReadOnlyDatabase(self.temp.database).summary()
        workload = {row["agent_id"]: row for row in summary["workload"]}
        self.assertEqual(workload["carol"]["assigned"], 0)

    def test_workload_is_ordered_by_assignment_count(self) -> None:
        counts = [row["assigned"] for row in self.summary["workload"]]
        self.assertEqual(counts, sorted(counts, reverse=True))

    def test_recent_audit_is_capped_and_newest_first(self) -> None:
        entries = self.summary["recent_audit"]
        self.assertLessEqual(len(entries), 12)
        ids = [entry["id"] for entry in entries]
        self.assertEqual(ids, sorted(ids, reverse=True))

    def test_totals_are_plain_ints(self) -> None:
        for value in self.summary["totals"].values():
            self.assertIsInstance(value, int)


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class ReadOnlyDatabaseFacadeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.database = ReadOnlyDatabase(self.temp.database)

    def test_exposes_the_database_path(self) -> None:
        self.assertEqual(self.database.database, self.temp.database)

    def test_audit_delegates_with_keyword_arguments(self) -> None:
        self.temp.seed_agent("alice")
        page = self.database.audit(limit=1, actor="alice")
        self.assertEqual(page["limit"], 1)
        self.assertEqual(page["total"], 1)

    def test_summary_delegates(self) -> None:
        self.assertIn("totals", self.database.summary())


if __name__ == "__main__":
    unittest.main()
