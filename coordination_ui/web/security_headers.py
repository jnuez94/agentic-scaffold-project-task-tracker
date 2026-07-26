"""Response headers applied to everything the console serves."""

from __future__ import annotations

CONTENT_SECURITY_POLICY = "; ".join(
    (
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
    )
)

SECURITY_HEADERS: dict[str, str] = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
}


class SecurityHeaders:
    """The fixed header set every response carries.

    ``default-src 'none'`` with ``script-src 'self'`` is what keeps the bundled
    frontend from reaching a CDN or any other origin: there is no runtime
    network path out of the page, so coordination content cannot be exfiltrated
    by injected markup.
    """

    def __init__(self, headers: dict[str, str] | None = None) -> None:
        self.headers = dict(headers if headers is not None else SECURITY_HEADERS)

    def items(self) -> list[tuple[str, str]]:
        return list(self.headers.items())

    def get(self, name: str) -> str | None:
        return self.headers.get(name)
