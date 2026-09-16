"""Inbox routes (1.4.0).

An agent's inbox is the messages addressed to it or to ``team`` whose send
audit id is above the agent's cursor — a read position the agent asserts about
itself, never advanced by listing. The console shows it for the acting actor
and moves the cursor only on an explicit request, with the head the same list
call returned, so viewing can never be mistaken for reading.
"""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
from ..request import Request


def list_inbox(request: Request) -> Any:
    """``inbox list --agent``. The owner is required: an inbox has one."""

    builder = ArgumentBuilder("inbox", "list")
    builder.option("--agent", request.q_identifier("agent") or _missing_agent())
    return request.run(request.paging(builder))


def mark_inbox_read(request: Request) -> Any:
    """``inbox mark-read``: forward only; the CLI refuses a cursor behind the
    current one (``cursor_not_monotonic``) or past the head."""

    body = request.body
    builder = ArgumentBuilder("inbox", "mark-read")
    builder.identifier(body, "agent", "--agent", required=True)
    builder.integer(body, "cursor", "--cursor", required=True)
    return request.run(builder, with_session=True)


def _missing_agent() -> str:
    from ...cli import ArgumentError

    raise ArgumentError("query parameter 'agent' is required: an inbox has an owner")


ROUTES = (
    ("GET", r"/api/inbox", list_inbox),
    ("POST", r"/api/inbox/mark-read", mark_inbox_read),
)
