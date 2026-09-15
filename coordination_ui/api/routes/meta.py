"""Project metadata, diagnostics, health, audit, and export routes."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
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


def get_summary(request: Request) -> Any:
    return request.run(ArgumentBuilder("summary"))


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
    complete however old the record is.
    """

    requested = request.q_int("limit")
    limit = max(MIN_LIST_LIMIT, min(requested or DEFAULT_AUDIT_LIMIT, MAX_LIST_LIMIT))
    filters: dict[str, str] = {}
    for name, flag in AUDIT_FILTERS:
        value = request.q_identifier(name) if name in ("actor", "session") else request.q(name)
        if value:
            filters[flag] = value
    return AuditWindow(request.run, limit, filters).rows()


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
