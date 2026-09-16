"""What each list may be filtered and ordered by (1.4.0).

Mirrored from the contract's "Filtering And Ordering" table so a bad column
or operator is refused here, with a message naming what is allowed, instead
of reaching the CLI. The CLI remains the authority on values: it validates
enum choices, identifier grammar and timestamp form itself, and this module
only keeps the console from ever sending a column or operator the entity
does not list. Free-text columns are deliberately absent, as in the contract:
the list is a query surface, not a search.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from ..cli import ArgumentError

KIND_OPERATORS: dict[str, tuple[str, ...]] = {
    "identifier": ("eq", "ne", "in"),
    "enum": ("eq", "ne", "in"),
    "text": ("eq", "ne"),
    "integer": ("eq", "ne", "ge", "le"),
    "timestamp": ("ge", "le"),
}

# The contract's UTC one-second form, and nothing looser: the CLI would refuse
# a bare Z or a fractional second, and the console should not learn that late.
TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$")

WHERE = re.compile(r"^(?P<column>[a-z_]+):(?P<op>[a-z]+)=(?P<value>.+)$", re.S)
ORDER_BY = re.compile(r"^(?P<column>[a-z_]+)(?::(?P<direction>asc|desc))?$")


@dataclass(frozen=True)
class Descriptor:
    filterable: dict[str, str]
    orderable: tuple[str, ...]

    @property
    def has_updated_at(self) -> bool:
        return "updated_at" in self.filterable


ENTITIES: dict[str, Descriptor] = {
    "agent": Descriptor(
        {
            "id": "identifier",
            "name": "text",
            "role": "text",
            "actor_type": "enum",
            "status": "enum",
            "created_at": "timestamp",
            "updated_at": "timestamp",
        },
        ("id", "name", "role", "actor_type", "status", "created_at", "updated_at"),
    ),
    "session": Descriptor(
        {
            "id": "identifier",
            "agent_id": "identifier",
            "harness": "text",
            "model": "text",
            "status": "enum",
            "started_at": "timestamp",
            "last_seen_at": "timestamp",
            "ended_at": "timestamp",
        },
        ("id", "agent_id", "harness", "status", "started_at", "last_seen_at", "ended_at"),
    ),
    "task": Descriptor(
        {
            "id": "identifier",
            "created_by": "identifier",
            "title": "text",
            "status": "enum",
            "priority": "integer",
            "revision": "integer",
            "created_at": "timestamp",
            "updated_at": "timestamp",
        },
        (
            "id",
            "title",
            "status",
            "priority",
            "revision",
            "created_by",
            "created_at",
            "updated_at",
        ),
    ),
    "evidence": Descriptor(
        {
            "id": "integer",
            "task_id": "identifier",
            "added_by": "identifier",
            "evidence_type": "text",
            "created_at": "timestamp",
        },
        ("id", "evidence_type", "added_by", "created_at"),
    ),
    "review": Descriptor(
        {
            "id": "identifier",
            "task_id": "identifier",
            "reviewer_id": "identifier",
            "scope": "text",
            "decision": "enum",
            "created_at": "timestamp",
        },
        ("id", "task_id", "reviewer_id", "decision", "created_at"),
    ),
    "decision": Descriptor(
        {
            "id": "identifier",
            "owner_id": "identifier",
            "title": "text",
            "status": "enum",
            "created_at": "timestamp",
            "updated_at": "timestamp",
        },
        ("id", "title", "owner_id", "status", "created_at", "updated_at"),
    ),
    "message": Descriptor(
        {
            "id": "identifier",
            "sender_id": "identifier",
            "task_id": "identifier",
            "recipient": "text",
            "created_at": "timestamp",
        },
        ("id", "sender_id", "recipient", "task_id", "created_at"),
    ),
    "artifact": Descriptor(
        {
            "id": "identifier",
            "owner_id": "identifier",
            "uri": "text",
            "type": "text",
            "status": "enum",
            "created_at": "timestamp",
            "updated_at": "timestamp",
        },
        ("id", "uri", "owner_id", "type", "status", "created_at", "updated_at"),
    ),
    "escalation": Descriptor(
        {
            "id": "identifier",
            "raised_by": "identifier",
            "owner": "text",
            "status": "enum",
            "created_at": "timestamp",
            "updated_at": "timestamp",
        },
        ("id", "raised_by", "owner", "status", "created_at", "updated_at"),
    ),
}


def parse_where(entity: str, raw: str) -> str:
    """Validate one ``COLUMN:OP=VALUE`` clause against the entity's descriptor."""

    descriptor = ENTITIES[entity]
    match = WHERE.match(raw)
    if not match:
        raise ArgumentError(
            "query parameter 'where' must be COLUMN:OP=VALUE",
            {"field": "where", "columns": sorted(descriptor.filterable)},
        )
    column, op, value = match.group("column"), match.group("op"), match.group("value")
    kind = descriptor.filterable.get(column)
    if kind is None:
        raise ArgumentError(
            f"{entity} lists cannot be filtered by {column!r}",
            {"field": "where", "columns": sorted(descriptor.filterable)},
        )
    if op not in KIND_OPERATORS[kind]:
        raise ArgumentError(
            f"{column!r} takes {', '.join(KIND_OPERATORS[kind])}, not {op!r}",
            {"field": "where", "column": column, "operators": list(KIND_OPERATORS[kind])},
        )
    if kind == "timestamp" and not TIMESTAMP.match(value):
        raise ArgumentError(
            f"{column!r} takes a UTC timestamp like 2026-01-31T12:00:00+00:00",
            {"field": "where", "column": column},
        )
    return raw


def parse_order_by(entity: str, raw: str) -> str:
    """Validate one ``COLUMN[:asc|desc]`` term against the entity's orderable set."""

    descriptor = ENTITIES[entity]
    match = ORDER_BY.match(raw)
    if not match or match.group("column") not in descriptor.orderable:
        raise ArgumentError(
            f"{entity} lists order by {', '.join(descriptor.orderable)}",
            {"field": "order_by", "columns": list(descriptor.orderable)},
        )
    return raw


def parse_updated_since(entity: str, raw: str) -> str:
    descriptor = ENTITIES[entity]
    if not descriptor.has_updated_at:
        raise ArgumentError(
            f"{entity} rows carry no updated_at",
            {"field": "updated_since"},
        )
    if not TIMESTAMP.match(raw):
        raise ArgumentError(
            "query parameter 'updated_since' takes a UTC timestamp like 2026-01-31T12:00:00+00:00",
            {"field": "updated_since"},
        )
    return raw
