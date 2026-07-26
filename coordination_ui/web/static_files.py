"""Serving the built frontend bundle."""

from __future__ import annotations

import mimetypes
from pathlib import Path

DEFAULT_DOCUMENT = "index.html"
FALLBACK_CONTENT_TYPE = "application/octet-stream"


class StaticFileResolver:
    """Resolves request paths to files beneath one root directory.

    Containment is checked after resolution rather than by inspecting the
    request path for ``..``: resolving first and then asserting the result is
    still under the root also defeats symlinks and encoded traversal, which a
    string check would miss.
    """

    def __init__(self, root: Path, default_document: str = DEFAULT_DOCUMENT) -> None:
        self.root = Path(root).resolve()
        self.default_document = default_document

    def resolve(self, path: str) -> Path | None:
        """Return the file for ``path``, or ``None`` if it escapes the root."""

        relative = self.default_document if path in ("", "/") else path.lstrip("/")
        if not relative:
            relative = self.default_document
        candidate = (self.root / relative).resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError:
            return None
        return candidate

    @staticmethod
    def content_type(path: Path) -> str:
        guessed, _ = mimetypes.guess_type(path.name)
        return guessed or FALLBACK_CONTENT_TYPE

    def read(self, path: str) -> tuple[bytes, str] | None:
        """Return ``(body, content_type)``, or ``None`` when there is no file."""

        candidate = self.resolve(path)
        if candidate is None or not candidate.is_file():
            return None
        return candidate.read_bytes(), self.content_type(candidate)
