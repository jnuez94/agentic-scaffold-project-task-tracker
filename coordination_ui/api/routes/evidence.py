"""Evidence and dependency routes.

Evidence is what gates ``done``: the CLI refuses the transition until a task
has at least one evidence row.
"""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder
from ..enums import DEPENDENCY_TYPES
from ..request import Request


def list_evidence(request: Request) -> Any:
    builder = ArgumentBuilder("evidence", "list")
    builder.option("--task", request.path_id())
    return request.run(request.paging(builder))


def add_evidence(request: Request) -> Any:
    body = request.body
    builder = ArgumentBuilder("evidence", "add")
    builder.identifier(body, "task", "--task", required=True)
    builder.text(body, "uri", "--uri", required=True)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.text(body, "type", "--type")
    return request.run(builder, with_session=True)


def add_dependency(request: Request) -> Any:
    body = request.body
    builder = ArgumentBuilder("dependency", "add")
    builder.identifier(body, "task", "--task", required=True)
    builder.identifier(body, "depends_on", "--depends-on", required=True)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.choice(body, "type", "--type", DEPENDENCY_TYPES)
    builder.text(body, "rationale", "--rationale")
    return request.run(builder, with_session=True)


def resolve_dependency(request: Request) -> Any:
    body = request.body
    builder = ArgumentBuilder("dependency", "resolve")
    builder.identifier(body, "task", "--task", required=True)
    builder.identifier(body, "depends_on", "--depends-on", required=True)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.choice(body, "type", "--type", DEPENDENCY_TYPES)
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/tasks/(?P<id>[^/]+)/evidence", list_evidence),
    ("POST", r"/api/evidence", add_evidence),
    ("POST", r"/api/dependencies", add_dependency),
    ("POST", r"/api/dependencies/resolve", resolve_dependency),
)
