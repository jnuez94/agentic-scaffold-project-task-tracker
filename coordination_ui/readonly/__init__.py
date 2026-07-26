"""Read-only SQLite access for views the coordination CLI does not expose."""

from __future__ import annotations

from .audit_query import AUDIT_COLUMNS, AuditQuery
from .connection import ReadOnlyConnection
from .database import ReadOnlyDatabase
from .summary_query import COUNTED_TABLES, SummaryQuery

__all__ = [
    "AUDIT_COLUMNS",
    "COUNTED_TABLES",
    "AuditQuery",
    "ReadOnlyConnection",
    "ReadOnlyDatabase",
    "SummaryQuery",
]
