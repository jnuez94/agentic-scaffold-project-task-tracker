"""The filtered audit timeline.

``audit_log`` has no CLI command, so the console reads it directly. Filters are
built from a fixed column allowlist; no caller-supplied text ever reaches the
SQL string, only bound parameters.
"""

from __future__ import annotations

from typing import Any

from .connection import ReadOnlyConnection

AUDIT_COLUMNS = (
    "id",
    "actor",
    "session_id",
    "action",
    "object_type",
    "object_id",
    "detail",
    "created_at",
)

FILTERABLE_COLUMNS = (
    "actor",
    "session_id",
    "object_type",
    "object_id",
    "action",
)

SEARCHABLE_COLUMNS = ("object_id", "detail", "action", "actor")

MAX_LIMIT = 500
DEFAULT_LIMIT = 100


class AuditQuery:
    """Reads ``audit_log`` newest-first with filtering, paging, and facets."""

    def __init__(self, connection: ReadOnlyConnection) -> None:
        self.connection = connection

    # -- SQL building -------------------------------------------------------

    @staticmethod
    def clamp_limit(limit: int) -> int:
        return max(1, min(int(limit), MAX_LIMIT))

    @staticmethod
    def clamp_offset(offset: int) -> int:
        return max(0, int(offset))

    @classmethod
    def build_where(cls, filters: dict[str, Any], search: str | None) -> tuple[str, list[Any]]:
        """Return a WHERE fragment and its bound parameters.

        Only names in :data:`FILTERABLE_COLUMNS` can become SQL identifiers, so
        an unexpected key is ignored rather than interpolated.
        """

        clauses: list[str] = []
        params: list[Any] = []
        for column in FILTERABLE_COLUMNS:
            value = filters.get(column)
            if value:
                clauses.append(f"{column} = ?")
                params.append(value)
        if search:
            matches = " OR ".join(f"{column} LIKE ?" for column in SEARCHABLE_COLUMNS)
            clauses.append(f"({matches})")
            params.extend([f"%{search}%"] * len(SEARCHABLE_COLUMNS))
        if not clauses:
            return "", params
        return f" WHERE {' AND '.join(clauses)}", params

    # -- execution ----------------------------------------------------------

    def fetch(
        self,
        *,
        limit: int = DEFAULT_LIMIT,
        offset: int = 0,
        search: str | None = None,
        **filters: Any,
    ) -> dict[str, Any]:
        """Return one page of audit entries plus the unpaged total."""

        limit = self.clamp_limit(limit)
        offset = self.clamp_offset(offset)
        where, params = self.build_where(filters, search)
        columns = ", ".join(AUDIT_COLUMNS)

        with self.connection.open() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM audit_log{where}", params
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT {columns} FROM audit_log{where}"
                " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                [*params, limit, offset],
            ).fetchall()
            facets = {
                "object_types": self._distinct(connection, "object_type"),
                "actions": self._distinct(connection, "action"),
                "actors": self._distinct(connection, "actor"),
            }
        return {
            "entries": [dict(row) for row in rows],
            "total": int(total),
            "limit": limit,
            "offset": offset,
            "facets": facets,
        }

    @staticmethod
    def _distinct(connection: Any, column: str) -> list[str]:
        if column not in AUDIT_COLUMNS:  # pragma: no cover - guarded by callers
            raise ValueError(f"{column} is not an audit column")
        return [
            row[0]
            for row in connection.execute(
                f"SELECT DISTINCT {column} FROM audit_log ORDER BY {column}"
            )
        ]
