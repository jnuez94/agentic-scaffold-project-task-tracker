"""Startup orchestration for ``python3 -m coordination_ui``."""

from __future__ import annotations

import errno
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from typing import Any, TextIO

from . import __version__
from .cli import CoordinationCLI, CoordinationError
from .compatibility import verify
from .discovery import DiscoveryError, Project, ProjectLocator
from .web import DEFAULT_HOST, DEFAULT_PORT, build_server, serve_forever

EXIT_OK = 0
EXIT_FAILURE = 1
EXIT_USAGE = 2


@dataclass(frozen=True)
class LaunchOptions:
    database: Path | None = None
    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    timeout: float = 30.0
    open_browser: bool = False


class Launcher:
    """Resolves the project, verifies the database, and runs the server.

    Verification happens before binding so a broken installation reports the
    CLI's own diagnostic on the terminal rather than as a 500 on the first
    request the operator makes.
    """

    def __init__(
        self,
        options: LaunchOptions,
        stderr: TextIO,
        locator: ProjectLocator | None = None,
    ) -> None:
        self.options = options
        self.stderr = stderr
        self.locator = locator or ProjectLocator()

    # -- steps --------------------------------------------------------------

    def resolve_project(self) -> Project:
        return self.locator.resolve(self.options.database)

    def preflight(self, project: Project) -> dict[str, Any]:
        """Run ``version`` and ``doctor`` before serving anything."""

        cli = CoordinationCLI(
            project.executable, project.database, project.root, self.options.timeout
        )
        version = cli.run(["version"])
        doctor = cli.run(["doctor"])
        return {"version": version, "doctor": doctor}

    def report(self, project: Project, preflight: dict[str, Any], url: str) -> None:
        version, doctor = preflight["version"], preflight["doctor"]
        lines = (
            f"coordination-ui {__version__}",
            f"  database   {project.database}",
            f"  cli        {project.executable} (v{version.get('cli_version')})",
            f"  schema     v{doctor.get('schema_version')}"
            f"   integrity {doctor.get('integrity_check')}",
            f"  serving    {url}  (loopback only, no authentication)",
            "  stop with Ctrl-C",
        )
        for line in lines:
            self.stderr.write(f"{line}\n")
        self.stderr.flush()

    # -- entry point --------------------------------------------------------

    def run(self) -> int:
        try:
            project = self.resolve_project()
        except DiscoveryError as exc:
            return self.fail(str(exc), EXIT_USAGE)

        try:
            preflight = self.preflight(project)
        except CoordinationError as exc:
            return self.fail(f"{exc.code}: {exc.message}", EXIT_FAILURE)

        # Preflight already asked for the versions; until now the answer was
        # only printed. Refusing here means an incompatible CLI is one sentence
        # at startup instead of unexplained behaviour on the operator's first
        # click.
        incompatible = verify(preflight["version"], preflight["doctor"])
        if incompatible:
            return self.fail(incompatible, EXIT_FAILURE)

        try:
            server = build_server(
                project, self.options.host, self.options.port, self.options.timeout
            )
        except ValueError as exc:
            return self.fail(str(exc), EXIT_USAGE)
        except OSError as exc:
            hint = " (try --port with a free port)" if exc.errno == errno.EADDRINUSE else ""
            return self.fail(
                f"cannot bind {self.options.host}:{self.options.port}: {exc}{hint}",
                EXIT_FAILURE,
            )

        self.report(project, preflight, server.url)
        if self.options.open_browser:
            webbrowser.open(server.url)
        try:
            serve_forever(server)
        except KeyboardInterrupt:  # pragma: no cover - interactive path
            pass
        finally:
            server.server_close()
        self.stderr.write("coordination-ui: stopped\n")
        return EXIT_OK

    def fail(self, message: str, code: int) -> int:
        self.stderr.write(f"coordination-ui: {message}\n")
        self.stderr.flush()
        return code
