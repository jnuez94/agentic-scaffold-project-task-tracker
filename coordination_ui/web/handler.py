"""The HTTP request handler."""

from __future__ import annotations

import json
import sys
from http import HTTPStatus
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from ..api import TextResponse
from ..cli import CoordinationError
from .json_body_reader import JsonBodyReader
from .security_headers import SecurityHeaders

API_PREFIX = "/api/"
SESSION_HEADER = "X-Coordination-Session"


def error_payload(code: str, message: str, details: Any = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"ok": False, "error": error}


class RequestHandlerMixin:
    """Request logic, kept free of ``BaseHTTPRequestHandler`` plumbing.

    Separated so each branch can be exercised without a socket; the concrete
    handler in ``server.py`` supplies ``send_response`` and friends.
    """

    body_reader = JsonBodyReader()
    security_headers = SecurityHeaders()

    # -- provided by BaseHTTPRequestHandler ---------------------------------
    headers: Any
    path: str
    command: str
    rfile: Any
    wfile: Any

    # -- provided by the concrete server ------------------------------------
    @property
    def router(self) -> Any:  # pragma: no cover - overridden
        raise NotImplementedError

    @property
    def static_files(self) -> Any:  # pragma: no cover - overridden
        raise NotImplementedError

    @property
    def host_policy(self) -> Any:  # pragma: no cover - overridden
        raise NotImplementedError

    # -- responses ----------------------------------------------------------

    def respond(
        self, status: int, body: bytes, content_type: str
    ) -> None:  # pragma: no cover - exercised over a socket
        self.send_response(status)  # type: ignore[attr-defined]
        self.send_header("Content-Type", content_type)  # type: ignore[attr-defined]
        self.send_header("Content-Length", str(len(body)))  # type: ignore[attr-defined]
        for name, value in self.security_headers.items():
            self.send_header(name, value)  # type: ignore[attr-defined]
        self.end_headers()  # type: ignore[attr-defined]
        if self.command != "HEAD":
            self.wfile.write(body)

    def respond_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
        self.respond(status, body, "application/json; charset=utf-8")

    def respond_text(self, status: int, text: str) -> None:
        self.respond(status, text.encode("utf-8"), "text/plain; charset=utf-8")

    # -- dispatch -----------------------------------------------------------

    def handle_request(self, method: str) -> None:
        if not self.host_policy.allows_header(self.headers.get("Host")):
            self.respond_json(
                HTTPStatus.MISDIRECTED_REQUEST,
                error_payload(
                    "host_not_allowed",
                    "coordination-ui only serves loopback hosts",
                ),
            )
            return

        split = urlsplit(self.path)
        path = unquote(split.path)
        if not path.startswith(API_PREFIX):
            self.handle_static(method, path)
            return
        self.handle_api(method, path, split.query)

    def handle_static(self, method: str, path: str) -> None:
        if method != "GET":
            self.respond_json(
                HTTPStatus.METHOD_NOT_ALLOWED,
                error_payload(
                    "method_not_allowed", f"{method} is not supported for {path}"
                ),
            )
            return
        found = self.static_files.read(path)
        if found is None:
            self.respond_text(HTTPStatus.NOT_FOUND, "not found\n")
            return
        body, content_type = found
        self.respond(HTTPStatus.OK, body, content_type)

    def handle_api(self, method: str, path: str, query: str) -> None:
        try:
            body = self.body_reader.read(self.headers, self.rfile) if method == "POST" else {}
            session = (self.headers.get(SESSION_HEADER) or "").strip() or None
            result = self.router.dispatch(
                method, path, parse_qs(query, keep_blank_values=True), body, session
            )
        except CoordinationError as error:
            self.respond_json(error.http_status, error.to_payload())
            return
        except Exception as exc:  # pragma: no cover - defensive
            self.log_error_safely(exc)
            self.respond_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                error_payload("internal_error", f"{type(exc).__name__}: {exc}"),
            )
            return

        if isinstance(result, TextResponse):
            self.respond(HTTPStatus.OK, result.encode(), result.content_type)
            return
        self.respond_json(HTTPStatus.OK, {"ok": True, "data": result})

    def log_error_safely(self, exc: BaseException) -> None:  # pragma: no cover
        sys.stderr.write(f"[coordination-ui] unhandled {type(exc).__name__}: {exc}\n")
