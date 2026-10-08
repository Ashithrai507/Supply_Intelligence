"""Load the generated dataset into Supabase Postgres (issue #9).

From the repo root::

    uv run python scripts/load_supabase.py --reset   # idempotent truncate + reload
    uv run python scripts/load_supabase.py          # plain insert (fails on dupes)

``DATABASE_URL`` must point at the Supabase pooler (see ``.env.example``);
``--database-url`` overrides it. Every run ends with row-count + checksum
assertions and a one-facility spot check — any mismatch fails loudly
before commit.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.repositories.loader import (  # noqa: E402
    LoaderError,
    load_all,
    resolve_database_url,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Load generated parquet data into Supabase (#9).")
    p.add_argument("--data-dir", type=str, default=str(ROOT / "data" / "generated"))
    p.add_argument("--database-url", type=str, default=None)
    p.add_argument(
        "--reset",
        action="store_true",
        help="delete existing rows first (preserves the seed demo facility)",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> dict:
    args = parse_args(argv)
    try:
        url = resolve_database_url(args.database_url)
        summary = load_all(args.data_dir, url, reset=args.reset)
    except LoaderError as exc:
        print(f"LOAD FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
    print(f"loaded into Supabase (reset={summary['reset']}) from {args.data_dir}")
    for name, rows in summary["rows"].items():
        print(f"  {name:18s} rows={rows:7d}")
    spot = summary["spot"]
    print(
        f"spot check facility {spot['facility_id'][:8]}…: "
        f"demand {spot['demand_rows']} rows / {spot['demand_qty']} units, "
        f"batches {spot['batch_rows']} rows / {spot['batch_qty']} units — MATCH"
    )
    print("row-count + checksum verification: PASS")
    return summary


if __name__ == "__main__":
    main()
