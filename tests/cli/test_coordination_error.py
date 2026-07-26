"""CoordinationError and ArgumentError."""

from __future__ import annotations

import unittest

from coordination_ui.cli import ArgumentError, CoordinationError


class CoordinationErrorTests(unittest.TestCase):
    def test_carries_code_message_details_and_exit_code(self) -> None:
        error = CoordinationError("not_found", "gone", {"resource": "task"}, 3)
        self.assertEqual(error.code, "not_found")
        self.assertEqual(error.message, "gone")
        self.assertEqual(error.details, {"resource": "task"})
        self.assertEqual(error.exit_code, 3)

    def test_is_raisable_with_message(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            raise CoordinationError("boom", "exploded")
        self.assertEqual(str(caught.exception), "exploded")

    def test_http_status_derives_from_exit_code(self) -> None:
        self.assertEqual(CoordinationError("x", "y", exit_code=4).http_status, 409)
        self.assertEqual(CoordinationError("x", "y", exit_code=6).http_status, 503)

    def test_default_exit_code_is_internal_failure(self) -> None:
        self.assertEqual(CoordinationError("x", "y").exit_code, 1)

    def test_payload_shape(self) -> None:
        payload = CoordinationError("stale_task_revision", "stale", {"a": 1}, 4).to_payload()
        self.assertFalse(payload["ok"])
        self.assertEqual(payload["error"]["code"], "stale_task_revision")
        self.assertEqual(payload["error"]["details"], {"a": 1})
        self.assertEqual(payload["error"]["exit_code"], 4)

    def test_payload_omits_details_when_absent(self) -> None:
        payload = CoordinationError("invalid_actor", "no actor", None, 2).to_payload()
        self.assertNotIn("details", payload["error"])

    def test_payload_keeps_falsy_details(self) -> None:
        # An empty list is a meaningful detail; only None means "no detail".
        payload = CoordinationError("x", "y", [], 2).to_payload()
        self.assertEqual(payload["error"]["details"], [])


class ArgumentErrorTests(unittest.TestCase):
    def test_uses_the_cli_invalid_arguments_contract(self) -> None:
        error = ArgumentError("bad field")
        self.assertEqual(error.code, "invalid_arguments")
        self.assertEqual(error.exit_code, 2)
        self.assertEqual(error.http_status, 400)

    def test_is_a_coordination_error(self) -> None:
        self.assertIsInstance(ArgumentError("x"), CoordinationError)

    def test_accepts_details(self) -> None:
        error = ArgumentError("bad", {"field": "id"})
        self.assertEqual(error.details, {"field": "id"})


if __name__ == "__main__":
    unittest.main()
