"""Router dispatch, plus the enums and TextResponse value objects."""

from __future__ import annotations

import unittest
from pathlib import Path
from typing import Any

from coordination_ui.api import ROUTES, Request, Router, TextResponse, enums
from coordination_ui.api.context import ApiContext
from coordination_ui.cli import CoordinationError
from coordination_ui.discovery import Project


def stub_context() -> ApiContext:
    project = Project(
        root=Path("/p"),
        config_path=Path("/p/.coordination/config.yml"),
        database=Path("/p/.coordination/db.sqlite3"),
        executable=Path("/p/bin/coordination"),
    )
    return ApiContext(project, cli=object())  # type: ignore[arg-type]


def echo(request: Request) -> dict[str, Any]:
    return {
        "params": dict(request.params),
        "query": {k: list(v) for k, v in request.query.items()},
        "body": dict(request.body),
        "session": request.session,
    }


class DispatchTests(unittest.TestCase):
    def setUp(self) -> None:
        self.router = Router(
            stub_context(),
            [
                ("GET", r"/api/things", echo),
                ("POST", r"/api/things", echo),
                ("GET", r"/api/things/(?P<id>[^/]+)", echo),
                ("GET", r"/api/things/(?P<id>[^/]+)/parts", echo),
            ],
        )

    def test_matches_a_static_route(self) -> None:
        self.assertEqual(self.router.dispatch("GET", "/api/things")["params"], {})

    def test_captures_path_parameters(self) -> None:
        result = self.router.dispatch("GET", "/api/things/UI-1")
        self.assertEqual(result["params"], {"id": "UI-1"})

    def test_identifier_group_does_not_swallow_a_subpath(self) -> None:
        result = self.router.dispatch("GET", "/api/things/UI-1/parts")
        self.assertEqual(result["params"], {"id": "UI-1"})

    def test_patterns_are_anchored(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.router.dispatch("GET", "/api/things/UI-1/parts/extra")
        self.assertEqual(caught.exception.code, "not_found")

    def test_prefix_of_a_route_does_not_match(self) -> None:
        with self.assertRaises(CoordinationError):
            self.router.dispatch("GET", "/api/thing")

    def test_method_mismatch_reports_allowed_methods(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.router.dispatch("DELETE", "/api/things")
        self.assertEqual(caught.exception.code, "method_not_allowed")
        self.assertEqual(caught.exception.exit_code, 2)
        self.assertEqual(caught.exception.details["allowed"], ["GET", "POST"])

    def test_unknown_path_is_not_found_with_exit_three(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.router.dispatch("GET", "/api/nope")
        self.assertEqual(caught.exception.code, "not_found")
        self.assertEqual(caught.exception.exit_code, 3)
        self.assertEqual(caught.exception.http_status, 404)

    def test_passes_query_body_and_session_through(self) -> None:
        result = self.router.dispatch(
            "POST", "/api/things", {"a": ["1"]}, {"b": 2}, "sess-1"
        )
        self.assertEqual(result["query"], {"a": ["1"]})
        self.assertEqual(result["body"], {"b": 2})
        self.assertEqual(result["session"], "sess-1")

    def test_defaults_are_empty_rather_than_none(self) -> None:
        result = self.router.dispatch("GET", "/api/things")
        self.assertEqual(result["query"], {})
        self.assertEqual(result["body"], {})
        self.assertIsNone(result["session"])


class RouteTableTests(unittest.TestCase):
    def test_every_route_is_a_method_pattern_handler_triple(self) -> None:
        for route in ROUTES:
            method, pattern, handler = route
            self.assertIn(method, ("GET", "POST"))
            self.assertTrue(pattern.startswith("/api/"))
            self.assertTrue(callable(handler))

    def test_no_duplicate_method_and_pattern_pairs(self) -> None:
        keys = [(method, pattern) for method, pattern, _ in ROUTES]
        self.assertEqual(len(keys), len(set(keys)))

    def test_covers_every_coordination_entity(self) -> None:
        patterns = " ".join(pattern for _, pattern, _ in ROUTES)
        for entity in (
            "agents",
            "sessions",
            "tasks",
            "evidence",
            "dependencies",
            "reviews",
            "decisions",
            "messages",
            "artifacts",
            "escalations",
            "health",
            "audit",
            "export",
        ):
            with self.subTest(entity=entity):
                self.assertIn(entity, patterns)

    def test_does_not_expose_destructive_filesystem_commands(self) -> None:
        patterns = " ".join(pattern for _, pattern, _ in ROUTES)
        for excluded in ("backup", "restore", "init"):
            with self.subTest(excluded=excluded):
                self.assertNotIn(excluded, patterns)


class EnumsTests(unittest.TestCase):
    def test_task_statuses_match_the_schema_check(self) -> None:
        self.assertEqual(
            enums.TASK_STATUSES, ("todo", "in_progress", "review", "blocked", "done")
        )

    def test_transitions_cover_every_status(self) -> None:
        self.assertEqual(set(enums.TASK_TRANSITIONS), set(enums.TASK_STATUSES))

    def test_done_is_terminal(self) -> None:
        self.assertEqual(enums.TASK_TRANSITIONS["done"], ())

    def test_every_transition_target_is_a_valid_status(self) -> None:
        for targets in enums.TASK_TRANSITIONS.values():
            for target in targets:
                self.assertIn(target, enums.TASK_STATUSES)

    def test_release_targets_exclude_in_progress_and_done(self) -> None:
        self.assertNotIn("in_progress", enums.RELEASE_TARGETS)
        self.assertNotIn("done", enums.RELEASE_TARGETS)

    def test_describe_is_json_safe_lists(self) -> None:
        described = enums.describe()
        self.assertIsInstance(described["statuses"]["task"], list)
        self.assertIsInstance(described["transitions"]["todo"], list)


class TextResponseTests(unittest.TestCase):
    def test_defaults_to_plain_text(self) -> None:
        self.assertEqual(TextResponse("hi").content_type, "text/plain; charset=utf-8")

    def test_encodes_as_utf8(self) -> None:
        self.assertEqual(TextResponse("é").encode(), "é".encode("utf-8"))

    def test_is_frozen(self) -> None:
        with self.assertRaises(Exception):
            TextResponse("a").body = "b"  # type: ignore[misc]


if __name__ == "__main__":
    unittest.main()
