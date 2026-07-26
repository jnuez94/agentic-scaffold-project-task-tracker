"""Loopback-only HTTP layer."""

from __future__ import annotations

from .handler import RequestHandlerMixin, error_payload
from .host_policy import HostPolicy
from .json_body_reader import JsonBodyReader
from .security_headers import CONTENT_SECURITY_POLICY, SecurityHeaders
from .server import (
    DEFAULT_HOST,
    DEFAULT_PORT,
    STATIC_ROOT,
    CoordinationUIHandler,
    CoordinationUIServer,
    build_server,
    serve_forever,
)
from .static_files import StaticFileResolver

__all__ = [
    "CONTENT_SECURITY_POLICY",
    "DEFAULT_HOST",
    "DEFAULT_PORT",
    "STATIC_ROOT",
    "CoordinationUIHandler",
    "CoordinationUIServer",
    "HostPolicy",
    "JsonBodyReader",
    "RequestHandlerMixin",
    "SecurityHeaders",
    "StaticFileResolver",
    "build_server",
    "error_payload",
    "serve_forever",
]
