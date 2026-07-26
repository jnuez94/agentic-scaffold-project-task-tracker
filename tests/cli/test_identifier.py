"""Identifier grammar enforcement."""

from __future__ import annotations

import unittest

from coordination_ui.cli import ArgumentError, IdentifierValidator, validate_identifier


class IdentifierValidatorTests(unittest.TestCase):
    def test_accepts_contract_grammar(self) -> None:
        for value in ("a", "9", "UI-1", "claude-code", "a.b_c:d@e+f-g", "A" * 128):
            with self.subTest(value=value):
                self.assertTrue(IdentifierValidator.is_valid(value))

    def test_rejects_leading_punctuation(self) -> None:
        # This is the property that stops an identifier from being parsed as a
        # CLI option: positional arguments cannot use the --flag=value form.
        for value in ("-force", "--db", ".hidden", "_x", "+1", ":a", "@a"):
            with self.subTest(value=value):
                self.assertFalse(IdentifierValidator.is_valid(value))

    def test_rejects_disallowed_characters(self) -> None:
        for value in ("a b", "a/b", "a\nb", "a;b", "a$b", "a'b", 'a"b', "a\\b", "é"):
            with self.subTest(value=value):
                self.assertFalse(IdentifierValidator.is_valid(value))

    def test_rejects_empty_and_overlong(self) -> None:
        self.assertFalse(IdentifierValidator.is_valid(""))
        self.assertFalse(IdentifierValidator.is_valid("A" * 129))

    def test_rejects_non_strings(self) -> None:
        for value in (None, 1, 1.5, True, ["a"], {"a": 1}):
            with self.subTest(value=value):
                self.assertFalse(IdentifierValidator.is_valid(value))

    def test_rejects_embedded_newline_even_when_prefix_is_valid(self) -> None:
        self.assertFalse(IdentifierValidator.is_valid("UI-1\nrm -rf"))

    def test_validate_returns_the_value(self) -> None:
        self.assertEqual(IdentifierValidator.validate("UI-1", "id"), "UI-1")

    def test_validate_raises_argument_error_naming_the_field(self) -> None:
        with self.assertRaises(ArgumentError) as caught:
            IdentifierValidator.validate("-x", "task")
        self.assertEqual(caught.exception.code, "invalid_arguments")
        self.assertEqual(caught.exception.details, {"field": "task"})
        self.assertIn("task", caught.exception.message)


class ValidateIdentifierFunctionTests(unittest.TestCase):
    def test_delegates_to_the_validator(self) -> None:
        self.assertEqual(validate_identifier("ok-1", "id"), "ok-1")
        with self.assertRaises(ArgumentError):
            validate_identifier("", "id")


if __name__ == "__main__":
    unittest.main()
