"""Session lifecycle routes."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
from ..enums import SESSION_STATUSES
from ..request import Request


def list_sessions(request: Request) -> Any:
    builder = ArgumentBuilder("session", "list")
    agent = request.q_identifier("agent")
    if agent:
        builder.option("--agent", agent)
    status = request.q_choice("status", SESSION_STATUSES)
    if status:
        builder.option("--status", status)
    harness = request.q("harness")
    if harness:
        builder.option("--harness", harness)
    return request.run(request.paging(builder))


def start_session(request: Request) -> Any:
    """``session start``. Its audit is attributed to the new session itself,
    so no global session is passed."""

    body = request.body
    builder = ArgumentBuilder("session", "start")
    builder.identifier(body, "id", "--id", required=True)
    builder.identifier(body, "agent", "--agent", required=True)
    builder.text(body, "harness", "--harness", required=True)
    builder.text(body, "model", "--model")
    return request.run(builder)


def heartbeat_session(request: Request) -> Any:
    builder = ArgumentBuilder("session", "heartbeat").positional(request.path_id())
    return request.run(builder)


def end_session(request: Request) -> Any:
    """``session end``. Blocked by the CLI while the session holds task claims."""

    builder = ArgumentBuilder("session", "end").positional(request.path_id())
    return request.run(builder)


def recover_session(request: Request) -> Any:
    """``session recover``. Blocks every task the stale session claimed."""

    body = request.body
    builder = ArgumentBuilder("session", "recover").positional(request.path_id())
    builder.identifier(body, "actor", "--actor", required=True)
    builder.text(body, "reason", "--reason", required=True)
    builder.integer(body, "stale_after_seconds", "--stale-after-seconds")
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/sessions", list_sessions),
    ("POST", r"/api/sessions", start_session),
    ("POST", r"/api/sessions/(?P<id>[^/]+)/heartbeat", heartbeat_session),
    ("POST", r"/api/sessions/(?P<id>[^/]+)/end", end_session),
    ("POST", r"/api/sessions/(?P<id>[^/]+)/recover", recover_session),
)
