"""Composing ``audit list`` into the newest window the console shows."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from ..cli import ArgumentBuilder

Runner = Callable[[ArgumentBuilder], Any]

# The CLI's maximum --limit; a page of this size is the cheapest full step.
PAGE_SIZE = 500


class AuditWindow:
    """The newest ``limit`` audit rows, newest first, read through the CLI.

    ``audit list`` lists ascending from an exclusive cursor and has no
    descending order, so "newest first" is composed here rather than asked
    for. Unfiltered, the head cursor from ``summary --section totals`` puts
    the newest window one list call away. Filtered, the matches are walked
    forward in pages of the CLI's maximum, keeping only the newest ``limit``:
    one call per 500 matches, so a single record's history is one call and
    complete, however old the record is.
    """

    def __init__(self, run: Runner, limit: int, filters: Mapping[str, str]) -> None:
        self.run = run
        self.limit = limit
        self.filters = dict(filters)

    def rows(self) -> list[dict[str, Any]]:
        rows = self._newest_matching() if self.filters else self._newest_unfiltered()
        return list(reversed(rows))

    # -- the two recipes ----------------------------------------------------

    def _newest_unfiltered(self) -> list[dict[str, Any]]:
        totals = self.run(ArgumentBuilder("summary").option("--section", "totals"))
        head = int(totals.get("audit_cursor") or 0)
        return self._page(since=max(0, head - self.limit), limit=self.limit)

    def _newest_matching(self) -> list[dict[str, Any]]:
        since = 0
        kept: list[dict[str, Any]] = []
        while True:
            page = self._page(since=since, limit=PAGE_SIZE)
            kept = (kept + page)[-self.limit :]
            if len(page) < PAGE_SIZE:
                return kept
            since = int(page[-1]["id"])

    def _page(self, *, since: int, limit: int) -> list[dict[str, Any]]:
        builder = ArgumentBuilder("audit", "list")
        builder.option("--since", str(since)).option("--limit", str(limit))
        for flag, value in self.filters.items():
            builder.option(flag, value)
        return list(self.run(builder))
