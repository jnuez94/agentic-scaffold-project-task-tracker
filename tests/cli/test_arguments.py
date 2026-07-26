"""ArgumentBuilder and the require_* helpers."""

from __future__ import annotations

import unittest

from coordination_ui.cli import ArgumentBuilder, ArgumentError, require_choice, require_str


class ArgumentBuilderStructureTests(unittest.TestCase):
    def test_starts_with_the_command_words(self) -> None:
        self.assertEqual(ArgumentBuilder("task", "list").args, ["task", "list"])

    def test_option_is_a_single_joined_token(self) -> None:
        # Two tokens would let a value beginning with "-" be read as an option.
        builder = ArgumentBuilder("task", "create").option("--title", "-weird")
        self.assertEqual(builder.args, ["task", "create", "--title=-weird"])

    def test_flag_appends_bare_token(self) -> None:
        self.assertEqual(ArgumentBuilder("agent", "list").flag("--all").args[-1], "--all")

    def test_positional_appends_and_resets_option_count(self) -> None:
        builder = ArgumentBuilder("task", "status").positional("UI-1").positional("done")
        self.assertEqual(builder.args, ["task", "status", "UI-1", "done"])
        self.assertEqual(builder.option_count, 0)

    def test_option_count_tracks_appended_options(self) -> None:
        builder = ArgumentBuilder("task", "update").positional("UI-1")
        self.assertEqual(builder.option_count, 0)
        builder.option("--title", "x")
        self.assertEqual(builder.option_count, 1)

    def test_args_returns_a_copy(self) -> None:
        builder = ArgumentBuilder("version")
        builder.args.append("mutated")
        self.assertEqual(builder.args, ["version"])


class TextOptionTests(unittest.TestCase):
    def test_appends_when_present(self) -> None:
        builder = ArgumentBuilder("x").text({"title": "hello"}, "title", "--title")
        self.assertEqual(builder.args[-1], "--title=hello")

    def test_skips_when_absent(self) -> None:
        self.assertEqual(ArgumentBuilder("x").text({}, "title", "--title").args, ["x"])

    def test_skips_explicit_none(self) -> None:
        self.assertEqual(
            ArgumentBuilder("x").text({"title": None}, "title", "--title").args, ["x"]
        )

    def test_preserves_empty_string(self) -> None:
        # An explicit empty string is how the CLI clears an optional text field.
        builder = ArgumentBuilder("x").text({"notes": ""}, "notes", "--notes")
        self.assertEqual(builder.args[-1], "--notes=")

    def test_preserves_surrounding_whitespace(self) -> None:
        builder = ArgumentBuilder("x").text({"n": "  padded  "}, "n", "--n")
        self.assertEqual(builder.args[-1], "--n=  padded  ")

    def test_required_missing_raises(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").text({}, "title", "--title", required=True)

    def test_required_whitespace_only_raises(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").text({"t": "   "}, "t", "--t", required=True)

    def test_non_string_raises(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").text({"t": 5}, "t", "--t")


class IdentifierOptionTests(unittest.TestCase):
    def test_appends_valid_identifier(self) -> None:
        builder = ArgumentBuilder("x").identifier({"actor": "david"}, "actor", "--actor")
        self.assertEqual(builder.args[-1], "--actor=david")

    def test_rejects_invalid_identifier(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").identifier({"actor": "--force"}, "actor", "--actor")

    def test_treats_empty_string_as_absent(self) -> None:
        self.assertEqual(
            ArgumentBuilder("x").identifier({"task": ""}, "task", "--task").args, ["x"]
        )

    def test_required_missing_raises(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").identifier({}, "actor", "--actor", required=True)


class IntegerOptionTests(unittest.TestCase):
    def test_accepts_int_and_numeric_string(self) -> None:
        self.assertEqual(
            ArgumentBuilder("x").integer({"p": 2}, "p", "--p").args[-1], "--p=2"
        )
        self.assertEqual(
            ArgumentBuilder("x").integer({"p": "3"}, "p", "--p").args[-1], "--p=3"
        )

    def test_rejects_booleans(self) -> None:
        # bool is an int subclass; accepting it would send "--priority=1" for True.
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").integer({"p": True}, "p", "--p")

    def test_rejects_non_numeric(self) -> None:
        for value in ("abc", "1.5", [], {}):
            with self.subTest(value=value):
                with self.assertRaises(ArgumentError):
                    ArgumentBuilder("x").integer({"p": value}, "p", "--p")

    def test_required_missing_raises(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").integer({}, "if_revision", "--if-revision", required=True)


class ChoiceOptionTests(unittest.TestCase):
    def test_accepts_allowed_value(self) -> None:
        builder = ArgumentBuilder("x").choice({"s": "done"}, "s", "--s", ("todo", "done"))
        self.assertEqual(builder.args[-1], "--s=done")

    def test_rejects_disallowed_value_with_allowed_list(self) -> None:
        with self.assertRaises(ArgumentError) as caught:
            ArgumentBuilder("x").choice({"s": "nope"}, "s", "--s", ("todo", "done"))
        self.assertEqual(caught.exception.details["allowed"], ["todo", "done"])

    def test_skips_when_absent(self) -> None:
        self.assertEqual(
            ArgumentBuilder("x").choice({}, "s", "--s", ("a", "b")).args, ["x"]
        )


class IdentifiersOptionTests(unittest.TestCase):
    def test_appends_each_value_and_returns_them(self) -> None:
        builder = ArgumentBuilder("x")
        collected = builder.identifiers({"a": ["p", "q"]}, "a", "--assignee")
        self.assertEqual(collected, ["p", "q"])
        self.assertEqual(builder.args, ["x", "--assignee=p", "--assignee=q"])

    def test_wraps_a_bare_string(self) -> None:
        builder = ArgumentBuilder("x")
        self.assertEqual(builder.identifiers({"a": "solo"}, "a", "--a"), ["solo"])

    def test_absent_yields_empty_list(self) -> None:
        self.assertEqual(ArgumentBuilder("x").identifiers({}, "a", "--a"), [])

    def test_rejects_duplicates(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").identifiers({"a": ["p", "p"]}, "a", "--a")

    def test_rejects_invalid_member(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").identifiers({"a": ["ok", "-bad"]}, "a", "--a")

    def test_rejects_non_list(self) -> None:
        with self.assertRaises(ArgumentError):
            ArgumentBuilder("x").identifiers({"a": {"p": 1}}, "a", "--a")


class RequireHelpersTests(unittest.TestCase):
    def test_require_choice_returns_value(self) -> None:
        self.assertEqual(require_choice({"s": "done"}, "s", ("todo", "done")), "done")

    def test_require_choice_rejects_missing(self) -> None:
        with self.assertRaises(ArgumentError):
            require_choice({}, "s", ("todo",))

    def test_require_str_returns_value(self) -> None:
        self.assertEqual(require_str({"t": "hi"}, "t"), "hi")

    def test_require_str_rejects_blank_and_non_string(self) -> None:
        for body in ({}, {"t": ""}, {"t": "   "}, {"t": 5}, {"t": None}):
            with self.subTest(body=body):
                with self.assertRaises(ArgumentError):
                    require_str(body, "t")


if __name__ == "__main__":
    unittest.main()
