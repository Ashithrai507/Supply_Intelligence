"""Regenerate the seeded synthetic dataset (issue #5).

One command from the repo root::

    uv run python scripts/generate_data.py
    uv run python scripts/generate_data.py --seed 42 --days 540

Writes ``data/generated/*.parquet`` (+ ``_manifest.json``) with columns
matching ``project.md`` §12 exactly. Same seed → identical frames
(hash check printed at the end; ``_manifest.json`` stores sha256 per table).
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


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seeded synthetic data generator (M2, #5).")
    p.add_argument("--seed", type=int, default=DEFAULT_SEED)
    p.add_argument("--days", type=int, default=DEFAULT_HISTORY_DAYS)
    p.add_argument("--end-date", type=str, default=DEFAULT_END_DATE.isoformat())
    p.add_argument("--out", type=str, default=str(ROOT / "data" / "generated"))
    return p.parse_args()


def main() -> None:
    args = parse_args()
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


if __name__ == "__main__":
    main()
