"""Agent routes: ``agent list``, ``agent add``, ``agent update``."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder, ArgumentError
from ..enums import ACTOR_TYPES, AGENT_STATUSES
from ..request import Request

PROFILE_FIELDS = (
    ("responsibilities", "--responsibilities"),
    ("goal", "--goal"),
    ("operating_style", "--operating-style"),
    ("decision_authority", "--decision-authority"),
    ("review_authority", "--review-authority"),
    ("escalation_rules", "--escalation-rules"),
    ("unavailable_for", "--unavailable-for"),
)


def list_agents(request: Request) -> Any:
    builder = ArgumentBuilder("agent", "list")
    if request.q_flag("all"):
        builder.flag("--all")
    actor_type = request.q_choice("actor_type", ACTOR_TYPES)
    if actor_type:
        builder.option("--actor-type", actor_type)
    return request.run(request.paging(builder))


def create_agent(request: Request) -> Any:
    """``agent add``. Omitting ``actor`` lets the first agent bootstrap itself."""

    body = request.body
    builder = ArgumentBuilder("agent", "add")
    builder.identifier(body, "id", "--id", required=True)
    builder.text(body, "name", "--name", required=True)
    builder.text(body, "role", "--role", required=True)
    builder.choice(body, "actor_type", "--actor-type", ACTOR_TYPES)
    for key, flag in PROFILE_FIELDS:
        builder.text(body, key, flag)
    builder.identifier(body, "actor", "--actor")
    return request.run(builder, with_session=True)


def update_agent(request: Request) -> Any:
    """``agent update``. At least one changed field is required."""

    body = request.body
    builder = ArgumentBuilder("agent", "update").positional(request.path_id())
    builder.text(body, "name", "--name")
    builder.text(body, "role", "--role")
    builder.choice(body, "actor_type", "--actor-type", ACTOR_TYPES)
    builder.choice(body, "status", "--status", AGENT_STATUSES)
    changed = builder.option_count
    builder.identifier(body, "actor", "--actor")
    if changed == 0:
        raise ArgumentError("at least one changed field is required")
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/agents", list_agents),
    ("POST", r"/api/agents", create_agent),
    ("POST", r"/api/agents/(?P<id>[^/]+)", update_agent),
)
