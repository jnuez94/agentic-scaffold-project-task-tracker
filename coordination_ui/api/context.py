"""Shared collaborators handed to every route handler."""

from __future__ import annotations

from ..cli import CoordinationCLI
from ..discovery import Project
from ..readonly import ReadOnlyDatabase


class ApiContext:
    """Long-lived objects a request borrows.

    Constructed once at startup and shared across request threads. Both
    collaborators are stateless between calls — the CLI spawns a fresh process
    and the read-only database opens a fresh connection — so sharing is safe.
    """

    def __init__(
        self,
        project: Project,
        cli: CoordinationCLI,
        readonly: ReadOnlyDatabase | None = None,
    ) -> None:
        self.project = project
        self.cli = cli
        self.readonly = readonly or ReadOnlyDatabase(project.database)
