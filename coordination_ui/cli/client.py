"""The only component in the console that runs the coordination CLI."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Sequence

from .command_result import CommandResult
from .coordination_error import CoordinationError
from .identifier import validate_identifier
from .response_parser import ResponseParser

DEFAULT_TIMEOUT_SECONDS = 30.0


class CoordinationCLI:
    """Runs ``bin/coordination`` against one database.

    Nothing here opens the database. The CLI keeps sole responsibility for
    validation, locking, revision checks, transition rules, and audit
    attribution, which is what ``AGENTS.md`` requires of any tool that touches
    coordination state.
    """

    def __init__(
        self,
        executable: Path,
        database: Path,
        cwd: Path,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        parser: type[ResponseParser] = ResponseParser,
    ) -> None:
        self.executable = Path(executable)
        self.database = Path(database)
        self.cwd = Path(cwd)
        self.timeout = timeout
        self.parser = parser

    # -- argv ---------------------------------------------------------------

    def build_command(
        self, args: Sequence[str], session: str | None = None
    ) -> list[str]:
        """Return the full argv for ``args``, including global options."""

        command = [str(self.executable), f"--db={self.database}"]
        if session:
            command.append(f"--session={validate_identifier(session, 'session')}")
        command.extend(args)
        return command

    # -- invocation ---------------------------------------------------------

    def invoke(self, args: Sequence[str], session: str | None = None) -> CommandResult:
        """Run the CLI once and capture its streams.

        ``subprocess.run`` receives a list and never a shell string, so no
        argument can be interpreted as shell syntax.
        """

        command = self.build_command(args, session)
        try:
            completed = subprocess.run(  # noqa: S603 - fixed local executable, no shell
                command,
                cwd=str(self.cwd),
                capture_output=True,
                text=True,
                timeout=self.timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise CoordinationError(
                "cli_timeout",
                f"coordination CLI exceeded {self.timeout:g}s",
                {"command": list(args)},
                exit_code=5,
            ) from exc
        except OSError as exc:
            raise CoordinationError(
                "cli_unavailable",
                f"could not execute {self.executable}: {exc}",
                {"executable": str(self.executable)},
                exit_code=5,
            ) from exc
        return CommandResult(
            args=list(args),
            exit_code=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )

    # -- typed entry points -------------------------------------------------

    def run(self, args: Sequence[str], session: str | None = None) -> Any:
        """Run a JSON command and return its ``data`` payload."""

        return self.parser.data(self.invoke(args, session))

    def run_text(self, args: Sequence[str], session: str | None = None) -> str:
        """Run a command whose success output is plain text (``export``)."""

        return self.parser.text(self.invoke(args, session))
