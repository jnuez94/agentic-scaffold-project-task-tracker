"""AuditWindow against a scripted CLI, so the paging arithmetic is tested alone."""

from __future__ import annotations

import unittest
from typing import Any

from coordination_ui.api.audit_window import PAGE_SIZE, AuditWindow
from coordination_ui.cli import ArgumentBuilder

FLAG_FIELDS = {"--actor": "actor", "--object-id": "object_id"}


def options_of(args: list[str]) -> dict[str, str]:
    """The ``--flag`` options in a builder's argv, however the builder spells them."""

    options: dict[str, str] = {}
    pending: str | None = None
    for token in args:
        if pending is not None:
            options[pending], pending = token, None
        elif token.startswith("--"):
            flag, separator, value = token.partition("=")
            if separator:
                options[flag] = value
            else:
                pending = flag
    return options


class FakeLog:
    """Answers ``summary --section totals`` and ``audit list`` over an in-memory log."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.calls: list[list[str]] = []

    def __call__(self, builder: ArgumentBuilder) -> Any:
        args = builder.args
        self.calls.append(args)
        if args[0] == "summary":
            return {"audit_cursor": self.rows[-1]["id"] if self.rows else 0}
        options = options_of(args)
        since, limit = int(options["--since"]), int(options["--limit"])
        wanted = {
            FLAG_FIELDS[flag]: value for flag, value in options.items() if flag in FLAG_FIELDS
        }
        matched = [
            row
            for row in self.rows
            if row["id"] > since and all(row[field] == value for field, value in wanted.items())
        ]
        return matched[:limit]


def log(count: int) -> FakeLog:
    return FakeLog(
        [
            {
                "id": index,
                "actor": "alice" if index % 3 else "bob",
                "object_id": f"T-{index % 7}",
                # Every fourth row is a heartbeat, so a 500-row page keeps 375.
                "action": "heartbeat" if index % 4 == 0 else "status",
            }
            for index in range(1, count + 1)
        ]
    )


def ids(rows: list[dict[str, Any]]) -> list[int]:
    return [row["id"] for row in rows]


class UnfilteredWindowTests(unittest.TestCase):
    def test_returns_the_newest_rows_newest_first(self) -> None:
        cli = log(1200)
        self.assertEqual(ids(AuditWindow(cli, 5, {}).rows()), [1200, 1199, 1198, 1197, 1196])

    def test_costs_one_summary_and_one_list_call(self) -> None:
        cli = log(1200)
        AuditWindow(cli, 100, {}).rows()
        self.assertEqual([call[0] for call in cli.calls], ["summary", "audit"])
        self.assertEqual(options_of(cli.calls[1]), {"--since": "1100", "--limit": "100"})

    def test_a_limit_beyond_the_log_returns_everything(self) -> None:
        cli = log(7)
        self.assertEqual(ids(AuditWindow(cli, 100, {}).rows()), [7, 6, 5, 4, 3, 2, 1])
        self.assertEqual(options_of(cli.calls[1])["--since"], "0")

    def test_an_empty_log_is_an_empty_window(self) -> None:
        self.assertEqual(AuditWindow(log(0), 10, {}).rows(), [])

    def test_before_pages_back_without_asking_for_the_head(self) -> None:
        cli = log(1200)
        rows = AuditWindow(cli, 5, {}, before=700).rows()
        self.assertEqual(ids(rows), [699, 698, 697, 696, 695])
        self.assertEqual([call[0] for call in cli.calls], ["audit"])
        self.assertEqual(options_of(cli.calls[0]), {"--since": "694", "--limit": "5"})

    def test_before_near_the_beginning_returns_only_what_exists(self) -> None:
        cli = log(1200)
        self.assertEqual(ids(AuditWindow(cli, 5, {}, before=3).rows()), [2, 1])
        self.assertEqual(AuditWindow(cli, 5, {}, before=1).rows(), [])


class ExcludedActionTests(unittest.TestCase):
    def test_the_window_is_limit_surviving_rows_not_limit_rows(self) -> None:
        cli = log(1200)
        rows = AuditWindow(cli, 5, {}, exclude_actions=("heartbeat",)).rows()
        self.assertEqual(ids(rows), [1199, 1198, 1197, 1195, 1194])
        self.assertTrue(all(row["action"] != "heartbeat" for row in rows))

    def test_walks_back_a_page_at_a_time_until_enough_survive(self) -> None:
        # 500 survivors need 667 rows: page one (701..1200) keeps 375, page
        # two (201..700) supplies the rest. Two list calls after summary.
        cli = log(1200)
        rows = AuditWindow(cli, 500, {}, exclude_actions=("heartbeat",)).rows()
        self.assertEqual(len(rows), 500)
        self.assertEqual([call[0] for call in cli.calls], ["summary", "audit", "audit"])
        self.assertEqual(options_of(cli.calls[1]), {"--since": "700", "--limit": "500"})
        self.assertEqual(options_of(cli.calls[2]), {"--since": "200", "--limit": "500"})
        self.assertEqual(ids(rows)[-1], 534)

    def test_stops_at_the_beginning_of_the_log(self) -> None:
        cli = log(10)
        rows = AuditWindow(cli, 20, {}, exclude_actions=("heartbeat",)).rows()
        self.assertEqual(ids(rows), [10 - i for i in range(10) if (10 - i) % 4])
        self.assertEqual(len(cli.calls), 2)

    def test_composes_with_before(self) -> None:
        cli = log(1200)
        rows = AuditWindow(cli, 3, {}, before=9, exclude_actions=("heartbeat",)).rows()
        self.assertEqual(ids(rows), [7, 6, 5])

    def test_applies_to_the_filtered_walk_too(self) -> None:
        cli = log(1200)
        rows = AuditWindow(cli, 3, {"--actor": "bob"}, exclude_actions=("heartbeat",)).rows()
        # bob is every third row; 1200 and 1188 are heartbeats and drop out.
        self.assertEqual(ids(rows), [1197, 1194, 1191])


class FilteredWindowTests(unittest.TestCase):
    def test_returns_the_newest_matches_across_the_whole_log(self) -> None:
        # bob is every third row; the newest three are 1200, 1197 and 1194,
        # and none of them sit in the newest three audit ids.
        cli = log(1200)
        rows = AuditWindow(cli, 3, {"--actor": "bob"}).rows()
        self.assertEqual(ids(rows), [1200, 1197, 1194])
        self.assertEqual({row["actor"] for row in rows}, {"bob"})

    def test_walks_forward_one_page_per_page_of_matches(self) -> None:
        cli = log(1200)
        AuditWindow(cli, 3, {"--actor": "bob"}).rows()  # 400 matches: one page
        self.assertEqual([call[0] for call in cli.calls], ["audit"])
        self.assertEqual(
            options_of(cli.calls[0]),
            {"--since": "0", "--limit": str(PAGE_SIZE), "--actor": "bob"},
        )

        cli = log(1200)
        AuditWindow(cli, 3, {"--actor": "alice"}).rows()  # 800 matches: two pages
        self.assertEqual(len(cli.calls), 2)
        # The cursor for page two is the last id page one returned: alice is
        # two rows in every three, so the 500th match is id 749.
        self.assertEqual(options_of(cli.calls[1])["--since"], "749")

    def test_a_single_record_history_is_one_call_and_complete(self) -> None:
        cli = log(1200)
        rows = AuditWindow(cli, 50, {"--object-id": "T-0"}).rows()
        self.assertEqual(len(cli.calls), 1)
        self.assertEqual(ids(rows)[:3], [1197, 1190, 1183])
        self.assertEqual(len(rows), 50)

    def test_no_match_is_an_empty_window(self) -> None:
        self.assertEqual(AuditWindow(log(30), 10, {"--object-id": "nope"}).rows(), [])

    def test_before_keeps_only_matches_below_it_and_stops_walking(self) -> None:
        cli = log(1200)
        rows = AuditWindow(cli, 3, {"--actor": "alice"}, before=600).rows()
        self.assertEqual(ids(rows), [599, 598, 596])
        # alice has 800 matches, two pages without a bound; page one already
        # reaches past id 600, so the walk stops there instead of reading on.
        self.assertEqual(len(cli.calls), 1)


if __name__ == "__main__":
    unittest.main()
