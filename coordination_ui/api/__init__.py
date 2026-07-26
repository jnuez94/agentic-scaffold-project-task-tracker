"""JSON API surface over the coordination CLI."""

from __future__ import annotations

from ..cli import CoordinationCLI
from ..discovery import Project
from . import enums
from .context import ApiContext
from .request import Request
from .router import Handler, RouteSpec, Router
from .routes import ROUTES
from .text_response import TextResponse

__all__ = [
    "ROUTES",
    "ApiContext",
    "Handler",
    "Request",
    "RouteSpec",
    "Router",
    "TextResponse",
    "build_router",
    "enums",
]


def build_router(project: Project, cli: CoordinationCLI) -> Router:
    """Wire a router for one project with the full route table."""

    return Router(ApiContext(project, cli), ROUTES)
