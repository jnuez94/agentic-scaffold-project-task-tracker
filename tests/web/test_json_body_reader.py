"""JsonBodyReader."""

from __future__ import annotations

import io
import json
import unittest

from coordination_ui.cli import CoordinationError
from coordination_ui.web import JsonBodyReader


def headers(length: int | str | None, content_type: str | None = "application/json") -> dict[str, str]:
    result: dict[str, str] = {}
    if length is not None:
        result["Content-Length"] = str(length)
    if content_type is not None:
        result["Content-Type"] = content_type
    return result


class ContentLengthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.reader = JsonBodyReader()

    def test_parses_a_valid_length(self) -> None:
        self.assertEqual(self.reader.content_length(headers(12)), 12)

    def test_requires_the_header(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.reader.content_length(headers(None))
        self.assertEqual(caught.exception.exit_code, 2)

    def test_rejects_a_non_numeric_length(self) -> None:
        with self.assertRaises(CoordinationError):
            self.reader.content_length(headers("many"))

    def test_rejects_a_negative_length(self) -> None:
        with self.assertRaises(CoordinationError):
            self.reader.content_length(headers(-1))

    def test_rejects_a_length_over_the_cap(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            self.reader.content_length(headers(3 * 1024 * 1024))
        self.assertIn("at most", caught.exception.message)

    def test_honors_a_custom_cap(self) -> None:
        with self.assertRaises(CoordinationError):
            JsonBodyReader(max_bytes=10).content_length(headers(11))


class ContentTypeTests(unittest.TestCase):
    def test_strips_parameters_and_lowercases(self) -> None:
        self.assertEqual(
            JsonBodyReader.content_type({"Content-Type": "Application/JSON; charset=utf-8"}),
            "application/json",
        )

    def test_missing_header_is_empty(self) -> None:
        self.assertEqual(JsonBodyReader.content_type({}), "")


class ParseTests(unittest.TestCase):
    def test_parses_a_json_object(self) -> None:
        self.assertEqual(JsonBodyReader.parse(b'{"a": 1}'), {"a": 1})

    def test_rejects_invalid_json(self) -> None:
        with self.assertRaises(CoordinationError) as caught:
            JsonBodyReader.parse(b"{not json")
        self.assertEqual(caught.exception.code, "invalid_arguments")

    def test_rejects_invalid_utf8(self) -> None:
        with self.assertRaises(CoordinationError):
            JsonBodyReader.parse(b"\xff\xfe")

    def test_rejects_a_non_object_top_level(self) -> None:
        for raw in (b"[1, 2]", b'"text"', b"5", b"null"):
            with self.subTest(raw=raw):
                with self.assertRaises(CoordinationError):
                    JsonBodyReader.parse(raw)

    def test_preserves_unicode(self) -> None:
        raw = json.dumps({"note": "é 🙂"}).encode("utf-8")
        self.assertEqual(JsonBodyReader.parse(raw)["note"], "é 🙂")


class ReadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.reader = JsonBodyReader()

    def test_reads_exactly_content_length_bytes(self) -> None:
        raw = b'{"a": 1}trailing'
        body = self.reader.read(headers(8), io.BytesIO(raw))
        self.assertEqual(body, {"a": 1})

    def test_zero_length_is_an_empty_body(self) -> None:
        self.assertEqual(self.reader.read(headers(0, None), io.BytesIO(b"")), {})

    def test_requires_json_content_type(self) -> None:
        # A cross-site HTML form can only send urlencoded, multipart, or plain
        # text; requiring JSON forces a preflight this server never answers.
        for content_type in (
            "application/x-www-form-urlencoded",
            "multipart/form-data",
            "text/plain",
            None,
        ):
            with self.subTest(content_type=content_type):
                with self.assertRaises(CoordinationError) as caught:
                    self.reader.read(headers(8, content_type), io.BytesIO(b'{"a": 1}'))
                self.assertIn("Content-Type", caught.exception.message)

    def test_accepts_a_charset_parameter(self) -> None:
        body = self.reader.read(
            headers(8, "application/json; charset=utf-8"), io.BytesIO(b'{"a": 1}')
        )
        self.assertEqual(body, {"a": 1})


if __name__ == "__main__":
    unittest.main()
