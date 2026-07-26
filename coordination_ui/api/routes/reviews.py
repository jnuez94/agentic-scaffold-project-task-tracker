"""Review and decision routes."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
from ..enums import DECISION_STATUSES, REVIEW_DECISIONS
from ..request import Request


def list_reviews(request: Request) -> Any:
    builder = ArgumentBuilder("review", "list")
    task = request.q_identifier("task")
    if task:
        builder.option("--task", task)
    return request.run(request.paging(builder))


def add_review(request: Request) -> Any:
    """``review add``. ``blocked_claims`` is where a reviewer states what an
    acceptance does *not* authorize."""

    body = request.body
    builder = ArgumentBuilder("review", "add")
    builder.identifier(body, "id", "--id", required=True)
    builder.identifier(body, "task", "--task")
    builder.identifier(body, "reviewer", "--reviewer", required=True)
    builder.text(body, "artifact", "--artifact", required=True)
    builder.text(body, "scope", "--scope", required=True)
    builder.choice(body, "decision", "--decision", REVIEW_DECISIONS, required=True)
    builder.text(body, "accepted_items", "--accepted-items")
    builder.text(body, "required_changes", "--required-changes")
    builder.text(body, "risks", "--risks")
    builder.text(body, "blocked_claims", "--blocked-claims")
    builder.text(body, "follow_up_tasks", "--follow-up-tasks")
    return request.run(builder, with_session=True)


def list_decisions(request: Request) -> Any:
    return request.run(request.paging(ArgumentBuilder("decision", "list")))


def add_decision(request: Request) -> Any:
    body = request.body
    builder = ArgumentBuilder("decision", "add")
    builder.identifier(body, "id", "--id", required=True)
    builder.text(body, "title", "--title", required=True)
    builder.identifier(body, "owner", "--owner", required=True)
    builder.choice(body, "status", "--status", DECISION_STATUSES)
    builder.text(body, "context", "--context", required=True)
    builder.text(body, "decision", "--decision", required=True)
    builder.text(body, "options", "--options")
    builder.text(body, "implications", "--implications")
    builder.text(body, "evidence", "--evidence")
    builder.text(body, "blocked_claims", "--blocked-claims")
    builder.text(body, "review_required", "--review-required")
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/reviews", list_reviews),
    ("POST", r"/api/reviews", add_review),
    ("GET", r"/api/decisions", list_decisions),
    ("POST", r"/api/decisions", add_decision),
)
