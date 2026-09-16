"""Task routes.

Three local pre-checks exist here — a claim needs a session, an assignment
needs non-overlapping add/remove, an update needs one content field. They
produce a clearer message than a generic argparse failure; the CLI still
enforces all three independently.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from ...cli import ArgumentBuilder, ArgumentError, CoordinationError, require_choice
from ..enums import RELEASE_TARGETS, TASK_STATUSES
from ..request import Request

CONTENT_FIELDS = (
    ("title", "--title"),
    ("description", "--description"),
    ("tags", "--tags"),
    ("acceptance", "--acceptance"),
    ("next_steps", "--next-steps"),
    ("blocked_claims", "--blocked-claims"),
)


TAG_TOKEN = re.compile(r"^[^\s,]+$")

# ``--because TYPE:ID`` (1.4.0): the record a status change follows from. The
# CLI checks the record exists; the console checks only that it is a known
# type and an identifier, so nothing unshaped reaches argv.
BECAUSE = re.compile(
    r"^(review|decision|message|task|escalation|artifact):[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$"
)


def because_option(builder: ArgumentBuilder, body: Mapping[str, Any]) -> None:
    value = body.get("because")
    if value in (None, ""):
        return
    if not isinstance(value, str) or not BECAUSE.match(value):
        raise ArgumentError(
            "field 'because' must be TYPE:ID with TYPE one of review, decision, message, "
            "task, escalation, artifact"
        )
    builder.option("--because", value)


def list_tasks(request: Request) -> Any:
    """``task list``. ``status`` is repeatable since 1.4.0 — tasks in any of
    the given statuses match — so "everything not done" is one request rather
    than a loaded window narrowed afterwards."""

    builder = ArgumentBuilder("task", "list")
    for status in request.q_all("status"):
        if status not in TASK_STATUSES:
            raise ArgumentError(
                f"query parameter 'status' must be one of {', '.join(TASK_STATUSES)}",
                {"parameter": "status", "allowed": list(TASK_STATUSES)},
            )
        builder.option("--status", status)
    assignee = request.q_identifier("assignee")
    if assignee:
        builder.option("--assignee", assignee)
    tag = request.q("tag")
    if tag:
        if not TAG_TOKEN.match(tag):
            raise ArgumentError("query parameter 'tag' is one token: no commas or whitespace")
        builder.option("--tag", tag)
    return request.run(request.paging(request.structured(builder, "task")))


def show_task(request: Request) -> Any:
    builder = ArgumentBuilder("task", "show").positional(request.path_id())
    return request.run(builder)


def create_task(request: Request) -> Any:
    body = request.body
    builder = ArgumentBuilder("task", "create")
    builder.identifier(body, "id", "--id", required=True)
    builder.text(body, "title", "--title", required=True)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.text(body, "description", "--description")
    builder.integer(body, "priority", "--priority")
    builder.text(body, "tags", "--tags")
    builder.text(body, "acceptance", "--acceptance")
    builder.text(body, "next_steps", "--next-steps")
    builder.text(body, "blocked_claims", "--blocked-claims")
    builder.identifiers(body, "assignees", "--assignee")
    return request.run(builder, with_session=True)


def update_task(request: Request) -> Any:
    """``task update``. Cannot change workflow status or claim ownership."""

    body = request.body
    builder = ArgumentBuilder("task", "update").positional(request.path_id())
    builder.identifier(body, "actor", "--actor", required=True)
    builder.integer(body, "if_revision", "--if-revision", required=True)
    before = builder.option_count
    for key, flag in CONTENT_FIELDS:
        builder.text(body, key, flag)
    builder.integer(body, "priority", "--priority")
    if builder.option_count == before:
        raise ArgumentError("at least one content field is required")
    return request.run(builder, with_session=True)


def assign_task(request: Request) -> Any:
    body = request.body
    builder = ArgumentBuilder("task", "assign").positional(request.path_id())
    builder.identifier(body, "actor", "--actor", required=True)
    builder.integer(body, "if_revision", "--if-revision", required=True)
    added = builder.identifiers(body, "add", "--add")
    removed = builder.identifiers(body, "remove", "--remove")
    if not added and not removed:
        raise ArgumentError("at least one add or remove is required")
    overlap = sorted(set(added) & set(removed))
    if overlap:
        raise ArgumentError("add and remove must not overlap", {"overlapping": overlap})
    return request.run(builder, with_session=True)


def claim_task(request: Request) -> Any:
    """``task claim``. The only way into ``in_progress``; always needs a session."""

    body = request.body
    builder = ArgumentBuilder("task", "claim").positional(request.path_id())
    builder.identifier(body, "agent", "--agent", required=True)
    builder.integer(body, "if_revision", "--if-revision", required=True)
    if not request.session:
        raise CoordinationError(
            "session_required",
            "claiming a task requires an active session; start or select one first",
            exit_code=2,
        )
    return request.run(builder, with_session=True)


def set_task_status(request: Request) -> Any:
    """``task status``. Entering ``in_progress`` is rejected by the CLI."""

    body = request.body
    status = require_choice(body, "status", TASK_STATUSES)
    builder = ArgumentBuilder("task", "status")
    builder.positional(request.path_id()).positional(status)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.integer(body, "if_revision", "--if-revision", required=True)
    builder.text(body, "note", "--note")
    because_option(builder, body)
    return request.run(builder, with_session=True)


def release_task(request: Request) -> Any:
    """``task release``. Explicit spelling of an owned exit from ``in_progress``."""

    body = request.body
    builder = ArgumentBuilder("task", "release").positional(request.path_id())
    builder.choice(body, "to", "--to", RELEASE_TARGETS, required=True)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.integer(body, "if_revision", "--if-revision", required=True)
    builder.text(body, "note", "--note")
    because_option(builder, body)
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/tasks", list_tasks),
    ("POST", r"/api/tasks", create_task),
    ("GET", r"/api/tasks/(?P<id>[^/]+)", show_task),
    ("POST", r"/api/tasks/(?P<id>[^/]+)/update", update_task),
    ("POST", r"/api/tasks/(?P<id>[^/]+)/assign", assign_task),
    ("POST", r"/api/tasks/(?P<id>[^/]+)/claim", claim_task),
    ("POST", r"/api/tasks/(?P<id>[^/]+)/status", set_task_status),
    ("POST", r"/api/tasks/(?P<id>[^/]+)/release", release_task),
)
