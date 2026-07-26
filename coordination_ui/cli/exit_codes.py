"""Mapping from contractual CLI exit codes to HTTP status codes.

Source: ``docs/cli-contract.md``, section "Exit Codes".
"""

from __future__ import annotations

from http import HTTPStatus

EXIT_CODE_TO_HTTP_STATUS: dict[int, int] = {
    0: HTTPStatus.OK,
    1: HTTPStatus.INTERNAL_SERVER_ERROR,
    2: HTTPStatus.BAD_REQUEST,
    3: HTTPStatus.NOT_FOUND,
    4: HTTPStatus.CONFLICT,
    5: HTTPStatus.INTERNAL_SERVER_ERROR,
    6: HTTPStatus.SERVICE_UNAVAILABLE,
}

DEFAULT_HTTP_STATUS = HTTPStatus.INTERNAL_SERVER_ERROR


def http_status_for(exit_code: int) -> int:
    """Return the HTTP status representing ``exit_code``.

    Unknown exit codes fall back to 500 rather than raising: an unmapped code
    means the CLI grew a new class of failure, and reporting it as a server
    error is more useful than crashing the request.
    """

    return int(EXIT_CODE_TO_HTTP_STATUS.get(exit_code, DEFAULT_HTTP_STATUS))
