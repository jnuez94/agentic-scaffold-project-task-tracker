"""Whether the CLI this console found is one it can actually talk to.

The console ships separately from the CLI it drives, mirrors the v1.2.0
contract enumerations in ``api.enums``, and documents ``COORDINATION_BIN`` as a
user-facing override. Those three facts together mean an operator can very
reasonably end up pointing this at a CLI it was never written against.

Startup already asked ``version`` and ``doctor`` for the answer and threw it
away, so the failure mode was silent: unknown enum values, missing flags, and
errors that look like console bugs. Refusing to bind, and saying exactly what
was found against what is required, turns that into one sentence at the only
moment the operator can act on it.

A range rather than a pin. The contract documents its stable surface, so
patch and compatible minor releases are expected to work; pinning would break
an operator on every CLI release for no reason.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from . import SUPPORTED_CLI_VERSION, SUPPORTED_SCHEMA_VERSION

#: First CLI release carrying the contract this console was written against.
MINIMUM_CLI_VERSION = SUPPORTED_CLI_VERSION
#: First release assumed to break it. Major versions may change the contract.
BELOW_CLI_VERSION = "2.0.0"

WHERE_TO_GET_IT = (
    "Install a compatible coordination CLI from "
    "https://github.com/jnuez94/agentic-project-scaffold-lite, or set "
    "COORDINATION_BIN to one already installed."
)

_VERSION = re.compile(r"^\s*v?(\d+)\.(\d+)\.(\d+)")


def parse_version(raw: Any) -> tuple[int, int, int] | None:
    """Parse ``MAJOR.MINOR.PATCH``, or ``None`` when it is not that.

    Deliberately tolerant of a leading ``v`` and trailing suffixes, and
    deliberately intolerant of everything else: a version this cannot read is
    treated as incompatible rather than assumed fine, because "unreadable" and
    "compatible" are not the same claim.
    """

    if not isinstance(raw, str):
        return None
    found = _VERSION.match(raw)
    if not found:
        return None
    return (int(found.group(1)), int(found.group(2)), int(found.group(3)))


def cli_version_supported(reported: Any) -> bool:
    parsed = parse_version(reported)
    if parsed is None:
        return False
    return parse_version(MINIMUM_CLI_VERSION) <= parsed < parse_version(BELOW_CLI_VERSION)  # type: ignore[operator]


def schema_version_supported(reported: Any) -> bool:
    # The schema version is an integer in the contract, and a string that looks
    # like one is still not one; accept both rather than fail on a formatting
    # difference the operator cannot influence.
    if isinstance(reported, bool):
        return False
    if isinstance(reported, int):
        return reported == SUPPORTED_SCHEMA_VERSION
    if isinstance(reported, str) and reported.strip().lstrip("v").isdigit():
        return int(reported.strip().lstrip("v")) == SUPPORTED_SCHEMA_VERSION
    return False


def describe_cli_problem(reported: Any) -> str | None:
    """The refusal for an unusable CLI version, or ``None`` when it is fine."""

    if cli_version_supported(reported):
        return None
    found = reported if isinstance(reported, str) and reported.strip() else "unknown"
    if parse_version(reported) is None:
        return (
            f"the coordination CLI reported a version this console cannot read "
            f"({found!r}); it requires >={MINIMUM_CLI_VERSION},<{BELOW_CLI_VERSION}. "
            f"{WHERE_TO_GET_IT}"
        )
    return (
        f"the coordination CLI is v{found}, which this console does not support; "
        f"it requires >={MINIMUM_CLI_VERSION},<{BELOW_CLI_VERSION}. {WHERE_TO_GET_IT}"
    )


def describe_schema_problem(reported: Any) -> str | None:
    """The refusal for an unusable database schema, or ``None``."""

    if schema_version_supported(reported):
        return None
    found = reported if reported not in (None, "") else "unknown"
    return (
        f"the coordination database reports schema v{found}, and this console "
        f"only understands schema v{SUPPORTED_SCHEMA_VERSION}. "
        "Migrate the database with the coordination CLI, or point this console "
        "at a project on the supported schema."
    )


def verify(version: Mapping[str, Any], doctor: Mapping[str, Any]) -> str | None:
    """Check a preflight result, returning one refusal message or ``None``.

    The CLI is checked first: a CLI outside the range is the more likely cause
    of a schema this console does not recognise, so reporting the schema first
    would send the operator after the wrong thing.
    """

    problem = describe_cli_problem(version.get("cli_version"))
    if problem:
        return problem
    # doctor is authoritative for the database actually being served; version
    # reports what the CLI was built for.
    reported_schema = doctor.get("schema_version", version.get("schema_version"))
    return describe_schema_problem(reported_schema)
