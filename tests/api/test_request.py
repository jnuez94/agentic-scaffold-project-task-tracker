"""Request accessors."""

from __future__ import annotations

import unittest
from pathlib import Path
from typing import Any, Sequence

from coordination_ui.api import Request
from coordination_ui.api.context import ApiContext
from coordination_ui.cli import ArgumentBuilder, ArgumentError
from coordination_ui.discovery import Project


class RecordingCLI:
    """Captures argv instead of spawning a process."""

    def __init__(self) -> None:
        self.calls: list[tuple[list[str], str | None]] = []

    def run(self, args: Sequence[str], session: str | None = None) -> Any:
        self.calls.append((list(args), session))
        return {"ran": list(args)}

    def run_text(self, args: Sequence[str], session: str | None = None) -> str:
        self.calls.append((list(args), session))
        return "# report"


def make_request(**kwargs: Any) -> tuple[Request, RecordingCLI]:
    cli = RecordingCLI()
    project = Project(
        root=Path("/p"),
        config_path=Path("/p/.coordination/config.yml"),
        database=Path("/p/.coordination/db.sqlite3"),
        executable=Path("/p/bin/coordination"),
    )
    context = ApiContext(project, cli)  # type: ignore[arg-type]
    return Request(context=context, **kwargs), cli


class PathIdTests(unittest.TestCase):
    def test_returns_a_valid_identifier(self) -> None:
        request, _ = make_request(params={"id": "UI-1"})
        self.assertEqual(request.path_id(), "UI-1")

    def test_rejects_an_invalid_identifier(self) -> None:
        request, _ = make_request(params={"id": "../etc/passwd"})
        with self.assertRaises(ArgumentError):
            request.path_id()

    def test_rejects_a_missing_parameter(self) -> None:
        request, _ = make_request()
        with self.assertRaises(ArgumentError):
            request.path_id()


class QueryAccessorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.request, _ = make_request(
            query={
                "status": ["todo"],
                "blank": [""],
                "limit": ["25"],
                "bad": ["abc"],
                "flag": ["1"],
                "off": ["false"],
                "multi": ["a", "b"],
            }
        )

    def test_q_returns_the_first_value(self) -> None:
        self.assertEqual(self.request.q("multi"), "a")

    def test_q_returns_default_for_missing_and_blank(self) -> None:
        self.assertIsNone(self.request.q("absent"))
        self.assertEqual(self.request.q("blank", "fallback"), "fallback")

    def test_q_int_parses(self) -> None:
        self.assertEqual(self.request.q_int("limit"), 25)

    def test_q_int_uses_default_when_absent(self) -> None:
        self.assertEqual(self.request.q_int("absent", 7), 7)

    def test_q_int_rejects_non_numeric(self) -> None:
        with self.assertRaises(ArgumentError):
            self.request.q_int("bad")

    def test_q_flag_is_true_for_present_truthy_values(self) -> None:
        self.assertTrue(self.request.q_flag("flag"))

    def test_q_flag_is_false_for_absent_and_falsy_words(self) -> None:
        self.assertFalse(self.request.q_flag("absent"))
        self.assertFalse(self.request.q_flag("off"))

    def test_q_choice_accepts_allowed(self) -> None:
        self.assertEqual(self.request.q_choice("status", ("todo", "done")), "todo")

    def test_q_choice_rejects_disallowed(self) -> None:
        with self.assertRaises(ArgumentError) as caught:
            self.request.q_choice("status", ("done",))
        self.assertEqual(caught.exception.details["parameter"], "status")

    def test_q_choice_returns_none_when_absent(self) -> None:
        self.assertIsNone(self.request.q_choice("absent", ("a",)))

    def test_q_identifier_validates(self) -> None:
        request, _ = make_request(query={"assignee": ["david"], "bad": ["-x"]})
        self.assertEqual(request.q_identifier("assignee"), "david")
        with self.assertRaises(ArgumentError):
            request.q_identifier("bad")


class PagingTests(unittest.TestCase):
    def test_appends_nothing_when_absent(self) -> None:
        request, _ = make_request()
        self.assertEqual(request.paging(ArgumentBuilder("task", "list")).args,
                         ["task", "list"])

    def test_appends_limit_and_offset(self) -> None:
        request, _ = make_request(query={"limit": ["10"], "offset": ["5"]})
        args = request.paging(ArgumentBuilder("task", "list")).args
        self.assertIn("--limit=10", args)
        self.assertIn("--offset=5", args)

    def test_clamps_limit_to_the_contract_maximum(self) -> None:
        request, _ = make_request(query={"limit": ["9999"]})
        self.assertIn("--limit=500", request.paging(ArgumentBuilder("x")).args)

    def test_clamps_limit_to_at_least_one(self) -> None:
        request, _ = make_request(query={"limit": ["0"]})
        self.assertIn("--limit=1", request.paging(ArgumentBuilder("x")).args)

    def test_clamps_negative_offset_to_zero(self) -> None:
        request, _ = make_request(query={"offset": ["-4"]})
        self.assertIn("--offset=0", request.paging(ArgumentBuilder("x")).args)


class RunTests(unittest.TestCase):
    def test_run_passes_builder_args(self) -> None:
        request, cli = make_request()
        request.run(ArgumentBuilder("version"))
        self.assertEqual(cli.calls[0][0], ["version"])

    def test_run_omits_the_session_by_default(self) -> None:
        request, cli = make_request(session="s-1")
        request.run(ArgumentBuilder("task", "list"))
        self.assertIsNone(cli.calls[0][1])

    def test_run_forwards_the_session_when_requested(self) -> None:
        request, cli = make_request(session="s-1")
        request.run(ArgumentBuilder("task", "claim"), with_session=True)
        self.assertEqual(cli.calls[0][1], "s-1")

    def test_run_accepts_a_plain_list(self) -> None:
        request, cli = make_request()
        request.run(["doctor"])
        self.assertEqual(cli.calls[0][0], ["doctor"])

    def test_run_text_returns_the_string(self) -> None:
        request, _ = make_request()
        self.assertEqual(request.run_text(ArgumentBuilder("export")), "# report")


if __name__ == "__main__":
    unittest.main()
