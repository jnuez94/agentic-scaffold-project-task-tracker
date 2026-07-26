"""Raw outcome of one CLI invocation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class CommandResult:
    """Everything a single ``bin/coordination`` run produced.

    Kept separate from parsing so the parser can be unit tested against
    synthetic results without spawning a process.
    """

    args: Sequence[str]
    exit_code: int
    stdout: str
    stderr: str

    @property
    def succeeded(self) -> bool:
        return self.exit_code == 0
