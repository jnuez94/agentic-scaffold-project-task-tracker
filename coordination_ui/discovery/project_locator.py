"""Walks the filesystem to resolve a :class:`Project`."""

from __future__ import annotations

from pathlib import Path

from .config_file import ConfigFile
from .errors import DiscoveryError
from .executable_locator import ExecutableLocator
from .project import CONFIG_DIRNAME, CONFIG_FILENAME, Project


class ProjectLocator:
    """Resolves the project the console serves, with or without an explicit db."""

    def __init__(self, executables: ExecutableLocator | None = None) -> None:
        self.executables = executables or ExecutableLocator()

    # -- discovery ----------------------------------------------------------

    def find(self, start: Path | None = None) -> Project:
        """Walk up from ``start`` to the nearest configured project.

        A malformed nearer boundary is rejected rather than skipped in favor of
        a parent project, matching the CLI's discovery rule.
        """

        current = (start or Path.cwd()).resolve()
        for candidate in [current, *current.parents]:
            coordination_dir = candidate / CONFIG_DIRNAME
            if not coordination_dir.exists():
                continue
            if not coordination_dir.is_dir() or coordination_dir.is_symlink():
                raise DiscoveryError(f"{coordination_dir} is not a real directory")
            config = ConfigFile.load(coordination_dir / CONFIG_FILENAME).validate()
            return Project(
                root=candidate,
                config_path=config.path,
                database=config.database_path(),
                executable=self.executables.locate(candidate),
            )
        raise DiscoveryError(
            f"no {CONFIG_DIRNAME}/{CONFIG_FILENAME} found in {current} or its parents"
        )

    # -- explicit database --------------------------------------------------

    def for_database(self, database: Path, start: Path | None = None) -> Project:
        """Resolve a project around an explicitly named database file."""

        resolved = Path(database).expanduser().resolve()
        if not resolved.is_file():
            raise DiscoveryError(f"database not found: {resolved}")
        root = resolved.parent
        if root.name == CONFIG_DIRNAME:
            root = root.parent
        try:
            executable = self.executables.locate(root)
        except DiscoveryError:
            executable = self.executables.locate(Path(start or root).resolve())
        return Project(
            root=root,
            config_path=root / CONFIG_DIRNAME / CONFIG_FILENAME,
            database=resolved,
            executable=executable,
        )

    def resolve(
        self, database: Path | None = None, start: Path | None = None
    ) -> Project:
        """Dispatch between explicit-database and discovery modes."""

        if database is None:
            return self.find(start)
        return self.for_database(database, start)
