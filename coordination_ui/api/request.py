"""One dispatched API request."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Mapping, Sequence

from ..cli import ArgumentError, CoordinationCLI, validate_identifier
from .enums import MAX_LIST_LIMIT, MIN_LIST_LIMIT

if TYPE_CHECKING:  # pragma: no cover - typing only
    from ..readonly import ReadOnlyDatabase
    from .context import ApiContext


@dataclass(frozen=True)
class Request:
    """Everything a route handler needs, with typed query accessors."""

    context: "ApiContext"
    params: Mapping[str, str] = field(default_factory=dict)
    query: Mapping[str, Sequence[str]] = field(default_factory=dict)
    body: Mapping[str, Any] = field(default_factory=dict)
    session: str | None = None

    # -- collaborators ------------------------------------------------------

    @property
    def cli(self) -> CoordinationCLI:
        return self.context.cli

    @property
    def readonly(self) -> "ReadOnlyDatabase":
        return self.context.readonly

    # -- path ---------------------------------------------------------------

    def path_id(self, name: str = "id") -> str:
        return validate_identifier(self.params.get(name), name)

    # -- query --------------------------------------------------------------

    def q(self, name: str, default: str | None = None) -> str | None:
        values = self.query.get(name)
        if not values or values[0] == "":
            return default
        return values[0]

    def q_int(self, name: str, default: int | None = None) -> int | None:
        raw = self.q(name)
        if raw is None:
            return default
        try:
            return int(raw)
        except ValueError as exc:
            raise ArgumentError(
                f"query parameter {name!r} must be an integer"
            ) from exc

    def q_flag(self, name: str) -> bool:
        raw = self.q(name)
        return raw is not None and raw.lower() not in ("0", "false", "no")

    def q_choice(self, name: str, allowed: Sequence[str]) -> str | None:
        raw = self.q(name)
        if raw is None:
            return None
        if raw not in allowed:
            raise ArgumentError(
                f"query parameter {name!r} must be one of {', '.join(allowed)}",
                {"parameter": name, "allowed": list(allowed)},
            )
        return raw

    def q_identifier(self, name: str) -> str | None:
        raw = self.q(name)
        return None if raw is None else validate_identifier(raw, name)

    def paging(self, builder: Any) -> Any:
        """Append ``--limit`` / ``--offset`` when present, clamped to contract bounds."""

        limit = self.q_int("limit")
        offset = self.q_int("offset")
        if limit is not None:
            clamped = max(MIN_LIST_LIMIT, min(limit, MAX_LIST_LIMIT))
            builder.option("--limit", str(clamped))
        if offset is not None:
            builder.option("--offset", str(max(0, offset)))
        return builder

    # -- execution ----------------------------------------------------------

    def run(self, builder: Any, *, with_session: bool = False) -> Any:
        args = builder.args if hasattr(builder, "args") else list(builder)
        return self.cli.run(args, self.session if with_session else None)

    def run_text(self, builder: Any) -> str:
        args = builder.args if hasattr(builder, "args") else list(builder)
        return self.cli.run_text(args)
