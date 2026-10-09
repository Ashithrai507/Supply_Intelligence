"""Load data/synthetic/*.csv into Postgres (Supabase Docker) via COPY.

Mirrors backend/app/db/seed.py column mapping, but targets DATABASE_URL
(Supabase Postgres) instead of sqlite. Idempotent: truncates the 7 MVP
tables first (demo database).

Usage (backend venv provides psycopg):
    cd backend && uv run python ../scripts/load_synthetic_postgres.py
"""

import csv
import io
import os
import uuid
from pathlib import Path

import psycopg
from psycopg import sql

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data" / "synthetic"
DB_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)

# (csv file, table, [(csv_col, db_col, converter)], row filter/extra)
TABLES: list = []


def _int(v: str) -> int:
    return int(float(v))


def _bool_int(v: str) -> int:
    return 1 if v.strip().lower() in ("1", "true", "t", "yes") else 0


# CSV uses ORDERED for placed-but-unreceived orders; migration CHECK allows
# PENDING/PARTIALLY_RECEIVED/RECEIVED/CANCELLED. Map unknown → PENDING.
def _po_status(v: str) -> str:
    s = v.strip().upper()
    if s in ("PENDING", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"):
        return s
    return "PENDING"


def load_table(cur, filename: str, table: str, mapping: list, row_fn=None) -> int:
    """COPY rows from CSV into table following (csv_col, db_col, converter)."""
    cols = [db for _, db, _ in mapping]
    stmt = f"COPY public.{table} ({', '.join(cols)}) FROM STDIN WITH (FORMAT csv)"
    buf = io.StringIO()
    writer = csv.writer(buf)
    count = 0
    convert = row_fn or (lambda row: [
        str(uuid.uuid4()) if c == "__gen_id__" else conv(row[c]) for c, _, conv in mapping
    ])
    with open(DATA_DIR / filename, newline="") as fh:
        reader = csv.DictReader(fh)
        for r in reader:
            writer.writerow(convert(r))
            count += 1
    buf.seek(0)
    with cur.copy(stmt) as copy:
        copy.write(buf.read())
    return count


def main() -> int:
    print(f"Connecting to {DB_URL.split('@')[-1]} ...", flush=True)
    try:
        conn = psycopg.connect(DB_URL, connect_timeout=10)
    except Exception as exc:
        print(f"ERROR: cannot connect: {exc}", flush=True)
        return 1
    with conn:
        with conn.cursor() as cur:
            print("Truncating 7 MVP tables...", flush=True)
            for t in ("demand_history", "purchase_orders", "inventory_batches",
                      "supplier_medicines", "medicines", "supply_sources", "hospitals"):
                cur.execute(f"TRUNCATE public.{t} RESTART IDENTITY CASCADE")

            cur.execute("SELECT id FROM public.hospitals")
            valid_hospitals = {row[0] for row in cur.fetchall()}

            def inventory_row(r):
                owner = r["owner_id"]
                return [
                    r["inventory_id"],
                    owner if owner in valid_hospitals else None,
                    r.get("owner_type", "HOSPITAL"),
                    r["medicine_id"], r["batch_number"],
                    _int(r["quantity"]), _int(r.get("reserved_quantity", 0) or 0),
                    r["received_date"], r["expiry_date"],
                ]

            specs = [
                ("hospitals.csv", "hospitals", [
                    ("hospital_id", "id", str), ("hospital_name", "name", str),
                    ("city", "city", str), ("bed_capacity", "bed_capacity", _int),
                    ("avg_daily_patients", "avg_daily_patients", _int)]),
                ("supply_sources.csv", "supply_sources", [
                    ("source_id", "id", str), ("source_name", "name", str),
                    ("source_type", "source_type", str), ("city", "city", str)]),
                ("medicines.csv", "medicines", [
                    ("medicine_id", "id", str), ("medicine_name", "name", str),
                    ("category", "category", str), ("unit", "unit", str),
                    ("criticality_level", "criticality_level", str)]),
                ("supplier_medicines.csv", "supplier_medicines", [
                    ("__gen_id__", "id", str), ("source_id", "source_id", str), ("medicine_id", "medicine_id", str),
                    ("lead_time_days", "lead_time_days", _int), ("unit_price", "unit_price", float),
                    ("minimum_order_quantity", "minimum_order_quantity", _int)]),
                ("inventory_batches.csv", "inventory_batches", [
                    ("inventory_id", "id", str), ("owner_id", "hospital_id", str),
                    ("owner_type", "owner_type", str), ("medicine_id", "medicine_id", str),
                    ("batch_number", "batch_number", str), ("quantity", "quantity", _int),
                    ("reserved_quantity", "reserved_quantity", _int),
                    ("received_date", "received_date", str), ("expiry_date", "expiry_date", str)],
                 inventory_row),
                ("purchase_orders.csv", "purchase_orders", [
                    ("po_id", "id", str), ("hospital_id", "hospital_id", str),
                    ("source_id", "source_id", str), ("medicine_id", "medicine_id", str),
                    ("order_date", "order_date", str),
                    ("expected_delivery_date", "expected_delivery_date", str),
                    ("ordered_quantity", "ordered_quantity", _int),
                    ("received_quantity", "received_quantity", _int),
                    ("status", "status", _po_status)]),
            ]
            for spec in specs:
                filename, table, mapping = spec[0], spec[1], spec[2]
                row_fn = spec[3] if len(spec) > 3 else None
                n = load_table(cur, filename, table, mapping, row_fn)
                print(f"{table}: {n}", flush=True)

            # demand_history needs generated ids (csv has no id column)
            print("demand_history: streaming 146k rows...", flush=True)
            stmt = (
                "COPY public.demand_history (id, hospital_id, medicine_id, date,"
                " quantity_consumed, patient_load, emergency_cases, outbreak_signal)"
                " FROM STDIN WITH (FORMAT csv)"
            )
            with open(DATA_DIR / "demand_history.csv", newline="") as fh:
                reader = csv.DictReader(fh)
                buf, batch, n = io.StringIO(), 0, 0
                writer = csv.writer(buf)
                with cur.copy(stmt) as copy:
                    for r in reader:
                        writer.writerow([
                            f"{r['hospital_id']}_{r['medicine_id']}_{r['date']}",
                            r["hospital_id"], r["medicine_id"], r["date"],
                            _int(r["quantity_consumed"]), _int(r["patient_load"]),
                            _int(r["emergency_cases"]), _bool_int(r["outbreak_signal"]),
                        ])
                        n += 1
                        batch += 1
                        if batch >= 20000:
                            buf.seek(0)
                            copy.write(buf.read())
                            buf, batch = io.StringIO(), 0
                            writer = csv.writer(buf)
                    if batch:
                        buf.seek(0)
                        copy.write(buf.read())
            print(f"demand_history: {n}", flush=True)
    print("LOAD COMPLETE", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
