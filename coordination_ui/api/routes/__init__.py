"""Assembly of every route module into one ordered table.

Order matters only where patterns could overlap. ``/api/tasks/(?P<id>[^/]+)``
cannot swallow ``/api/tasks/UI-1/evidence`` because the identifier group
excludes ``/``, so entity modules can be listed in any order.
"""

from __future__ import annotations

from ..router import RouteSpec
from . import (
    agents,
    artifacts,
    escalations,
    evidence,
    messages,
    meta,
    reviews,
    sessions,
    tasks,
)

ROUTE_MODULES = (
    meta,
    agents,
    sessions,
    tasks,
    evidence,
    reviews,
    messages,
    artifacts,
    escalations,
)

ROUTES: tuple[RouteSpec, ...] = tuple(
    route for module in ROUTE_MODULES for route in module.ROUTES
)

__all__ = ["ROUTES", "ROUTE_MODULES"]
