"""Shared base for route tests that drive a real database."""

from __future__ import annotations

import unittest
from typing import Any

from coordination_ui.api import build_router

from ..support import TemporaryProject, cli_available


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class RouteTestCase(unittest.TestCase):
    """A router wired to a throwaway project.

    Subclasses set ``session`` when a test needs session-attributed mutation.
    """

    session: str | None = None

    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.router = build_router(self.temp.project(), self.temp.cli())
        self.seed()

    def seed(self) -> None:
        """Hook for subclasses; runs after the router is wired."""

    # -- request helpers ----------------------------------------------------

    def get(self, path: str, **query: str) -> Any:
        return self.router.dispatch(
            "GET", path, {key: [value] for key, value in query.items()}, {}, self.session
        )

    def post(self, path: str, body: dict[str, Any], session: str | None = "keep") -> Any:
        actual = self.session if session == "keep" else session
        return self.router.dispatch("POST", path, {}, body, actual)
