"""ReadOnlyConnection."""

from __future__ import annotations

import sqlite3
import unittest
from pathlib import Path

from coordination_ui.cli import CoordinationError
from coordination_ui.readonly import ReadOnlyConnection

from ..support import TemporaryProject, cli_available


class UriTests(unittest.TestCase):
    def test_requests_read_only_mode(self) -> None:
        connection = ReadOnlyConnection(Path("/tmp/db.sqlite3"))
        self.assertEqual(connection.uri, "file:/tmp/db.sqlite3?mode=ro")


class MissingDatabaseTests(unittest.TestCase):
    def test_reports_database_error_rather_than_creating_a_file(self) -> None:
        missing = Path("/tmp/coordination-ui-absent-db.sqlite3")
        if missing.exists():  # pragma: no cover - defensive
            missing.unlink()
        with self.assertRaises(CoordinationError) as caught:
            with ReadOnlyConnection(missing).open():
                pass
        self.assertEqual(caught.exception.code, "database_error")
        self.assertEqual(caught.exception.exit_code, 5)
        self.assertFalse(missing.exists())


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class OpenTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.connection = ReadOnlyConnection(self.temp.database)

    def test_reads_a_wal_database(self) -> None:
        with self.connection.open() as connection:
            row = connection.execute(
                "SELECT value FROM metadata WHERE key = 'schema_version'"
            ).fetchone()
        self.assertEqual(row["value"], "1")

    def test_rows_are_mappings(self) -> None:
        with self.connection.open() as connection:
            row = connection.execute("SELECT key, value FROM metadata").fetchone()
        self.assertEqual(row["key"], "schema_version")

    def test_query_only_is_enabled(self) -> None:
        with self.connection.open() as connection:
            self.assertEqual(connection.execute("PRAGMA query_only").fetchone()[0], 1)

    def test_writes_are_refused(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            with self.connection.open() as connection:
                connection.execute("INSERT INTO metadata VALUES ('x', 'y')")
        self.assertEqual(caught.exception.code, "database_error")

    def test_schema_changes_are_refused(self) -> None:
        with self.assertRaises(CoordinationError):
            with self.connection.open() as connection:
                connection.execute("DROP TABLE tasks")

    def test_connection_is_closed_after_the_block(self) -> None:
        with self.connection.open() as connection:
            pass
        with self.assertRaises(sqlite3.ProgrammingError):
            connection.execute("SELECT 1")

    def test_connection_is_closed_even_when_the_body_raises(self) -> None:
        captured: list[sqlite3.Connection] = []
        with self.assertRaises(ValueError):
            with self.connection.open() as connection:
                captured.append(connection)
                raise ValueError("boom")
        with self.assertRaises(sqlite3.ProgrammingError):
            captured[0].execute("SELECT 1")


if __name__ == "__main__":
    unittest.main()
