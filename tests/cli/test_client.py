"""CoordinationCLI against the real coordination executable."""

from __future__ import annotations

import unittest
from pathlib import Path

from coordination_ui.cli import CoordinationCLI, CoordinationError

from ..support import CLI_PATH, TemporaryProject, cli_available


class BuildCommandTests(unittest.TestCase):
    """argv construction needs no database."""

    def setUp(self) -> None:
        self.cli = CoordinationCLI(
            Path("/bin/coordination"), Path("/db.sqlite3"), Path("/project")
        )

    def test_includes_executable_and_database(self) -> None:
        command = self.cli.build_command(["version"])
        self.assertEqual(command[0], "/bin/coordination")
        self.assertEqual(command[1], "--db=/db.sqlite3")
        self.assertEqual(command[2], "version")

    def test_omits_session_when_absent(self) -> None:
        self.assertNotIn("--session", " ".join(self.cli.build_command(["version"])))

    def test_includes_session_when_present(self) -> None:
        command = self.cli.build_command(["task", "list"], "s-1")
        self.assertIn("--session=s-1", command)

    def test_session_precedes_the_subcommand(self) -> None:
        # Global options must come before the command word.
        command = self.cli.build_command(["task", "list"], "s-1")
        self.assertLess(command.index("--session=s-1"), command.index("task"))

    def test_rejects_a_session_that_is_not_an_identifier(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.cli.build_command(["version"], "--db=/etc/passwd")
        self.assertEqual(caught.exception.code, "invalid_arguments")


@unittest.skipUnless(cli_available(), f"coordination CLI not installed at {CLI_PATH}")
class InvocationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.project = TemporaryProject().start()
        self.addCleanup(self.project.stop)
        self.cli = self.project.cli()

    def test_run_returns_data(self) -> None:
        data = self.cli.run(["version"])
        self.assertEqual(data["cli_version"], "1.2.0")
        self.assertEqual(data["schema_version"], 1)

    def test_run_reports_a_healthy_database(self) -> None:
        self.assertTrue(self.cli.run(["doctor"])["healthy"])

    def test_invoke_exposes_the_raw_result(self) -> None:
        result = self.cli.invoke(["version"])
        self.assertTrue(result.succeeded)
        self.assertIn('"ok"', result.stdout)

    def test_failure_raises_with_the_stable_code(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.cli.run(["task", "show", "MISSING"])
        self.assertEqual(caught.exception.code, "not_found")
        self.assertEqual(caught.exception.exit_code, 3)
        self.assertEqual(caught.exception.http_status, 404)

    def test_missing_actor_is_reported_as_invalid_arguments(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.cli.run(["task", "create", "--id=T-1", "--title=x"])
        self.assertEqual(caught.exception.exit_code, 2)

    def test_text_values_survive_the_argv_round_trip(self) -> None:
        """A title beginning with '-' must not be parsed as an option."""

        self.project.seed_agent("tester")
        self.cli.run(
            ["task", "create", "--id=T-DASH", "--title=--not-an-option", "--actor=tester"]
        )
        task = self.cli.run(["task", "show", "T-DASH"])
        self.assertEqual(task["title"], "--not-an-option")

    def test_unicode_and_newlines_survive(self) -> None:
        self.project.seed_agent("tester")
        body = "line one\nline two — é 🙂"
        self.cli.run(
            ["task", "create", "--id=T-UNI", "--title=t", "--actor=tester", f"--description={body}"]
        )
        self.assertEqual(self.cli.run(["task", "show", "T-UNI"])["description"], body)

    def test_run_text_returns_markdown(self) -> None:
        report = self.cli.run_text(["export"])
        self.assertIn("#", report)
        self.assertNotIn('"ok"', report)

    def test_timeout_is_reported_as_cli_timeout(self) -> None:
        impatient = CoordinationCLI(
            self.project.database.parent.parent / "nope",
            self.project.database,
            self.project.root,
        )
        with self.assertRaises(CoordinationError) as caught:
            impatient.run(["version"])
        self.assertEqual(caught.exception.code, "cli_unavailable")
        self.assertEqual(caught.exception.exit_code, 5)


if __name__ == "__main__":
    unittest.main()
