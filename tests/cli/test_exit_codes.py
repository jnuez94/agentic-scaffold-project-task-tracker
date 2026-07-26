"""Exit code to HTTP status mapping."""

from __future__ import annotations

import unittest
from http import HTTPStatus

from coordination_ui.cli.exit_codes import (
    DEFAULT_HTTP_STATUS,
    EXIT_CODE_TO_HTTP_STATUS,
    http_status_for,
)


class HttpStatusForTests(unittest.TestCase):
    def test_maps_every_contractual_exit_code(self) -> None:
        expected = {
            0: 200,
            1: 500,
            2: 400,
            3: 404,
            4: 409,
            5: 500,
            6: 503,
        }
        for exit_code, status in expected.items():
            with self.subTest(exit_code=exit_code):
                self.assertEqual(http_status_for(exit_code), status)

    def test_unknown_exit_code_falls_back_to_server_error(self) -> None:
        self.assertEqual(http_status_for(99), HTTPStatus.INTERNAL_SERVER_ERROR)
        self.assertEqual(http_status_for(-1), DEFAULT_HTTP_STATUS)

    def test_returns_plain_int(self) -> None:
        # json.dumps handles IntEnum, but downstream equality checks are
        # clearer when the value is a bare int.
        self.assertIsInstance(http_status_for(4), int)

    def test_table_covers_documented_range(self) -> None:
        self.assertEqual(set(EXIT_CODE_TO_HTTP_STATUS), {0, 1, 2, 3, 4, 5, 6})


if __name__ == "__main__":
    unittest.main()
