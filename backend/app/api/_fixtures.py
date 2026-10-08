"""Contract helpers shared by routers: load frozen mock fixtures.

The contract is frozen (issue #4). Routers serve fixture JSON (validated by
Pydantic response models) until each workstream replaces its loader with real
pipeline calls — same response shapes, no coordination cost.
"""

import json
from functools import cache
from pathlib import Path
from typing import Any

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "tests" / "fixtures"


@cache
def load_fixture(name: str) -> dict[str, Any]:
    """Load a frozen contract fixture by stem name (``state`` → ``state.json``)."""
    path = FIXTURES_DIR / f"{name}.json"
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)
