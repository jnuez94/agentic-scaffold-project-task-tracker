"""Marker for a non-JSON success body."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TextResponse:
    """A success body that is not JSON.

    Exactly one command produces this: ``export`` without ``--output`` writes a
    Markdown report rather than a JSON value.
    """

    body: str
    content_type: str = "text/plain; charset=utf-8"

    def encode(self) -> bytes:
        return self.body.encode("utf-8")
