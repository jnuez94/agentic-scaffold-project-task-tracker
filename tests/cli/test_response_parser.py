"""Parsing the CLI's JSON and stream contract."""

from __future__ import annotations

import json
import unittest

from coordination_ui.cli import CommandResult, CoordinationError, ResponseParser
from coordination_ui.cli.response_parser import loads


def failure(code: str, message: str = "nope", details: object = None) -> str:
    error: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return json.dumps({"ok": False, "error": error})


class LoadsTests(unittest.TestCase):
    def test_parses_json(self) -> None:
        self.assertEqual(loads('{"a": 1}'), {"a": 1})

    def test_returns_none_for_blank_or_invalid(self) -> None:
        for raw in ("", "   ", "\n", "not json", "{", "<html>"):
            with self.subTest(raw=raw):
                self.assertIsNone(loads(raw))

    def test_tolerates_surrounding_whitespace(self) -> None:
        self.assertEqual(loads('\n  {"a": 1}\n'), {"a": 1})


class ResponseParserDataTests(unittest.TestCase):
    def test_returns_data_payload(self) -> None:
        result = CommandResult(["task", "list"], 0, '{"ok": true, "data": [1, 2]}', "")
        self.assertEqual(ResponseParser.data(result), [1, 2])

    def test_returns_none_when_data_key_absent(self) -> None:
        result = CommandResult([], 0, '{"ok": true}', "")
        self.assertIsNone(ResponseParser.data(result))

    def test_raises_protocol_error_on_non_json_success(self) -> None:
        result = CommandResult(["export"], 0, "# a markdown report", "")
        with self.assertRaises(CoordinationError) as caught:
            ResponseParser.data(result)
        self.assertEqual(caught.exception.code, "cli_protocol_error")
        self.assertEqual(caught.exception.exit_code, 5)

    def test_raises_protocol_error_when_ok_is_false_on_stdout_with_zero_exit(self) -> None:
        result = CommandResult([], 0, failure("weird"), "")
        with self.assertRaises(CoordinationError) as caught:
            ResponseParser.data(result)
        self.assertEqual(caught.exception.code, "cli_protocol_error")

    def test_truncates_echoed_stdout(self) -> None:
        result = CommandResult([], 0, "x" * 5000, "")
        with self.assertRaises(CoordinationError) as caught:
            ResponseParser.data(result)
        self.assertLessEqual(len(caught.exception.details["stdout"]), 2000)


class ResponseParserErrorTests(unittest.TestCase):
    def test_reads_structured_error_from_stderr(self) -> None:
        result = CommandResult(
            [], 4, "", failure("stale_task_revision", "stale", {"actual_revision": 6})
        )
        error = ResponseParser.error_from(result)
        self.assertEqual(error.code, "stale_task_revision")
        self.assertEqual(error.message, "stale")
        self.assertEqual(error.details, {"actual_revision": 6})
        self.assertEqual(error.exit_code, 4)
        self.assertEqual(error.http_status, 409)

    def test_falls_back_to_stdout_when_stderr_is_empty(self) -> None:
        result = CommandResult([], 3, failure("not_found"), "")
        self.assertEqual(ResponseParser.error_from(result).code, "not_found")

    def test_synthesizes_error_for_unparseable_output(self) -> None:
        result = CommandResult(["doctor"], 5, "", "Traceback: boom")
        error = ResponseParser.error_from(result)
        self.assertEqual(error.code, "cli_failure")
        self.assertEqual(error.message, "Traceback: boom")
        self.assertEqual(error.exit_code, 5)

    def test_synthesizes_error_when_both_streams_are_empty(self) -> None:
        error = ResponseParser.error_from(CommandResult(["x"], 2, "", ""))
        self.assertEqual(error.code, "cli_failure")
        self.assertIn("exited with code 2", error.message)
        self.assertEqual(error.details, {"command": ["x"]})

    def test_data_raises_the_error_for_failed_results(self) -> None:
        result = CommandResult([], 3, "", failure("not_found"))
        with self.assertRaises(CoordinationError) as caught:
            ResponseParser.data(result)
        self.assertEqual(caught.exception.code, "not_found")


class ResponseParserTextTests(unittest.TestCase):
    def test_returns_stdout_verbatim(self) -> None:
        result = CommandResult(["export"], 0, "# Report\n\ntext\n", "")
        self.assertEqual(ResponseParser.text(result), "# Report\n\ntext\n")

    def test_raises_on_failure(self) -> None:
        result = CommandResult(["export"], 4, "", failure("output_exists"))
        with self.assertRaises(CoordinationError) as caught:
            ResponseParser.text(result)
        self.assertEqual(caught.exception.code, "output_exists")


if __name__ == "__main__":
    unittest.main()
