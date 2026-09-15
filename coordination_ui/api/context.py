"""Shared collaborators handed to every route handler."""

from __future__ import annotations

from ..cli import CoordinationCLI
from ..discovery import Project


class ApiContext:
    """Long-lived objects a request borrows.

    Constructed once at startup and shared across request threads. The CLI
    spawns a fresh process per call and holds no state between them, so
    sharing is safe.
    """

    def __init__(self, project: Project, cli: CoordinationCLI) -> None:
        self.project = project
        self.cli = cli
