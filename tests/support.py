"""Shared fixtures for the console test suite.

Every test that needs a database gets a throwaway one created by
``coordination init``. Nothing in this suite touches the repository's own
``.coordination/coordination.sqlite3``.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from coordination_ui.cli import CoordinationCLI
from coordination_ui.discovery import ExecutableLocator, Project

REPO_ROOT = Path(__file__).resolve().parent.parent
CLI_PATH = REPO_ROOT / ".agents/agentic-project-scaffold-lite/bin/coordination"

CONFIG_TEXT = "version: 1\nbackend: sqlite\ndatabase: coordination.sqlite3\n"


def cli_available() -> bool:
    """Whether the installed coordination CLI can be exercised."""

    return CLI_PATH.is_file()


def locator_for_tests() -> ExecutableLocator:
    """An executable locator pinned to the repository's CLI.

    Temporary projects have no ``.agents/`` tree, so the environment override
    is how they find a CLI at all.
    """

    return ExecutableLocator({"COORDINATION_BIN": str(CLI_PATH)})


class TemporaryProject:
    """A disposable coordination project on disk.

    Usable as a context manager or driven manually by tests that need to
    inspect the directory before the database exists.
    """

    def __init__(self, initialize: bool = True, write_config: bool = True) -> None:
        self.initialize = initialize
        self.write_config = write_config
        self._directory: tempfile.TemporaryDirectory[str] | None = None
        self.root = Path()

    # -- lifecycle ----------------------------------------------------------

    def start(self) -> "TemporaryProject":
        self._directory = tempfile.TemporaryDirectory(prefix="coordination-ui-test-")
        self.root = Path(self._directory.name).resolve()
        (self.root / ".coordination").mkdir(parents=True, exist_ok=True)
        if self.write_config:
            self.config_path.write_text(CONFIG_TEXT, encoding="utf-8")
        if self.initialize:
            self.run("init")
        return self

    def stop(self) -> None:
        if self._directory is not None:
            self._directory.cleanup()
            self._directory = None

    def __enter__(self) -> "TemporaryProject":
        return self.start()

    def __exit__(self, *exc_info: object) -> None:
        self.stop()

    # -- paths --------------------------------------------------------------

    @property
    def coordination_dir(self) -> Path:
        return self.root / ".coordination"

    @property
    def config_path(self) -> Path:
        return self.coordination_dir / "config.yml"

    @property
    def database(self) -> Path:
        return self.coordination_dir / "coordination.sqlite3"

    def project(self) -> Project:
        return Project(
            root=self.root,
            config_path=self.config_path,
            database=self.database,
            executable=CLI_PATH,
        )

    def cli(self, timeout: float = 30.0) -> CoordinationCLI:
        return CoordinationCLI(CLI_PATH, self.database, self.root, timeout)

    # -- driving the CLI ----------------------------------------------------

    def run(self, *args: str, session: str | None = None) -> Any:
        """Run a CLI command against this project and return its ``data``."""

        return self.cli().run(list(args), session)

    def raw(self, *args: str) -> subprocess.CompletedProcess[str]:
        command = [str(CLI_PATH), f"--db={self.database}", *args]
        return subprocess.run(
            command, cwd=str(self.root), capture_output=True, text=True, check=False
        )

    # -- seeding ------------------------------------------------------------

    def seed_agent(self, agent_id: str = "tester", **fields: str) -> str:
        args = [
            "agent",
            "add",
            f"--id={agent_id}",
            f"--name={fields.get('name', agent_id)}",
            f"--role={fields.get('role', 'tester')}",
        ]
        self.run(*args)
        return agent_id

    def seed_session(
        self, session_id: str = "s1", agent_id: str = "tester"
    ) -> str:
        self.run(
            "session",
            "start",
            f"--id={session_id}",
            f"--agent={agent_id}",
            "--harness=pytest",
        )
        return session_id

    def seed_task(
        self,
        task_id: str = "T-1",
        actor: str = "tester",
        title: str = "Seeded task",
        **options: str,
    ) -> str:
        args = ["task", "create", f"--id={task_id}", f"--title={title}", f"--actor={actor}"]
        args += [f"--{key.replace('_', '-')}={value}" for key, value in options.items()]
        self.run(*args)
        return task_id


def copy_static_fixture(root: Path) -> Path:
    """Create a static directory with one predictable file."""

    static = root / "static"
    static.mkdir(parents=True, exist_ok=True)
    (static / "index.html").write_text("<!doctype html>ok\n", encoding="utf-8")
    return static


def remove(path: Path) -> None:
    """Delete a file or tree, ignoring absence."""

    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)
    elif path.exists():
        path.unlink()
