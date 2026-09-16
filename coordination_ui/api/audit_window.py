"""Composing ``audit list`` into the newest window the console shows."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
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

    ``before`` names an audit id and asks for the window preceding it, which
    is how a client pages back through the log: the head is then ``before``
    rather than the cursor, and the filtered walk keeps only rows below it.

    ``exclude_actions`` drops rows by action after the CLI has answered — the
    CLI filters by exact match only and has no negation. Unfiltered, that
    turns the one-call window into a walk backwards from the head in pages of
    the CLI's maximum until ``limit`` rows survive or the log begins, so the
    window is ``limit`` coordination events rather than ``limit`` rows. Three
    sessions heartbeating once a minute fill 500 rows in under three hours;
    excluding them client-side would leave a window of mostly nothing.
    """

    def __init__(
        self,
        run: Runner,
        limit: int,
        filters: Mapping[str, str],
        before: int | None = None,
        exclude_actions: Iterable[str] = (),
    ) -> None:
        self.run = run
        self.limit = limit
        self.filters = dict(filters)
        self.before = before
        self.exclude_actions = frozenset(exclude_actions)

    def rows(self) -> list[dict[str, Any]]:
        rows = self._newest_matching() if self.filters else self._newest_unfiltered()
        return list(reversed(rows))

    # -- the two recipes ----------------------------------------------------

    def _newest_unfiltered(self) -> list[dict[str, Any]]:
        if self.before is None:
            totals = self.run(ArgumentBuilder("summary").option("--section", "totals"))
            head = int(totals.get("audit_cursor") or 0)
        else:
            head = self.before - 1
        if not self.exclude_actions:
            since = max(0, head - self.limit)
            # Capped to the ids that exist below the head, so a window at the
            # beginning of the log cannot spill into rows past ``before``.
            count = min(self.limit, head - since)
            return self._page(since=since, limit=count) if count > 0 else []
        kept: list[dict[str, Any]] = []
        while head > 0 and len(kept) < self.limit:
            since = max(0, head - PAGE_SIZE)
            page = self._page(since=since, limit=head - since)
            kept = self._survivors(page) + kept
            head = since
        return kept[-self.limit :]

    def _newest_matching(self) -> list[dict[str, Any]]:
        since = 0
        kept: list[dict[str, Any]] = []
        while True:
            page = self._page(since=since, limit=PAGE_SIZE)
            usable = (
                page
                if self.before is None
                else [row for row in page if int(row["id"]) < self.before]
            )
            kept = (kept + self._survivors(usable))[-self.limit :]
            if len(page) < PAGE_SIZE or len(usable) < len(page):
                return kept
            since = int(page[-1]["id"])

    def _survivors(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not self.exclude_actions:
            return rows
        return [row for row in rows if row.get("action") not in self.exclude_actions]

    def _page(self, *, since: int, limit: int) -> list[dict[str, Any]]:
        builder = ArgumentBuilder("audit", "list")
        builder.option("--since", str(since)).option("--limit", str(limit))
        for flag, value in self.filters.items():
            builder.option(flag, value)
        return list(self.run(builder))
