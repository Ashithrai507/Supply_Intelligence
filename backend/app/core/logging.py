"""Central logging configuration (project.md §10)."""

import logging
import sys


def configure_logging(level: int = logging.INFO) -> None:
    """Configure a single structured-ish log line format for the whole app."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout,
        force=True,
    )
