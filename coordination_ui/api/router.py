"""Route matching and dispatch."""

from __future__ import annotations

import re
from http import HTTPStatus
from typing import Any, Callable, Mapping, Sequence

from ..cli import CoordinationError
from .context import ApiContext
from .request import Request

Handler = Callable[[Request], Any]
RouteSpec = tuple[str, str, Handler]


class Router:
    """Matches ``(method, path)`` to a handler.

    Routes are ordered and matched with anchored patterns. Distinguishing "no
    such path" from "wrong method for this path" matters: the first is a bug in
    the frontend's URL construction, the second is a bug in its verb choice.
    """

    def __init__(self, context: ApiContext, routes: Sequence[RouteSpec]) -> None:
        self.context = context
        self.routes = [
            (method, re.compile(f"^{pattern}$"), handler)
            for method, pattern, handler in routes
        ]

    def dispatch(
        self,
        method: str,
        path: str,
        query: Mapping[str, Sequence[str]] | None = None,
        body: Mapping[str, Any] | None = None,
        session: str | None = None,
    ) -> Any:
        allowed: set[str] = set()
        for route_method, pattern, handler in self.routes:
            match = pattern.match(path)
            if not match:
                continue
            if route_method != method:
                allowed.add(route_method)
                continue
            return handler(
                Request(
                    context=self.context,
                    params=match.groupdict(),
                    query=query or {},
                    body=body or {},
                    session=session,
                )
            )
        if allowed:
            raise CoordinationError(
                "method_not_allowed",
                f"{method} is not supported for {path}",
                {"allowed": sorted(allowed)},
                exit_code=2,
                http_status=HTTPStatus.METHOD_NOT_ALLOWED,
            )
        raise CoordinationError(
            "not_found",
            f"no API route for {path}",
            {"path": path},
            exit_code=3,
        )
