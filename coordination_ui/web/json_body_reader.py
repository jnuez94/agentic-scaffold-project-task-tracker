"""Reading and validating JSON request bodies."""

from __future__ import annotations

import json
from typing import Any, BinaryIO, Mapping

from ..cli import CoordinationError

MAX_BODY_BYTES = 2 * 1024 * 1024
REQUIRED_CONTENT_TYPE = "application/json"


class JsonBodyReader:
    """Parses a POST body into a dict, or refuses it.

    Requiring ``application/json`` is a CSRF control as much as a parsing one:
    an HTML form can only send ``application/x-www-form-urlencoded``,
    ``multipart/form-data``, or ``text/plain``, and any other content type
    forces a CORS preflight that this server never answers. A page on another
    origin therefore cannot reach a mutation route.
    """

    def __init__(self, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.max_bytes = max_bytes

    def content_length(self, headers: Mapping[str, str]) -> int:
        raw = headers.get("Content-Length")
        if raw is None:
            raise CoordinationError(
                "invalid_arguments", "Content-Length is required", exit_code=2
            )
        try:
            length = int(raw)
        except ValueError as exc:
            raise CoordinationError(
                "invalid_arguments", "Content-Length must be an integer", exit_code=2
            ) from exc
        if length < 0 or length > self.max_bytes:
            raise CoordinationError(
                "invalid_arguments",
                f"request body must be at most {self.max_bytes} bytes",
                exit_code=2,
            )
        return length

    @staticmethod
    def content_type(headers: Mapping[str, str]) -> str:
        return (headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()

    def read(self, headers: Mapping[str, str], stream: BinaryIO) -> dict[str, Any]:
        length = self.content_length(headers)
        if length == 0:
            return {}
        if self.content_type(headers) != REQUIRED_CONTENT_TYPE:
            raise CoordinationError(
                "invalid_arguments",
                f"Content-Type must be {REQUIRED_CONTENT_TYPE}",
                exit_code=2,
            )
        return self.parse(stream.read(length))

    @staticmethod
    def parse(raw: bytes) -> dict[str, Any]:
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise CoordinationError(
                "invalid_arguments",
                f"request body is not valid JSON: {exc}",
                exit_code=2,
            ) from exc
        if not isinstance(parsed, dict):
            raise CoordinationError(
                "invalid_arguments", "request body must be a JSON object", exit_code=2
            )
        return parsed
