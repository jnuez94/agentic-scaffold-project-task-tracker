"""Shared base that boots a real loopback server for HTTP-level tests."""

from __future__ import annotations

import json
import threading
import unittest
from http.client import HTTPConnection
from typing import Any

from coordination_ui.web import CoordinationUIHandler, build_server

from ..support import TemporaryProject, cli_available, copy_static_fixture


@unittest.skipUnless(cli_available(), "coordination CLI not installed")
class LiveServerTestCase(unittest.TestCase):
    """Boots a server on an ephemeral loopback port for the duration of a test."""

    def setUp(self) -> None:
        self.temp = TemporaryProject().start()
        self.addCleanup(self.temp.stop)
        self.temp.seed_agent("alice")
        self.temp.seed_task("T-1", actor="alice")
        self.silence_access_log()
        self.server = build_server(
            self.temp.project(),
            "127.0.0.1",
            0,
            static_root=copy_static_fixture(self.temp.root),
        )
        self.addCleanup(self.server.server_close)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.shutdown)
        self.port = self.server.server_address[1]

    def silence_access_log(self) -> None:
        """Keep per-request access lines out of the test report."""

        original_message = CoordinationUIHandler.log_message
        original_error = CoordinationUIHandler.log_error
        CoordinationUIHandler.log_message = lambda *a, **k: None  # type: ignore[method-assign]
        CoordinationUIHandler.log_error = lambda *a, **k: None  # type: ignore[method-assign]

        def restore() -> None:
            CoordinationUIHandler.log_message = original_message  # type: ignore[method-assign]
            CoordinationUIHandler.log_error = original_error  # type: ignore[method-assign]

        self.addCleanup(restore)

    # -- request helpers ----------------------------------------------------

    def connect(self) -> HTTPConnection:
        return HTTPConnection("127.0.0.1", self.port, timeout=30)

    def request(
        self,
        method: str,
        path: str,
        body: Any = None,
        host: str | None = None,
        content_type: str | None = "application/json",
        session: str | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        connection = self.connect()
        headers: dict[str, str] = {"Host": host or f"127.0.0.1:{self.port}"}
        payload = b""
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            if content_type:
                headers["Content-Type"] = content_type
        if session:
            headers["X-Coordination-Session"] = session
        try:
            connection.request(method, path, body=payload, headers=headers)
            response = connection.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            connection.close()

    def get_json(self, path: str, **kwargs: Any) -> tuple[int, Any]:
        status, _, raw = self.request("GET", path, **kwargs)
        return status, json.loads(raw)

    def post_json(self, path: str, body: Any, **kwargs: Any) -> tuple[int, Any]:
        status, _, raw = self.request("POST", path, body, **kwargs)
        return status, json.loads(raw)
