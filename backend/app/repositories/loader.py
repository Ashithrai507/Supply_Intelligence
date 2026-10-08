"""Bulk loader: ``data/generated/*.parquet`` → Supabase Postgres (issue #9).

Engines query real tables instead of files after::

    uv run python scripts/load_supabase.py --reset

Design notes (project.md §11–§12, WORKPLAN.md M2):

- ``COPY ... FROM STDIN (FORMAT csv)`` via psycopg — fast enough for the
  ~432k-row ``demand_history`` without extra dependencies (pandas is already
  required by the generator).
- Insert order is FK-safe: parents (``facilities``, ``medicines``) before
  children (``inventory_batches``, ``demand_history``, ``suppliers``,
  ``routes``). ``--reset`` deletes in the reverse order.
- ``--reset`` preserves the seed demo facility from ``supabase/seed.sql``
  (``SEED_DEMO_FACILITY_ID``) — that row anchors the demo
  ``FACILITY_MANAGER`` profile, so the loader deletes around it instead of
  blind-truncating (see the note at the top of ``seed.sql``).
- Loud failures: missing files, §12 schema drift, and row-count/checksum
  mismatches all raise :class:`LoaderError` before commit.
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

from app.simulator.data import EXPECTED_COLUMNS, TABLES, validate_schema

# Demo facility from supabase/seed.sql — anchors the manager demo login.
SEED_DEMO_FACILITY_ID = "00000000-0000-0000-0000-00000000fac1"

# FK-safe insert order: parents first (project.md §12).
LOAD_ORDER: tuple[str, ...] = (
    "facilities",
    "medicines",
    "inventory_batches",
    "demand_history",
    "suppliers",
    "routes",
)

# Reverse for deletes: children first, parents last.
RESET_DELETE_ORDER: tuple[str, ...] = tuple(reversed(LOAD_ORDER))

# Per-table aggregate stats: (sql, label). DB side must equal the pandas side.
STATS_SQL: dict[str, str] = {
    "facilities": (
        "SELECT COUNT(*), COALESCE(SUM(patient_capacity), 0) FROM public.facilities"
    ),
    "medicines": (
        "SELECT COUNT(*), COALESCE(SUM(criticality_level), 0) FROM public.medicines"
    ),
    "inventory_batches": (
        "SELECT COUNT(*), COALESCE(SUM(quantity), 0), "
        "COALESCE(SUM(reserved_quantity), 0) FROM public.inventory_batches"
    ),
    "demand_history": (
        "SELECT COUNT(*), COALESCE(SUM(quantity_consumed), 0), "
        "COALESCE(SUM(patient_load), 0), COALESCE(SUM(emergency_cases), 0) "
        "FROM public.demand_history"
    ),
    "suppliers": (
        "SELECT COUNT(*), COALESCE(SUM(lead_time_days), 0), "
        "COALESCE(SUM(minimum_order_quantity), 0) FROM public.suppliers"
    ),
    "routes": (
        "SELECT COUNT(*), COALESCE(SUM(distance_km), 0), "
        "COALESCE(SUM(transport_capacity), 0) FROM public.routes"
    ),
}


class LoaderError(RuntimeError):
    """Loud loader failure — schema drift, missing files, verify mismatch."""


def resolve_database_url(explicit: str | None = None) -> str:
    """``--database-url`` wins, else ``DATABASE_URL`` (Supabase pooler, §29)."""
    url = explicit or os.environ.get("DATABASE_URL", "")
    if not url:
        raise LoaderError(
            "no database URL: pass --database-url or set DATABASE_URL "
            "(Supabase pooler connection string, see .env.example)"
        )
    return url


def read_tables(data_dir: str | Path) -> dict[str, pd.DataFrame]:
    """Read every ``<table>.parquet``; fail loudly on missing files."""
    root = Path(data_dir)
    missing = [f"{t}.parquet" for t in TABLES if not (root / f"{t}.parquet").exists()]
    if missing:
        raise LoaderError(
            f"missing parquet files in {root}: {missing} — "
            "run `uv run python scripts/generate_data.py` first (#5)"
        )
    return {t: pd.read_parquet(root / f"{t}.parquet") for t in TABLES}


def ensure_schema(tables: dict[str, pd.DataFrame]) -> None:
    """Fail loudly when parquet columns drift from project.md §12."""
    errors = validate_schema(tables)
    if errors:
        raise LoaderError("schema mismatch vs project.md §12:\n  - " + "\n  - ".join(errors))


def connect(database_url: str):
    """Open a psycopg connection (transactional; caller commits/rolls back)."""
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover — backend env always has it
        raise LoaderError("psycopg is required: `uv sync` in backend/") from exc
    try:
        return psycopg.connect(database_url)
    except Exception as exc:
        raise LoaderError(f"cannot connect to database: {exc}") from exc


def reset_tables(conn, preserve_facility_id: str = SEED_DEMO_FACILITY_ID) -> None:
    """Idempotent wipe: children first; the seed demo facility row survives."""
    with conn.cursor() as cur:
        for table in RESET_DELETE_ORDER:
            if table == "facilities":
                cur.execute(
                    "DELETE FROM public.facilities WHERE id <> %s",
                    (preserve_facility_id,),
                )
            else:
                cur.execute(f"DELETE FROM public.{table}")


def copy_table(conn, name: str, df: pd.DataFrame) -> int:
    """COPY one frame via CSV/STDIN; returns rows written."""
    cols = EXPECTED_COLUMNS[name]
    frame = df[list(cols)]  # enforce §12 order even if parquet drifted
    copy_sql = f"COPY public.{name} ({', '.join(cols)}) FROM STDIN WITH (FORMAT csv)"
    with conn.cursor() as cur:
        with cur.copy(copy_sql) as cp:
            for start in range(0, len(frame), 50_000):
                chunk = frame.iloc[start : start + 50_000].to_csv(index=False, header=False)
                cp.write(chunk)
    return len(frame)


def expected_stats(tables: dict[str, pd.DataFrame]) -> dict[str, list]:
    """Pandas-side row-count + checksum aggregates (ints; km rounded to 2dp)."""
    fac, med = tables["facilities"], tables["medicines"]
    return {
        "facilities": [len(fac), int(fac["patient_capacity"].sum())],
        "medicines": [len(med), int(med["criticality_level"].sum())],
        "inventory_batches": [
            len(tables["inventory_batches"]),
            int(tables["inventory_batches"]["quantity"].sum()),
            int(tables["inventory_batches"]["reserved_quantity"].sum()),
        ],
        "demand_history": [
            len(tables["demand_history"]),
            int(tables["demand_history"]["quantity_consumed"].sum()),
            int(tables["demand_history"]["patient_load"].sum()),
            int(tables["demand_history"]["emergency_cases"].sum()),
        ],
        "suppliers": [
            len(tables["suppliers"]),
            int(tables["suppliers"]["lead_time_days"].sum()),
            int(tables["suppliers"]["minimum_order_quantity"].sum()),
        ],
        "routes": [
            len(tables["routes"]),
            round(float(tables["routes"]["distance_km"].sum()), 2),
            int(tables["routes"]["transport_capacity"].sum()),
        ],
    }


def fetch_db_stats(conn) -> dict[str, list]:
    """Database-side aggregates; float sums rounded to 2dp for comparison."""
    stats: dict[str, list] = {}
    with conn.cursor() as cur:
        for table, sql in STATS_SQL.items():
            cur.execute(sql)
            row = cur.fetchone()
            assert row is not None
            stats[table] = [
                int(v) if i != 1 or table != "routes" else round(float(v), 2)
                for i, v in enumerate(row)
            ]
            stats[table][0] = int(row[0])
    return stats


def verify_load(conn, tables: dict[str, pd.DataFrame]) -> dict[str, list]:
    """Row-count + checksum assertions after load; raise on any mismatch."""
    want = expected_stats(tables)
    got = fetch_db_stats(conn)
    mismatches = [
        f"{t}: parquet {want[t]} != database {got[t]}"
        for t in TABLES
        if want[t] != got[t]
    ]
    if mismatches:
        raise LoaderError("load verification failed:\n  - " + "\n  - ".join(mismatches))
    return got


def spot_check(conn, tables: dict[str, pd.DataFrame], facility_id: str | None = None) -> dict:
    """One facility's full demand history + batch expiries vs parquet source."""
    fid = facility_id or str(tables["facilities"]["id"].iloc[0])
    dem = tables["demand_history"]
    inv = tables["inventory_batches"]
    want = {
        "facility_id": fid,
        "demand_rows": int((dem["facility_id"] == fid).sum()),
        "demand_qty": int(dem.loc[dem["facility_id"] == fid, "quantity_consumed"].sum()),
        "batch_rows": int((inv["facility_id"] == fid).sum()),
        "batch_qty": int(inv.loc[inv["facility_id"] == fid, "quantity"].sum()),
    }
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*), COALESCE(SUM(quantity_consumed), 0) "
            "FROM public.demand_history WHERE facility_id = %s",
            (fid,),
        )
        dem_row = cur.fetchone()
        cur.execute(
            "SELECT COUNT(*), COALESCE(SUM(quantity), 0) "
            "FROM public.inventory_batches WHERE facility_id = %s",
            (fid,),
        )
        inv_row = cur.fetchone()
    assert dem_row is not None and inv_row is not None
    got = {
        "facility_id": fid,
        "demand_rows": int(dem_row[0]),
        "demand_qty": int(dem_row[1]),
        "batch_rows": int(inv_row[0]),
        "batch_qty": int(inv_row[1]),
    }
    if want != got:
        raise LoaderError(
            f"spot check failed for facility {fid}:\n  parquet {want}\n  db      {got}"
        )
    return got


def load_all(
    data_dir: str | Path,
    database_url: str,
    reset: bool = False,
) -> dict:
    """Read → schema-gate → (reset) → COPY in FK order → verify → spot check."""
    tables = read_tables(data_dir)
    ensure_schema(tables)
    conn = connect(database_url)
    try:
        if reset:
            reset_tables(conn)
        loaded = {name: copy_table(conn, name, tables[name]) for name in LOAD_ORDER}
        stats = verify_load(conn, tables)
        spot = spot_check(conn, tables)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return {"rows": loaded, "stats": stats, "spot": spot, "reset": reset}
