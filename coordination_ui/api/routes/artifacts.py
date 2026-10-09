"""Artifact routes."""

from __future__ import annotations

from typing import Any

from ...cli import ArgumentBuilder, require_choice
from ..enums import ARTIFACT_STATUSES
from ..request import Request


def list_artifacts(request: Request) -> Any:
    builder = ArgumentBuilder("artifact", "list")
    status = request.q_choice("status", ARTIFACT_STATUSES)
    if status:
        builder.option("--status", status)
    return request.run(request.paging(request.structured(builder, "artifact")))


def add_artifact(request: Request) -> Any:
    """``artifact add``. ``uri`` is unique across the database."""

    body = request.body
    builder = ArgumentBuilder("artifact", "add")
    builder.identifier(body, "id", "--id", required=True)
    builder.text(body, "uri", "--uri", required=True)
    builder.identifier(body, "owner", "--owner", required=True)
    builder.text(body, "type", "--type", required=True)
    builder.choice(body, "status", "--status", ARTIFACT_STATUSES)
    builder.text(body, "usage_boundaries", "--usage-boundaries")
    builder.identifiers(body, "tasks", "--task")
    builder.identifiers(body, "reviewers", "--reviewer")
    return request.run(builder, with_session=True)


def set_artifact_status(request: Request) -> Any:
    """``artifact status``. ``--if-status`` is compare-and-swap on the status the
    caller saw; a changed record is refused with ``status_mismatch``."""

    body = request.body
    status = require_choice(body, "status", ARTIFACT_STATUSES)
    builder = ArgumentBuilder("artifact", "status")
    builder.positional(request.path_id()).positional(status)
    builder.identifier(body, "actor", "--actor", required=True)
    builder.choice(body, "if_status", "--if-status", ARTIFACT_STATUSES)
    builder.text(body, "because", "--because")
    return request.run(builder, with_session=True)


def update_artifact(request: Request) -> Any:
    """``artifact update`` (1.3.0): correct a record in place.

    URIs are paths and paths move; this fixes the record rather than adding a
    superseding duplicate. Status, owner, related tasks and reviewers are not
    this command's to change. The CLI requires at least one changed field and
    returns the complete updated row.
    """

    body = request.body
    builder = ArgumentBuilder("artifact", "update").positional(request.path_id())
    builder.identifier(body, "actor", "--actor", required=True)
    builder.text(body, "uri", "--uri")
    builder.text(body, "type", "--type")
    builder.text(body, "usage_boundaries", "--usage-boundaries")
    builder.choice(body, "if_status", "--if-status", ARTIFACT_STATUSES)
    return request.run(builder, with_session=True)


ROUTES = (
    ("GET", r"/api/artifacts", list_artifacts),
    ("POST", r"/api/artifacts", add_artifact),
    ("POST", r"/api/artifacts/(?P<id>[^/]+)/status", set_artifact_status),
    ("POST", r"/api/artifacts/(?P<id>[^/]+)/update", update_artifact),
)
