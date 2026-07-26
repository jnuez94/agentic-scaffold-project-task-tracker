"""Dashboard aggregates.

Every statement runs on one connection so the tiles are mutually consistent:
the task histogram cannot disagree with the task total because another agent
committed between two separate reads.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from .connection import ReadOnlyConnection

COUNTED_TABLES = (
    "agents",
    "agent_sessions",
    "tasks",
    "task_evidence",
    "task_dependencies",
    "reviews",
    "decisions",
    "messages",
    "artifacts",
    "escalations",
    "audit_log",
)

RECENT_AUDIT_LIMIT = 12

WORKLOAD_SQL = """
SELECT a.id AS agent_id,
       a.name AS name,
       a.role AS role,
       a.status AS status,
       COUNT(ta.task_id) AS assigned,
       SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
       SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done
  FROM agents a
  LEFT JOIN task_assignees ta ON ta.agent_id = a.id
  LEFT JOIN tasks t ON t.id = ta.task_id
 GROUP BY a.id, a.name, a.role, a.status
 ORDER BY assigned DESC, a.id
"""

RECENT_AUDIT_SQL = """
SELECT id, actor, session_id, action, object_type, object_id, detail, created_at
  FROM audit_log
 ORDER BY created_at DESC, id DESC
 LIMIT ?
"""


class SummaryQuery:
    """Counts and histograms the CLI does not expose as a single command."""

    def __init__(self, connection: ReadOnlyConnection) -> None:
        self.connection = connection

    def fetch(self) -> dict[str, Any]:
        with self.connection.open() as connection:
            return {
                "totals": self._totals(connection),
                "task_status": self._histogram(connection, "tasks", "status"),
                "task_priority": self._histogram(
                    connection, "tasks", "priority", stringify=True
                ),
                "escalation_status": self._histogram(
                    connection, "escalations", "status"
                ),
                "session_status": self._histogram(
                    connection, "agent_sessions", "status"
                ),
                "workload": [
                    dict(row) for row in connection.execute(WORKLOAD_SQL)
                ],
                "recent_audit": [
                    dict(row)
                    for row in connection.execute(
                        RECENT_AUDIT_SQL, [RECENT_AUDIT_LIMIT]
                    )
                ],
            }

    @staticmethod
    def _totals(connection: sqlite3.Connection) -> dict[str, int]:
        return {
            table: int(
                connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            )
            for table in COUNTED_TABLES
        }

    @staticmethod
    def _histogram(
        connection: sqlite3.Connection,
        table: str,
        column: str,
        *,
        stringify: bool = False,
    ) -> dict[str, int]:
        """Group-by count over a fixed table/column pair.

        Both names come from module constants, never from a request.
        """

        if table not in COUNTED_TABLES:  # pragma: no cover - guarded by callers
            raise ValueError(f"{table} is not a counted table")
        rows = connection.execute(
            f"SELECT {column} AS bucket, COUNT(*) AS count"
            f"  FROM {table} GROUP BY {column}"
        )
        return {
            (str(row["bucket"]) if stringify else row["bucket"]): int(row["count"])
            for row in rows
        }
