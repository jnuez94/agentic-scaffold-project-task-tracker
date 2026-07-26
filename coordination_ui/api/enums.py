"""Contract enumerations, mirrored from ``docs/cli-contract.md`` v1.2.0.

Duplicated here so the console can reject a bad value with a useful message
before spawning a process. The CLI remains the authority; these must be updated
when the contract version changes.
"""

from __future__ import annotations

ACTOR_TYPES = ("ai", "human", "service")
AGENT_STATUSES = ("active", "inactive")
SESSION_STATUSES = ("active", "ended")
TASK_STATUSES = ("todo", "in_progress", "review", "blocked", "done")
RELEASE_TARGETS = ("todo", "review", "blocked")
DEPENDENCY_TYPES = ("blocks", "informs", "review_required", "evidence_required")
REVIEW_DECISIONS = (
    "accepted",
    "conditionally_accepted",
    "changes_requested",
    "rejected",
)
DECISION_STATUSES = ("proposed", "accepted", "superseded", "rejected")
ARTIFACT_STATUSES = ("draft", "review", "accepted", "superseded")
ESCALATION_STATUSES = ("open", "in_review", "resolved", "closed_no_action")
ESCALATION_RESOLUTIONS = ("resolved", "closed_no_action")

# From "Allowed status transitions". `in_progress` is reachable only through
# `task claim`, and `done` additionally requires at least one evidence row.
TASK_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "todo": ("in_progress", "blocked"),
    "in_progress": ("todo", "review", "blocked"),
    "review": ("in_progress", "blocked", "done"),
    "blocked": ("todo", "in_progress"),
    "done": (),
}

MAX_LIST_LIMIT = 500
MIN_LIST_LIMIT = 1


def describe() -> dict[str, object]:
    """JSON-safe bundle handed to the frontend at startup."""

    return {
        "statuses": {
            "task": list(TASK_STATUSES),
            "release_targets": list(RELEASE_TARGETS),
            "agent": list(AGENT_STATUSES),
            "session": list(SESSION_STATUSES),
            "actor_type": list(ACTOR_TYPES),
            "dependency": list(DEPENDENCY_TYPES),
            "review_decision": list(REVIEW_DECISIONS),
            "decision": list(DECISION_STATUSES),
            "artifact": list(ARTIFACT_STATUSES),
            "escalation": list(ESCALATION_STATUSES),
            "escalation_resolution": list(ESCALATION_RESOLUTIONS),
        },
        "transitions": {key: list(value) for key, value in TASK_TRANSITIONS.items()},
    }
