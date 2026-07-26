"""Request-shaping failures detected before the CLI is invoked."""

from __future__ import annotations

from typing import Any

from .coordination_error import CoordinationError


class ArgumentError(CoordinationError):
    """The console request was malformed.

    Reported with the CLI's own ``invalid_arguments`` code and exit code 2 so
    the frontend handles a locally-detected bad request and a CLI-detected one
    through exactly one branch.
    """

    def __init__(self, message: str, details: Any = None) -> None:
        super().__init__("invalid_arguments", message, details, exit_code=2)
