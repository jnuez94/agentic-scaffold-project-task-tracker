"""Builder that translates request bodies into CLI argv tokens."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from .argument_error import ArgumentError
from .identifier import validate_identifier


class ArgumentBuilder:
    """Accumulates argv for one CLI command.

    Every option is emitted as a single ``--flag=value`` token. Emitting two
    tokens would let a value beginning with ``-`` be parsed as an option by the
    CLI's own argument parser; the joined form is unambiguous.
    """

    def __init__(self, *command: str) -> None:
        self._args: list[str] = list(command)
        self._options_start = len(self._args)

    # -- output -------------------------------------------------------------

    @property
    def args(self) -> list[str]:
        return list(self._args)

    @property
    def option_count(self) -> int:
        """How many option tokens have been appended after the command words."""

        return len(self._args) - self._options_start

    def positional(self, value: str) -> "ArgumentBuilder":
        """Append a positional argument and move the option boundary past it."""

        self._args.append(value)
        self._options_start = len(self._args)
        return self

    def flag(self, name: str) -> "ArgumentBuilder":
        self._args.append(name)
        return self

    def option(self, flag: str, value: str) -> "ArgumentBuilder":
        self._args.append(f"{flag}={value}")
        return self

    # -- typed fields -------------------------------------------------------

    def text(
        self,
        body: Mapping[str, Any],
        key: str,
        flag: str,
        *,
        required: bool = False,
    ) -> "ArgumentBuilder":
        """Append a text option when ``key`` is present in ``body``.

        Presence decides, not truthiness: an explicit empty string is how the
        CLI clears an optional text field, so it must survive the round trip.
        """

        if key not in body or body[key] is None:
            if required:
                raise ArgumentError(f"missing required field {key!r}")
            return self
        value = body[key]
        if not isinstance(value, str):
            raise ArgumentError(f"field {key!r} must be a string")
        if required and not value.strip():
            raise ArgumentError(f"field {key!r} must contain non-whitespace text")
        return self.option(flag, value)

    def identifier(
        self,
        body: Mapping[str, Any],
        key: str,
        flag: str,
        *,
        required: bool = False,
    ) -> "ArgumentBuilder":
        if key not in body or body[key] in (None, ""):
            if required:
                raise ArgumentError(f"missing required field {key!r}")
            return self
        return self.option(flag, validate_identifier(body[key], key))

    def integer(
        self,
        body: Mapping[str, Any],
        key: str,
        flag: str,
        *,
        required: bool = False,
    ) -> "ArgumentBuilder":
        if key not in body or body[key] is None or body[key] == "":
            if required:
                raise ArgumentError(f"missing required field {key!r}")
            return self
        value = body[key]
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise ArgumentError(f"field {key!r} must be an integer")
        try:
            number = int(value)
        except (TypeError, ValueError) as exc:
            raise ArgumentError(f"field {key!r} must be an integer") from exc
        return self.option(flag, str(number))

    def choice(
        self,
        body: Mapping[str, Any],
        key: str,
        flag: str,
        allowed: Iterable[str],
        *,
        required: bool = False,
    ) -> "ArgumentBuilder":
        if key not in body or body[key] in (None, ""):
            if required:
                raise ArgumentError(f"missing required field {key!r}")
            return self
        return self.option(flag, require_choice(body, key, allowed))

    def identifiers(
        self,
        body: Mapping[str, Any],
        key: str,
        flag: str,
    ) -> list[str]:
        """Append a repeatable identifier option; return what was appended.

        The contract requires repeated ``--assignee``, ``--task``, and
        ``--reviewer`` values to be unique.
        """

        values = body.get(key)
        if values is None:
            return []
        if isinstance(values, str):
            values = [values]
        if not isinstance(values, list):
            raise ArgumentError(f"field {key!r} must be a list of identifiers")
        collected = [validate_identifier(value, key) for value in values]
        if len(set(collected)) != len(collected):
            raise ArgumentError(f"field {key!r} must not repeat a value")
        for value in collected:
            self.option(flag, value)
        return collected


def require_choice(body: Mapping[str, Any], key: str, allowed: Iterable[str]) -> str:
    """Return ``body[key]`` when it is one of ``allowed``, else raise."""

    options = list(allowed)
    value = body.get(key)
    if value not in options:
        raise ArgumentError(
            f"field {key!r} must be one of {', '.join(options)}",
            {"field": key, "allowed": options},
        )
    return str(value)


def require_str(body: Mapping[str, Any], key: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ArgumentError(f"missing required field {key!r}")
    return value
