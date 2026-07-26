"""Location of the installed coordination CLI."""

from __future__ import annotations

import os
from pathlib import Path

from .errors import DiscoveryError

DEFAULT_CLI_RELPATH = Path(".agents/agentic-project-scaffold-lite/bin/coordination")
OVERRIDE_ENV_VAR = "COORDINATION_BIN"


class ExecutableLocator:
    """Finds the ``bin/coordination`` executable serving a project root."""

    def __init__(self, environ: dict[str, str] | None = None) -> None:
        self.environ = os.environ if environ is None else environ

    def locate(self, project_root: Path) -> Path:
        """Return the CLI for ``project_root``.

        ``COORDINATION_BIN`` wins when set, which is what lets the test suite
        point the console at a CLI outside the repository under test.
        """

        override = self.environ.get(OVERRIDE_ENV_VAR)
        if override:
            executable = Path(override).expanduser()
            if not executable.is_file():
                raise DiscoveryError(
                    f"{OVERRIDE_ENV_VAR} does not name a file: {executable}"
                )
            return executable.resolve()
        executable = Path(project_root) / DEFAULT_CLI_RELPATH
        if not executable.is_file():
            raise DiscoveryError(
                f"coordination CLI not found at {executable}; "
                f"set {OVERRIDE_ENV_VAR} to override"
            )
        return executable.resolve()
