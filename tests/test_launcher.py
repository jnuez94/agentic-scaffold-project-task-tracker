"""Launcher and command-line argument parsing."""

from __future__ import annotations

import contextlib
import io
import unittest
from pathlib import Path

from coordination_ui.arguments import build_parser, parse_options
from coordination_ui.discovery import ProjectLocator
from coordination_ui.launcher import EXIT_FAILURE, EXIT_USAGE, LaunchOptions, Launcher

from .support import TemporaryProject, cli_available, locator_for_tests


class ArgumentParsingTests(unittest.TestCase):
    def test_defaults(self) -> None:
        options = parse_options([])
        self.assertIsNone(options.database)
        self.assertEqual(options.host, "127.0.0.1")
        self.assertEqual(options.port, 8787)
        self.assertEqual(options.timeout, 30.0)
        self.assertFalse(options.open_browser)

    def test_database_is_a_path(self) -> None:
        options = parse_options(["--db", "/tmp/db.sqlite3"])
        self.assertEqual(options.database, Path("/tmp/db.sqlite3"))

    def test_host_and_port(self) -> None:
        options = parse_options(["--host", "localhost", "--port", "9000"])
        self.assertEqual(options.host, "localhost")
        self.assertEqual(options.port, 9000)

    def test_open_flag(self) -> None:
        self.assertTrue(parse_options(["--open"]).open_browser)

    def test_rejects_a_non_numeric_port(self) -> None:
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                parse_options(["--port", "abc"])

    def test_help_mentions_the_cli_delegation(self) -> None:
        self.assertIn("coordination CLI", build_parser().description or "")


class LaunchOptionsTests(unittest.TestCase):
    def test_is_frozen(self) -> None:
        with self.assertRaises(Exception):
            LaunchOptions().port = 1  # type: ignore[misc]


class FailurePathTests(unittest.TestCase):
    def setUp(self) -> None:
        self.stderr = io.StringIO()

    def test_missing_project_exits_with_usage(self) -> None:
        options = LaunchOptions(database=Path("/definitely/not/here.sqlite3"))
        code = Launcher(options, self.stderr, ProjectLocator(locator_for_tests())).run()
        self.assertEqual(code, EXIT_USAGE)
        self.assertIn("coordination-ui:", self.stderr.getvalue())

    @unittest.skipUnless(cli_available(), "coordination CLI not installed")
    def test_non_loopback_host_exits_with_usage(self) -> None:
        with TemporaryProject() as temp:
            options = LaunchOptions(database=temp.database, host="0.0.0.0")
            code = Launcher(
                options, self.stderr, ProjectLocator(locator_for_tests())
            ).run()
        self.assertEqual(code, EXIT_USAGE)
        self.assertIn("loopback", self.stderr.getvalue())

    @unittest.skipUnless(cli_available(), "coordination CLI not installed")
    def test_unreadable_database_exits_with_failure(self) -> None:
        with TemporaryProject(initialize=False) as temp:
            temp.database.write_text("not a database", encoding="utf-8")
            options = LaunchOptions(database=temp.database)
            code = Launcher(
                options, self.stderr, ProjectLocator(locator_for_tests())
            ).run()
        self.assertEqual(code, EXIT_FAILURE)


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class PreflightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.stderr = io.StringIO()
        self.launcher = Launcher(
            LaunchOptions(database=self.temp.database),
            self.stderr,
            ProjectLocator(locator_for_tests()),
        )

    def test_resolve_project_finds_the_database(self) -> None:
        self.assertEqual(
            self.launcher.resolve_project().database, self.temp.database.resolve()
        )

    def test_preflight_runs_version_and_doctor(self) -> None:
        result = self.launcher.preflight(self.launcher.resolve_project())
        self.assertEqual(result["version"]["cli_version"], "1.2.0")
        self.assertTrue(result["doctor"]["healthy"])

    def test_report_names_the_database_and_url(self) -> None:
        project = self.launcher.resolve_project()
        self.launcher.report(
            project, self.launcher.preflight(project), "http://127.0.0.1:8787/"
        )
        output = self.stderr.getvalue()
        self.assertIn(str(self.temp.database), output)
        self.assertIn("http://127.0.0.1:8787/", output)
        self.assertIn("no authentication", output)


if __name__ == "__main__":
    unittest.main()
