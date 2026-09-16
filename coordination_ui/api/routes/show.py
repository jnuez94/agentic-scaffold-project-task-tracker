"""``show`` for every entity that gained it in 1.4.0.

Seven entities, one handler each, all the same shape: ``<entity> show ID``
returns the stored row (artifacts add ``related_tasks`` and ``reviewers``),
and an unknown id is ``not_found``. Kept together because the routes are
identical apart from the noun, and a deep link into any inspector resolves
through exactly one of them.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from ...cli import ArgumentBuilder
from ..request import Request
from ..router import RouteSpec

# (URL segment, CLI noun). Tasks have had show since 1.2.0 and keep their route.
SHOWABLE = (
    ("agents", "agent"),
    ("sessions", "session"),
    ("artifacts", "artifact"),
    ("decisions", "decision"),
    ("messages", "message"),
    ("reviews", "review"),
    ("escalations", "escalation"),
)


def show_handler(noun: str) -> Callable[[Request], Any]:
    def show(request: Request) -> Any:
        builder = ArgumentBuilder(noun, "show").positional(request.path_id())
        return request.run(builder)

    show.__name__ = f"show_{noun}"
    return show


ROUTES: tuple[RouteSpec, ...] = tuple(
    ("GET", rf"/api/{segment}/(?P<id>[^/]+)", show_handler(noun)) for segment, noun in SHOWABLE
)
