"""Command-line argument parsing for the console launcher."""

from __future__ import annotations

import argparse
from pathlib import Path

from . import __version__
from .launcher import LaunchOptions
from .web import DEFAULT_HOST, DEFAULT_PORT


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="coordination-ui",
        description=(
            "Serve a local web console for a coordination SQLite database. "
            "Every coordination write is performed by the coordination CLI."
        ),
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=None,
        help="path to coordination.sqlite3; otherwise the nearest project is used",
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"loopback address to bind (default: {DEFAULT_HOST})",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"port to bind (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="per-command CLI timeout in seconds (default: 30)",
    )
    parser.add_argument(
        "--open",
        dest="open_browser",
        action="store_true",
        help="open the console in the default browser once the server is up",
    )
    parser.add_argument(
        "--version", action="version", version=f"coordination-ui {__version__}"
    )
    return parser


def parse_options(argv: list[str] | None = None) -> LaunchOptions:
    args = build_parser().parse_args(argv)
    return LaunchOptions(
        database=args.db,
        host=args.host,
        port=args.port,
        timeout=args.timeout,
        open_browser=args.open_browser,
    )
