"""Message routes."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
from ..request import Request


def list_messages(request: Request) -> Any:
    """``message list``. Filtering by recipient also returns messages addressed
    to the literal recipient ``team``."""

    builder = ArgumentBuilder("message", "list")
    recipient = request.q("recipient")
    if recipient:
        builder.option("--recipient", recipient)
    return request.run(request.paging(builder))


def send_message(request: Request) -> Any:
    body = request.body
    builder = ArgumentBuilder("message", "send")
    builder.identifier(body, "id", "--id", required=True)
    builder.identifier(body, "sender", "--sender", required=True)
    builder.text(body, "recipient", "--recipient", required=True)
    builder.identifier(body, "task", "--task")
    builder.text(body, "body", "--body", required=True)
    builder.text(body, "tags", "--tags")
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/messages", list_messages),
    ("POST", r"/api/messages", send_message),
)
