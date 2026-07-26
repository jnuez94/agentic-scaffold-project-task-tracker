"""The single error type crossing every layer of the console."""

from __future__ import annotations

from typing import Any

from .exit_codes import http_status_for


class CoordinationError(Exception):
    """A structured failure, either reported by the CLI or raised before it.

    The CLI contract requires consumers to branch on ``error.code`` rather than
    on message text, so the code is carried verbatim from the CLI all the way
    to the browser. ``exit_code`` is retained because it, not the message,
    determines the HTTP status.
    """

    def __init__(
        self,
        code: str,
        message: str,
        details: Any = None,
        exit_code: int = 1,
        http_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details
        self.exit_code = exit_code
        self._http_status = http_status

    @property
    def http_status(self) -> int:
        """The HTTP status for this failure.

        Normally derived from the CLI's exit code. The override exists for
        failures the CLI has no concept of — a wrong HTTP verb is a routing
        fact, not a coordination outcome, and deserves 405 rather than the 400
        that its exit code would otherwise produce.
        """

        if self._http_status is not None:
            return self._http_status
        return http_status_for(self.exit_code)

    def to_payload(self) -> dict[str, Any]:
        """Render the wire form the frontend consumes."""

        error: dict[str, Any] = {
            "code": self.code,
            "message": self.message,
            "exit_code": self.exit_code,
        }
        if self.details is not None:
            error["details"] = self.details
        return {"ok": False, "error": error}

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f"{type(self).__name__}(code={self.code!r}, "
            f"exit_code={self.exit_code!r}, message={self.message!r})"
        )
