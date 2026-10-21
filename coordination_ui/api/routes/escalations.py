"""Escalation routes."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
from ..enums import ESCALATION_RESOLUTIONS, ESCALATION_STATUSES
from ..request import Request


def list_escalations(request: Request) -> Any:
    builder = ArgumentBuilder("escalation", "list")
    status = request.q_choice("status", ESCALATION_STATUSES)
    if status:
        builder.option("--status", status)
    return request.run(request.paging(request.structured(builder, "escalation")))


def add_escalation(request: Request) -> Any:
    """``escalation add``. ``owner`` is free text, not an agent identifier —
    an escalation can be addressed to a role or a human outside the database."""

    body = request.body
    builder = ArgumentBuilder("escalation", "add")
    builder.identifier(body, "id", "--id", required=True)
    builder.identifier(body, "raised_by", "--raised-by", required=True)
    builder.text(body, "owner", "--owner", required=True)
    builder.text(body, "related_tasks", "--related-tasks")
    builder.text(body, "needed_by", "--needed-by")
    builder.text(body, "issue", "--issue", required=True)
    builder.text(body, "requested_decision", "--requested-decision", required=True)
    return request.run(builder, with_session=True)


def resolve_escalation(request: Request) -> Any:
    """``escalation resolve``. ``if_status`` is the status the console loaded,
    so an escalation answered elsewhere in the meantime is refused as
    ``status_mismatch`` rather than answered twice; ``because`` is the record
    the resolution follows from, validated by the CLI (1.4.0)."""

    body = request.body
    builder = ArgumentBuilder("escalation", "resolve").positional(request.path_id())
    builder.text(body, "resolution", "--resolution", required=True)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.choice(body, "status", "--status", ESCALATION_RESOLUTIONS)
    builder.text(body, "follow_up_tasks", "--follow-up-tasks")
    builder.choice(body, "if_status", "--if-status", ESCALATION_STATUSES)
    builder.text(body, "because", "--because")
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/escalations", list_escalations),
    ("POST", r"/api/escalations", add_escalation),
    ("POST", r"/api/escalations/(?P<id>[^/]+)/resolve", resolve_escalation),
)
