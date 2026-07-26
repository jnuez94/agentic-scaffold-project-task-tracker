"""The resolved identity of one coordination project."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

CONFIG_DIRNAME = ".coordination"
CONFIG_FILENAME = "config.yml"


@dataclass(frozen=True)
class Project:
    """Everything the console needs to address a coordination project.

    Frozen because these paths are resolved once at startup and then shared
    across request threads.
    """

    root: Path
    config_path: Path
    database: Path
    executable: Path

    @property
    def coordination_dir(self) -> Path:
        return self.root / CONFIG_DIRNAME

    def describe(self) -> dict[str, str]:
        """Flat, JSON-safe form for the ``/api/meta`` endpoint."""

        return {
            "root": str(self.root),
            "config": str(self.config_path),
            "database": str(self.database),
            "executable": str(self.executable),
        }
