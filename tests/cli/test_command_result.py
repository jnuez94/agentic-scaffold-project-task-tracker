"""CommandResult value object."""

from __future__ import annotations

import unittest

from coordination_ui.cli import CommandResult


class CommandResultTests(unittest.TestCase):
    def test_succeeded_is_true_only_for_zero(self) -> None:
        self.assertTrue(CommandResult(["version"], 0, "{}", "").succeeded)
        for exit_code in (1, 2, 3, 4, 5, 6):
            with self.subTest(exit_code=exit_code):
                self.assertFalse(CommandResult([], exit_code, "", "").succeeded)

    def test_is_frozen(self) -> None:
        result = CommandResult(["version"], 0, "", "")
        with self.assertRaises(Exception):
            result.exit_code = 1  # type: ignore[misc]

    def test_retains_streams_and_args(self) -> None:
        result = CommandResult(["task", "list"], 0, "out", "err")
        self.assertEqual(list(result.args), ["task", "list"])
        self.assertEqual(result.stdout, "out")
        self.assertEqual(result.stderr, "err")


if __name__ == "__main__":
    unittest.main()
