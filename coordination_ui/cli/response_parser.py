"""Turn a :class:`CommandResult` into data, or into a CoordinationError.

Split from the process runner so every branch of the CLI's JSON and stream
contract can be tested without spawning a subprocess.
"""

from __future__ import annotations

import json
from typing import Any

from .command_result import CommandResult
from .coordination_error import CoordinationError

MAX_ECHOED_OUTPUT = 2000


def loads(raw: str) -> Any:
    """Parse JSON leniently; return ``None`` when the text is not JSON."""

    text = (raw or "").strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


class ResponseParser:
    """Applies the contract's JSON and stream rules to a command result."""

    @staticmethod
    def error_from(result: CommandResult) -> CoordinationError:
        """Build the error a failed invocation represents.

        Expected failures write one JSON value to stderr. Anything else — an
        unparseable stream, or a failure that only wrote to stdout — still has
        to become a structured error, so the raw text is preserved as the
        message under a synthetic ``cli_failure`` code.
        """

        payload = loads(result.stderr) or loads(result.stdout)
        if isinstance(payload, dict) and payload.get("ok") is False:
            error = payload.get("error")
            if isinstance(error, dict):
                return CoordinationError(
                    str(error.get("code", "unknown_error")),
                    str(error.get("message", "coordination CLI reported a failure")),
                    error.get("details"),
                    exit_code=result.exit_code,
                )
        detail = (result.stderr or result.stdout).strip()
        return CoordinationError(
            "cli_failure",
            detail or f"coordination CLI exited with code {result.exit_code}",
            {"command": list(result.args)},
            exit_code=result.exit_code,
        )

    @classmethod
    def data(cls, result: CommandResult) -> Any:
        """Return the ``data`` payload of a successful JSON command."""

        if not result.succeeded:
            raise cls.error_from(result)
        payload = loads(result.stdout)
        if not isinstance(payload, dict) or payload.get("ok") is not True:
            raise CoordinationError(
                "cli_protocol_error",
                "coordination CLI did not return a JSON success value",
                {
                    "command": list(result.args),
                    "stdout": result.stdout[:MAX_ECHOED_OUTPUT],
                },
                exit_code=5,
            )
        return payload.get("data")

    @classmethod
    def text(cls, result: CommandResult) -> str:
        """Return stdout for the one command whose success output is Markdown."""

        if not result.succeeded:
            raise cls.error_from(result)
        return result.stdout
