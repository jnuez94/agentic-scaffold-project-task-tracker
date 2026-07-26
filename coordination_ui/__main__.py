"""Entry point: ``python3 -m coordination_ui``."""

from __future__ import annotations

import sys

from .arguments import parse_options
from .launcher import Launcher


def main(argv: list[str] | None = None) -> int:
    return Launcher(parse_options(argv), sys.stderr).run()


if __name__ == "__main__":
    raise SystemExit(main())
