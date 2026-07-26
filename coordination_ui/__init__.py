"""A local, dependency-free web console for an agentic-project-scaffold-lite
coordination database.

Reads and writes are routed through the installed ``bin/coordination`` CLI so
this UI can never bypass the contract the project agrees to in ``AGENTS.md``.
"""

from __future__ import annotations

__version__ = "1.0.0"
SUPPORTED_CLI_VERSION = "1.2.0"
SUPPORTED_SCHEMA_VERSION = 1
