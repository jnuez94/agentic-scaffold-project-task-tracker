"""Failures raised while resolving which project the console serves."""

from __future__ import annotations


class DiscoveryError(Exception):
    """The coordination project, database, or CLI could not be resolved.

    Raised only during startup or explicit path resolution, never per request,
    so it stays a plain exception rather than a wire-shaped CoordinationError.
    """
