"""Typed access to the coordination CLI.

Import order note: ``exit_codes`` -> ``coordination_error`` ->
``argument_error`` -> ``identifier`` -> ``arguments`` -> ``client``. The chain
is acyclic, so any module here can be imported and tested on its own.
"""

from __future__ import annotations

from .argument_error import ArgumentError
from .arguments import ArgumentBuilder, require_choice, require_str
from .client import DEFAULT_TIMEOUT_SECONDS, CoordinationCLI
from .command_result import CommandResult
from .coordination_error import CoordinationError
from .exit_codes import EXIT_CODE_TO_HTTP_STATUS, http_status_for
from .identifier import IdentifierValidator, validate_identifier
from .response_parser import ResponseParser

__all__ = [
    "DEFAULT_TIMEOUT_SECONDS",
    "EXIT_CODE_TO_HTTP_STATUS",
    "ArgumentBuilder",
    "ArgumentError",
    "CommandResult",
    "CoordinationCLI",
    "CoordinationError",
    "IdentifierValidator",
    "ResponseParser",
    "http_status_for",
    "require_choice",
    "require_str",
    "validate_identifier",
]
