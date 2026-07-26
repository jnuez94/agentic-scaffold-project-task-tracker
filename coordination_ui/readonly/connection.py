"""A SQLite connection that cannot write.

The CLI has no ``audit`` command and no aggregate-count command, so those two
reads open the database directly. Every such connection is opened ``mode=ro``
*and* pinned with ``PRAGMA query_only = ON``: the URI mode stops the file from
being opened writable, and the pragma stops any statement from attempting a
write even if the mode were ever relaxed.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from ..cli import CoordinationError

DEFAULT_TIMEOUT_SECONDS = 5.0


class ReadOnlyConnection:
    """Opens short-lived read-only connections to one database file."""

    def __init__(
        self, database: Path, timeout: float = DEFAULT_TIMEOUT_SECONDS
    ) -> None:
        self.database = Path(database)
        self.timeout = timeout

    @property
    def uri(self) -> str:
        return f"file:{self.database.as_posix()}?mode=ro"

    @contextmanager
    def open(self) -> Iterator[sqlite3.Connection]:
        """Yield a read-only connection, translating SQLite errors to the wire type."""

        try:
            connection = sqlite3.connect(self.uri, uri=True, timeout=self.timeout)
        except sqlite3.Error as exc:
            raise CoordinationError(
                "database_error",
                f"could not open {self.database} read-only: {exc}",
                {"database": str(self.database)},
                exit_code=5,
            ) from exc
        try:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA query_only = ON")
            yield connection
        except sqlite3.Error as exc:
            raise CoordinationError(
                "database_error",
                f"read-only query failed: {exc}",
                {"database": str(self.database)},
                exit_code=5,
            ) from exc
        finally:
            connection.close()
