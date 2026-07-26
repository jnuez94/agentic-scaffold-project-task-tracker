"""ConfigFile parsing and validation."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from coordination_ui.discovery import ConfigFile, DiscoveryError

VALID = "version: 1\nbackend: sqlite\ndatabase: coordination.sqlite3\n"
CONFIG_PATH = Path("/project/.coordination/config.yml")


def parse(text: str) -> ConfigFile:
    return ConfigFile.parse(text, CONFIG_PATH)


class ParseTests(unittest.TestCase):
    def test_reads_key_value_pairs(self) -> None:
        self.assertEqual(
            parse(VALID).values,
            {"version": "1", "backend": "sqlite", "database": "coordination.sqlite3"},
        )

    def test_ignores_blank_lines_and_comments(self) -> None:
        text = "# a comment\n\n  \nversion: 1\n# another\nbackend: sqlite\ndatabase: d.sqlite3\n"
        self.assertEqual(parse(text).values["version"], "1")

    def test_ignores_surrounding_whitespace(self) -> None:
        self.assertEqual(parse("  version :  1  \n").values.get("version"), "1")

    def test_value_may_contain_a_colon(self) -> None:
        self.assertEqual(parse("note: a:b\n").values["note"], "a:b")

    def test_rejects_a_line_without_a_separator(self) -> None:
        with self.assertRaises(DiscoveryError) as caught:
            parse("version 1\n")
        self.assertIn("expected 'key: value'", str(caught.exception))

    def test_rejects_duplicate_keys(self) -> None:
        with self.assertRaises(DiscoveryError) as caught:
            parse("version: 1\nversion: 1\n")
        self.assertIn("duplicate", str(caught.exception))

    def test_reports_the_offending_line_number(self) -> None:
        with self.assertRaises(DiscoveryError) as caught:
            parse("version: 1\nbroken line\n")
        self.assertIn(":2:", str(caught.exception))


class ValidateTests(unittest.TestCase):
    def test_accepts_a_valid_config_and_returns_self(self) -> None:
        config = parse(VALID)
        self.assertIs(config.validate(), config)

    def test_validate_is_idempotent(self) -> None:
        config = parse(VALID)
        self.assertIs(config.validate().validate(), config)

    def test_requires_version_one(self) -> None:
        for text in ("backend: sqlite\ndatabase: d\n", "version: 2\nbackend: sqlite\ndatabase: d\n"):
            with self.subTest(text=text):
                with self.assertRaises(DiscoveryError):
                    parse(text).validate()

    def test_requires_sqlite_backend(self) -> None:
        with self.assertRaises(DiscoveryError):
            parse("version: 1\nbackend: markdown\ndatabase: d\n").validate()

    def test_requires_nonempty_database(self) -> None:
        with self.assertRaises(DiscoveryError):
            parse("version: 1\nbackend: sqlite\ndatabase:\n").validate()


class DatabasePathTests(unittest.TestCase):
    def test_resolves_beneath_the_coordination_directory(self) -> None:
        self.assertEqual(
            parse(VALID).database_path(),
            Path("/project/.coordination/coordination.sqlite3"),
        )

    def test_allows_a_subdirectory(self) -> None:
        text = "version: 1\nbackend: sqlite\ndatabase: nested/db.sqlite3\n"
        self.assertEqual(
            parse(text).database_path(),
            Path("/project/.coordination/nested/db.sqlite3"),
        )

    def test_rejects_absolute_paths(self) -> None:
        text = "version: 1\nbackend: sqlite\ndatabase: /etc/passwd\n"
        with self.assertRaises(DiscoveryError):
            parse(text).database_path()

    def test_rejects_parent_traversal(self) -> None:
        text = "version: 1\nbackend: sqlite\ndatabase: ../escaped.sqlite3\n"
        with self.assertRaises(DiscoveryError):
            parse(text).database_path()

    def test_rejects_nested_coordination_component(self) -> None:
        text = "version: 1\nbackend: sqlite\ndatabase: .coordination/db.sqlite3\n"
        with self.assertRaises(DiscoveryError):
            parse(text).database_path()

    def test_rejects_reserved_root_names_case_insensitively(self) -> None:
        for name in ("config.yml", "README.md", "Backups/x.sqlite3", "BACKUPS/y"):
            with self.subTest(name=name):
                text = f"version: 1\nbackend: sqlite\ndatabase: {name}\n"
                with self.assertRaises(DiscoveryError):
                    parse(text).database_path()


class LoadTests(unittest.TestCase):
    def test_reads_from_disk(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.yml"
            path.write_text(VALID, encoding="utf-8")
            self.assertEqual(ConfigFile.load(path).values["backend"], "sqlite")

    def test_rejects_a_missing_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(DiscoveryError):
                ConfigFile.load(Path(directory) / "absent.yml")

    def test_rejects_a_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            real = root / "real.yml"
            real.write_text(VALID, encoding="utf-8")
            link = root / "config.yml"
            link.symlink_to(real)
            with self.assertRaises(DiscoveryError):
                ConfigFile.load(link)

    def test_rejects_a_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(DiscoveryError):
                ConfigFile.load(Path(directory))


if __name__ == "__main__":
    unittest.main()
