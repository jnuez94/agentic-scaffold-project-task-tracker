"""Project metadata, diagnostics, health, audit, and export routes."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
from .. import enums
from ..request import Request
from ..text_response import TextResponse

HEALTH_OPTIONS = (
    ("stale_days", "--stale-days"),
    ("stale_session_minutes", "--stale-session-minutes"),
    ("limit", "--limit"),
)


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
    return request.readonly.summary()


def get_health(request: Request) -> Any:
    builder = ArgumentBuilder("health")
    for name, flag in HEALTH_OPTIONS:
        value = request.q_int(name)
        if value is not None:
            builder.option(flag, str(value))
    return request.run(builder)


def get_audit(request: Request) -> Any:
    return request.readonly.audit(
        limit=request.q_int("limit", 100) or 100,
        offset=request.q_int("offset", 0) or 0,
        actor=request.q_identifier("actor"),
        session_id=request.q_identifier("session"),
        object_type=request.q("object_type"),
        object_id=request.q("object_id"),
        action=request.q("action"),
        search=request.q("q"),
    )


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
