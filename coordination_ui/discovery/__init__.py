"""Resolution of the coordination project, database, and CLI."""

from __future__ import annotations

from pathlib import Path

from .config_file import ConfigFile
from .errors import DiscoveryError
from .executable_locator import ExecutableLocator
from .project import CONFIG_DIRNAME, CONFIG_FILENAME, Project
from .project_locator import ProjectLocator

__all__ = [
    "CONFIG_DIRNAME",
    "CONFIG_FILENAME",
    "ConfigFile",
    "DiscoveryError",
    "ExecutableLocator",
    "Project",
    "ProjectLocator",
    "project_for",
]


def project_for(database: Path | None = None, start: Path | None = None) -> Project:
    """Convenience wrapper over :meth:`ProjectLocator.resolve`."""

    return ProjectLocator().resolve(database, start)
