"""Project metadata, diagnostics, health, audit, and export routes."""

from __future__ import annotations

import re
from typing import Any

from ...cli import ArgumentBuilder, ArgumentError
from .. import enums
from ..audit_window import AuditWindow
from ..enums import MAX_LIST_LIMIT, MIN_LIST_LIMIT
from ..request import Request
from ..text_response import TextResponse

HEALTH_OPTIONS = (
    ("stale_days", "--stale-days"),
    ("stale_session_minutes", "--stale-session-minutes"),
    ("limit", "--limit"),
)

AUDIT_FILTERS = (
    ("actor", "--actor"),
    ("session", "--session-id"),
    ("object_type", "--object-type"),
    ("object_id", "--object-id"),
    ("action", "--action"),
)

DEFAULT_AUDIT_LIMIT = 100

# An audit action token as the CLI writes them: lower-case words joined by
# underscores. Anything else is a malformed request, not a filter.
ACTION_TOKEN = re.compile(r"^[a-z_]{1,64}$")


def get_meta(request: Request) -> Any:
    """Everything the frontend needs to configure itself at startup."""

    version = request.run(ArgumentBuilder("version"))
    project = request.context.project
    return {
        **project.describe(),
        "project_root": str(project.root),
        "cli_version": version.get("cli_version"),
        "schema_version": version.get("schema_version"),
        **enums.describe(),
    }


def get_doctor(request: Request) -> Any:
    return request.run(ArgumentBuilder("doctor"))


SUMMARY_SECTIONS = ("totals", "task_status", "task_priority", "workload", "time_in_state")


def get_summary(request: Request) -> Any:
    """``summary``; ``section`` (repeatable) computes only the named parts,
    which is how a poll for ``audit_cursor`` costs one small query."""

    builder = ArgumentBuilder("summary")
    for section in request.q_all("section"):
        if section not in SUMMARY_SECTIONS:
            raise ArgumentError(
                f"query parameter 'section' must be one of {', '.join(SUMMARY_SECTIONS)}",
                {"parameter": "section", "allowed": list(SUMMARY_SECTIONS)},
            )
        builder.option("--section", section)
    return request.run(builder)


def get_health(request: Request) -> Any:
    builder = ArgumentBuilder("health")
    for name, flag in HEALTH_OPTIONS:
        value = request.q_int(name)
        if value is not None:
            builder.option(flag, str(value))
    return request.run(builder)


def get_audit(request: Request) -> Any:
    """The newest window of the audit log, newest first.

    ``audit list`` has no descending order, so the composition lives in
    AuditWindow. The filters are the CLI's own flags; a filtered request
    returns the newest ``limit`` matches across the whole log, the same
    answer the direct query used to give, so a record's Activity tab is
    complete however old the record is. ``before`` pages back: the window
    preceding that audit id. ``since`` is the change-detection primitive —
    what was recorded after a cursor the client already holds — and it is
    the one request whose rows come back oldest first, as the CLI orders
    them, because a client reading forward wants them that way.
    ``exclude_action`` drops one action from the window after the CLI
    answers, so the view's default can be ``limit`` coordination events
    rather than ``limit`` rows of heartbeats.
    """

    requested = request.q_int("limit")
    limit = max(MIN_LIST_LIMIT, min(requested or DEFAULT_AUDIT_LIMIT, MAX_LIST_LIMIT))
    before = request.q_int("before")
    if before is not None and before < 1:
        raise ArgumentError("query parameter 'before' must be a positive integer")
    since = request.q_int("since")
    if since is not None and since < 0:
        raise ArgumentError("query parameter 'since' must be zero or a positive integer")
    if since is not None and before is not None:
        raise ArgumentError("query parameters 'since' and 'before' cannot be combined")
    excluded = request.q("exclude_action")
    if excluded is not None and not ACTION_TOKEN.match(excluded):
        raise ArgumentError("query parameter 'exclude_action' must be an audit action token")
    filters: dict[str, str] = {}
    for name, flag in AUDIT_FILTERS:
        value = request.q_identifier(name) if name in ("actor", "session") else request.q(name)
        if value:
            filters[flag] = value
    return AuditWindow(
        request.run,
        limit,
        filters,
        before=before,
        since=since,
        exclude_actions=(excluded,) if excluded else (),
    ).rows()


def get_export(request: Request) -> TextResponse:
    """``export`` without ``--output`` writes Markdown, not JSON."""

    report = request.run_text(ArgumentBuilder("export"))
    return TextResponse(report, "text/markdown; charset=utf-8")


ROUTES = (
    ("GET", r"/api/meta", get_meta),
    ("GET", r"/api/doctor", get_doctor),
    ("GET", r"/api/summary", get_summary),
    ("GET", r"/api/health", get_health),
    ("GET", r"/api/audit", get_audit),
    ("GET", r"/api/export", get_export),
)
