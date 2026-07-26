"""Validation of coordination identifiers.

Grammar from ``docs/cli-contract.md``, "Lexical And Size Limits": 1-128 ASCII
characters, first character a letter or digit, remaining characters letters,
digits, ``.``, ``_``, ``:``, ``@``, ``+``, or ``-``.
"""

from __future__ import annotations

import re
from typing import Any

from .argument_error import ArgumentError

IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:@+-]{0,127}$")


class IdentifierValidator:
    """Rejects identifiers the CLI would reject, before they reach argv.

    Beyond matching the contract, the leading-alphanumeric rule is a safety
    property: positional CLI arguments cannot use the ``--flag=value`` form, so
    this validator is the only thing preventing a value such as ``--force``
    from being parsed as an option instead of an identifier.
    """

    pattern = IDENTIFIER_PATTERN

    @classmethod
    def is_valid(cls, value: Any) -> bool:
        return isinstance(value, str) and cls.pattern.match(value) is not None

    @classmethod
    def validate(cls, value: Any, field: str) -> str:
        if not cls.is_valid(value):
            raise ArgumentError(
                f"field {field!r} must be a valid coordination identifier",
                {"field": field},
            )
        return str(value)


def validate_identifier(value: Any, field: str) -> str:
    """Module-level shorthand for :meth:`IdentifierValidator.validate`."""

    return IdentifierValidator.validate(value, field)
