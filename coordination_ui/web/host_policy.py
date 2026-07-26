"""Which ``Host`` headers and bind addresses the console accepts."""

from __future__ import annotations

LOOPBACK_HOSTNAMES = frozenset({"localhost", "127.0.0.1", "::1", "[::1]"})
BINDABLE_ADDRESSES = frozenset({"127.0.0.1", "localhost", "::1"})


class HostPolicy:
    """Enforces the console's loopback-only posture.

    The console mutates coordination state without authentication, which is
    only defensible because it is unreachable from anywhere but this machine.
    Two separate checks uphold that: the bind address, and the ``Host`` header
    on every request. The second is what stops a page on a hostile site from
    resolving its own domain to 127.0.0.1 and driving the API through the
    user's browser.
    """

    def __init__(self, allowed: frozenset[str] = LOOPBACK_HOSTNAMES) -> None:
        self.allowed = allowed

    @staticmethod
    def hostname_of(header: str) -> str:
        """Strip the port from a ``Host`` header, honoring bracketed IPv6."""

        host = (header or "").strip()
        if not host:
            return ""
        if host.startswith("["):
            closing = host.find("]")
            return host[: closing + 1] if closing != -1 else host
        return host.split(":", 1)[0]

    def allows_header(self, header: str | None) -> bool:
        hostname = self.hostname_of(header or "")
        return bool(hostname) and hostname.lower() in self.allowed

    @classmethod
    def allows_bind(cls, address: str) -> bool:
        return address in BINDABLE_ADDRESSES
