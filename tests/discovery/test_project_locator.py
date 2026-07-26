"""ProjectLocator, ExecutableLocator, and the Project value object."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from coordination_ui.discovery import (
    DiscoveryError,
    ExecutableLocator,
    Project,
    ProjectLocator,
    project_for,
)

from ..support import CLI_PATH, TemporaryProject, cli_available, locator_for_tests

CONFIG = "version: 1\nbackend: sqlite\ndatabase: coordination.sqlite3\n"


class ProjectTests(unittest.TestCase):
    def setUp(self) -> None:
        self.project = Project(
            root=Path("/p"),
            config_path=Path("/p/.coordination/config.yml"),
            database=Path("/p/.coordination/db.sqlite3"),
            executable=Path("/p/bin/coordination"),
        )

    def test_coordination_dir_is_derived_from_root(self) -> None:
        self.assertEqual(self.project.coordination_dir, Path("/p/.coordination"))

    def test_describe_is_json_safe_strings(self) -> None:
        described = self.project.describe()
        self.assertEqual(set(described), {"root", "config", "database", "executable"})
        for value in described.values():
            self.assertIsInstance(value, str)

    def test_is_frozen(self) -> None:
        with self.assertRaises(Exception):
            self.project.root = Path("/other")  # type: ignore[misc]


class ExecutableLocatorTests(unittest.TestCase):
    def test_env_override_wins(self) -> None:
        locator = ExecutableLocator({"COORDINATION_BIN": str(CLI_PATH)})
        self.assertEqual(locator.locate(Path("/nonexistent")), CLI_PATH.resolve())

    def test_env_override_must_name_a_file(self) -> None:
        locator = ExecutableLocator({"COORDINATION_BIN": "/definitely/not/here"})
        with self.assertRaises(DiscoveryError):
            locator.locate(Path("/tmp"))

    def test_falls_back_to_the_scaffold_path(self) -> None:
        repo_root = CLI_PATH.parent.parent.parent.parent
        self.assertEqual(ExecutableLocator({}).locate(repo_root), CLI_PATH.resolve())

    def test_reports_the_expected_path_when_absent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(DiscoveryError) as caught:
                ExecutableLocator({}).locate(Path(directory))
        self.assertIn("COORDINATION_BIN", str(caught.exception))


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class FindTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.locator = ProjectLocator(locator_for_tests())

    def test_finds_a_project_in_the_starting_directory(self) -> None:
        found = self.locator.find(self.temp.root)
        self.assertEqual(found.root, self.temp.root)
        self.assertEqual(found.database, self.temp.database)

    def test_finds_a_project_from_a_nested_directory(self) -> None:
        nested = self.temp.root / "a" / "b" / "c"
        nested.mkdir(parents=True)
        self.assertEqual(self.locator.find(nested).root, self.temp.root)

    def test_raises_when_no_project_exists(self) -> None:
        with tempfile.TemporaryDirectory(dir="/tmp") as directory:
            with self.assertRaises(DiscoveryError):
                self.locator.find(Path(directory) / "deep")

    def test_rejects_a_coordination_dir_without_config(self) -> None:
        self.temp.config_path.unlink()
        with self.assertRaises(DiscoveryError):
            self.locator.find(self.temp.root)

    def test_rejects_a_malformed_config_rather_than_skipping_to_a_parent(self) -> None:
        self.temp.config_path.write_text("version: 2\n", encoding="utf-8")
        with self.assertRaises(DiscoveryError):
            self.locator.find(self.temp.root)


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class ForDatabaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.locator = ProjectLocator(locator_for_tests())

    def test_resolves_root_above_the_coordination_directory(self) -> None:
        found = self.locator.for_database(self.temp.database)
        self.assertEqual(found.root, self.temp.root)
        self.assertEqual(found.database, self.temp.database.resolve())

    def test_rejects_a_missing_database(self) -> None:
        with self.assertRaises(DiscoveryError):
            self.locator.for_database(self.temp.root / "absent.sqlite3")

    def test_resolve_dispatches_on_the_database_argument(self) -> None:
        by_discovery = self.locator.resolve(None, self.temp.root)
        by_path = self.locator.resolve(self.temp.database)
        self.assertEqual(by_discovery.database, by_path.database)


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class ProjectForTests(unittest.TestCase):
    def test_module_helper_discovers_the_repository_project(self) -> None:
        repo_root = CLI_PATH.parent.parent.parent.parent
        self.assertEqual(project_for(None, repo_root).root, repo_root)


if __name__ == "__main__":
    unittest.main()
