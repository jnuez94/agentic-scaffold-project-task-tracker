"""Facade over the read-only queries."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .audit_query import AuditQuery
from .connection import ReadOnlyConnection
from .summary_query import SummaryQuery


class ReadOnlyDatabase:
    """Single entry point for the two reads the CLI cannot serve."""

    def __init__(self, database: Path) -> None:
        self.connection = ReadOnlyConnection(database)
        self.audit_query = AuditQuery(self.connection)
        self.summary_query = SummaryQuery(self.connection)

    @property
    def database(self) -> Path:
        return self.connection.database

    def audit(self, **kwargs: Any) -> dict[str, Any]:
        return self.audit_query.fetch(**kwargs)

    def summary(self) -> dict[str, Any]:
        return self.summary_query.fetch()
