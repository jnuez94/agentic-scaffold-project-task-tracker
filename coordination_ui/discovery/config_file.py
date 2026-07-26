"""Parsing and validation of ``.coordination/config.yml``.

Implements the subset of ``docs/cli-contract.md`` "Invocation And Discovery"
needed to locate a database. The CLI revalidates every path it touches, so this
is a locator, not a gatekeeper.
"""

from __future__ import annotations

from pathlib import Path

from .errors import DiscoveryError
from .project import CONFIG_DIRNAME

RESERVED_ROOT_NAMES = frozenset({"config.yml", "readme.md", "backups"})


class ConfigFile:
    """One parsed ``config.yml``."""

    def __init__(self, path: Path, values: dict[str, str]) -> None:
        self.path = Path(path)
        self.values = dict(values)

    # -- construction -------------------------------------------------------

    @classmethod
    def parse(cls, text: str, path: Path) -> "ConfigFile":
        """Parse the contract's restricted config grammar.

        Blank lines, comments, or unique ``key: value`` scalar lines. Leading
        and trailing line whitespace is ignored.
        """

        values: dict[str, str] = {}
        for lineno, raw in enumerate(text.splitlines(), start=1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            key, separator, value = line.partition(":")
            if not separator:
                raise DiscoveryError(f"{path}:{lineno}: expected 'key: value'")
            key = key.strip()
            if key in values:
                raise DiscoveryError(f"{path}:{lineno}: duplicate key {key!r}")
            values[key] = value.strip()
        return cls(path, values)

    @classmethod
    def load(cls, path: Path) -> "ConfigFile":
        path = Path(path)
        if not path.is_file() or path.is_symlink():
            raise DiscoveryError(f"{path} is missing or not a regular file")
        return cls.parse(path.read_text(encoding="utf-8"), path)

    # -- validation ---------------------------------------------------------

    def validate(self) -> "ConfigFile":
        if self.values.get("version") != "1":
            raise DiscoveryError(f"{self.path}: requires 'version: 1'")
        if self.values.get("backend") != "sqlite":
            raise DiscoveryError(f"{self.path}: requires 'backend: sqlite'")
        if not self.values.get("database"):
            raise DiscoveryError(f"{self.path}: requires a nonempty 'database'")
        return self

    def database_path(self) -> Path:
        """Resolve the configured database beneath its ``.coordination/``.

        The configured value must be relative, must not contain ``..`` or a
        nested ``.coordination`` component, and must not begin with a managed
        root name. Component reservations are case-insensitive so behavior is
        consistent on case-insensitive filesystems.
        """

        self.validate()
        configured = self.values["database"]
        relative = Path(configured)
        if relative.is_absolute():
            raise DiscoveryError("configured database must be a relative path")
        parts = relative.parts
        if not parts:
            raise DiscoveryError("configured database is empty")
        if ".." in parts:
            raise DiscoveryError("configured database must not contain '..'")
        if any(part.lower() == CONFIG_DIRNAME for part in parts):
            raise DiscoveryError("configured database must not nest .coordination")
        if parts[0].lower() in RESERVED_ROOT_NAMES:
            raise DiscoveryError(
                f"configured database must not begin with {parts[0]!r}"
            )
        return self.path.parent / relative
