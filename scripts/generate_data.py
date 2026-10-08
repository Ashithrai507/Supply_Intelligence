"""Regenerate the seeded synthetic dataset (issue #5).

One command from the repo root::

    uv run python scripts/generate_data.py
    uv run python scripts/generate_data.py --seed 42 --days 540

Writes ``data/generated/*.parquet`` (+ ``_manifest.json``) with columns
matching ``project.md`` §12 exactly. Same seed → identical frames
(hash check printed at the end; ``_manifest.json`` stores sha256 per table).

Pass ``--load`` to push the result straight into Supabase (#9)::

    uv run python scripts/generate_data.py --load --reset
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.simulator.data import (  # noqa: E402
    DEFAULT_END_DATE,
    DEFAULT_HISTORY_DAYS,
    DEFAULT_SEED,
    frame_hash,
    generate_all,
    validate_schema,
    write_parquet,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seeded synthetic data generator (M2, #5).")
    p.add_argument("--seed", type=int, default=DEFAULT_SEED)
    p.add_argument("--days", type=int, default=DEFAULT_HISTORY_DAYS)
    p.add_argument("--end-date", type=str, default=DEFAULT_END_DATE.isoformat())
    p.add_argument("--out", type=str, default=str(ROOT / "data" / "generated"))
    p.add_argument(
        "--load",
        action="store_true",
        help="load the result into Supabase after generating (#9)",
    )
    p.add_argument("--database-url", type=str, default=None)
    p.add_argument(
        "--load-reset",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="wipe existing rows before --load (preserves seed demo facility)",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    end = date.fromisoformat(args.end_date)
    tables, manifest = generate_all(seed=args.seed, history_days=args.days, end=end)

    errors = validate_schema(tables)
    if errors:
        print("SCHEMA ERRORS:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)

    write_parquet(tables, manifest, args.out)

    dem = tables["demand_history"]
    out = dem[dem["outbreak_signal"]]["quantity_consumed"].mean()
    base = dem[~dem["outbreak_signal"]]["quantity_consumed"].mean()
    print(f"seed={args.seed} days={args.days} end={end.isoformat()} -> {args.out}")
    for name, df in tables.items():
        print(f"  {name:18s} rows={len(df):7d} hash={frame_hash(df)[:12]}")
    print(f"  outbreak mean={out:.1f} vs baseline mean={base:.1f} "
          f"(x{out / max(base, 1e-9):.2f} — spikes visible)")
    print("schema validation: PASS")

    if args.load:
        from app.repositories.loader import LoaderError, load_all, resolve_database_url

        try:
            url = resolve_database_url(args.database_url)
            summary = load_all(args.out, url, reset=args.load_reset)
        except LoaderError as exc:
            print(f"LOAD FAILED: {exc}", file=sys.stderr)
            sys.exit(1)
        print(f"loaded into Supabase (reset={summary['reset']})")
        for name, rows in summary["rows"].items():
            print(f"  {name:18s} rows={rows:7d}")
        print("row-count + checksum verification: PASS")


if __name__ == "__main__":
    main()
