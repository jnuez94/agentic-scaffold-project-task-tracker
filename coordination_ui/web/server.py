"""Server construction and lifecycle."""

from __future__ import annotations

import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from ..api import Router, build_router
from ..cli import CoordinationCLI
from ..discovery import Project
from .handler import RequestHandlerMixin
from .host_policy import HostPolicy
from .static_files import StaticFileResolver

STATIC_ROOT = Path(__file__).resolve().parent.parent / "static"
DEFAULT_PORT = 8787
DEFAULT_HOST = "127.0.0.1"


class CoordinationUIHandler(RequestHandlerMixin, BaseHTTPRequestHandler):
    """Binds the request logic to Python's HTTP plumbing."""

    server_version = "coordination-ui"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    @property
    def router(self) -> Router:
        return self.server.router  # type: ignore[attr-defined]

    @property
    def static_files(self) -> StaticFileResolver:
        return self.server.static_files  # type: ignore[attr-defined]

    @property
    def host_policy(self) -> HostPolicy:
        return self.server.host_policy  # type: ignore[attr-defined]

    def do_GET(self) -> None:  # noqa: N802
        self.handle_request("GET")

    def do_HEAD(self) -> None:  # noqa: N802
        self.handle_request("GET")

    def do_POST(self) -> None:  # noqa: N802
        self.handle_request("POST")

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        sys.stderr.write(f"[coordination-ui] {self.address_string()} {format % args}\n")


class CoordinationUIServer(ThreadingHTTPServer):
    """Threaded so one slow CLI invocation cannot stall the whole console."""

    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        address: tuple[str, int],
        router: Router,
        static_root: Path = STATIC_ROOT,
    ) -> None:
        self.router = router
        self.static_files = StaticFileResolver(static_root)
        self.host_policy = HostPolicy()
        if ":" in address[0]:
            self.address_family = socket.AF_INET6
        super().__init__(address, CoordinationUIHandler)

    @property
    def url(self) -> str:
        host, port = self.server_address[0], self.server_address[1]
        display = f"[{host}]" if ":" in str(host) else host
        return f"http://{display}:{port}/"


def build_server(
    project: Project,
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    timeout: float = 30.0,
    static_root: Path = STATIC_ROOT,
) -> CoordinationUIServer:
    """Wire a server for one project.

    Refusing a non-loopback bind here, rather than warning, is deliberate: the
    console has no authentication, so a bind that could accept a LAN connection
    is a configuration error and not a supported mode.
    """

    if not HostPolicy.allows_bind(host):
        raise ValueError(
            "coordination-ui serves unauthenticated local state "
            "and binds loopback addresses only"
        )
    cli = CoordinationCLI(
        executable=project.executable,
        database=project.database,
        cwd=project.root,
        timeout=timeout,
    )
    return CoordinationUIServer((host, port), build_router(project, cli), static_root)


def serve_forever(server: CoordinationUIServer) -> None:
    """Run until interrupted, keeping Ctrl-C responsive on the main thread."""

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        thread.join()
    except KeyboardInterrupt:  # pragma: no cover - interactive path
        server.shutdown()
