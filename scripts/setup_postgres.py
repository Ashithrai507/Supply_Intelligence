"""One-shot Postgres setup for the Docker path: roles + migrations + seed.

Usage:
    cd backend && uv run python ../scripts/setup_postgres.py
    DATABASE_URL=postgresql://... uv run python ../scripts/setup_postgres.py
"""

import os
from pathlib import Path

import psycopg
from psycopg import sql

ROOT_DIR = Path(__file__).resolve().parents[1]
DB_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)
FILES = [
    "supabase/migrations/20261008210000_simplify_medpredict_schema.sql",
    "supabase/migrations/20261008213000_allow_read_policies.sql",
    "supabase/seed.sql",
]


def main() -> int:
    print(f"Connecting to {DB_URL.split('@')[-1]} ...", flush=True)
    with psycopg.connect(DB_URL, autocommit=True) as conn:
        with conn.cursor() as cur:
            for role in ("anon", "authenticated", "service_role"):
                cur.execute(
                    sql.SQL(
                        "DO $$ BEGIN IF NOT EXISTS "
                        "(SELECT 1 FROM pg_roles WHERE rolname = {}) "
                        "THEN CREATE ROLE {} NOLOGIN; END IF; END $$;"
                    ).format(sql.Literal(role), sql.Identifier(role))
                )
            print("roles ok (anon, authenticated, service_role)", flush=True)
            # App ids are opaque strings (H01/M001); migration declares UUID.
            # Normalize id + FK columns to TEXT (seed UUIDs stay valid as text).
            # FKs must be dropped first — Postgres won't alter constrained columns.
            fks = [
                ("supplier_medicines", "source_id", "supply_sources"),
                ("supplier_medicines", "medicine_id", "medicines"),
                ("demand_history", "hospital_id", "hospitals"),
                ("demand_history", "medicine_id", "medicines"),
                ("inventory_batches", "hospital_id", "hospitals"),
                ("inventory_batches", "medicine_id", "medicines"),
                ("purchase_orders", "hospital_id", "hospitals"),
                ("purchase_orders", "source_id", "supply_sources"),
                ("purchase_orders", "medicine_id", "medicines"),
            ]
            cols = ["hospitals.id", "medicines.id", "supply_sources.id"] + [
                f"{t}.{c}" for t, c, _ in fks if f"{t}.{c}" not in
                ("hospitals.id", "medicines.id", "supply_sources.id")
            ] + ["supplier_medicines.id", "demand_history.id",
                 "inventory_batches.id", "purchase_orders.id"]
            for table, col, _ in fks:
                cur.execute(
                    sql.SQL("ALTER TABLE public.{} DROP CONSTRAINT IF EXISTS {}").format(
                        sql.Identifier(table), sql.Identifier(f"{table}_{col}_fkey"))
                )
            for view in ("hospital_inventory_summary", "hospital_pending_orders"):
                cur.execute(
                    sql.SQL("DROP VIEW IF EXISTS public.{}").format(sql.Identifier(view))
                )
            for dotted in cols:
                table, col = dotted.split(".")
                cur.execute(
                    sql.SQL("ALTER TABLE public.{} ALTER COLUMN {} DROP DEFAULT").format(
                        sql.Identifier(table), sql.Identifier(col))
                )
                cur.execute(
                    sql.SQL("ALTER TABLE public.{} ALTER COLUMN {} TYPE TEXT USING {}::text").format(
                        sql.Identifier(table), sql.Identifier(col), sql.Identifier(col))
                )
            for table, col, parent in fks:
                cur.execute(
                    sql.SQL("ALTER TABLE public.{} ADD CONSTRAINT {} FOREIGN KEY ({})"
                            " REFERENCES public.{}(id) ON DELETE CASCADE").format(
                        sql.Identifier(table), sql.Identifier(f"{table}_{col}_fkey"),
                        sql.Identifier(col), sql.Identifier(parent))
                )
            print("ids normalized to TEXT, FKs restored", flush=True)
            for table in ("hospitals", "medicines", "supply_sources", "supplier_medicines",
                          "demand_history", "inventory_batches", "purchase_orders"):
                cur.execute(
                    sql.SQL("ALTER TABLE public.{} ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text)").format(
                        sql.Identifier(table))
                )
            migration = (ROOT_DIR / FILES[0]).read_text()
            cur.execute(migration[migration.index("CREATE OR REPLACE VIEW"):])
            print("views recreated", flush=True)
            # Drift fix 2: entities.py declares hospital_id nullable (supplier-owned
            # batches map to NULL, mirroring seed.py) but migration says NOT NULL.
            cur.execute("ALTER TABLE public.inventory_batches ALTER COLUMN hospital_id DROP NOT NULL")
            cur.execute(
                "ALTER TABLE public.inventory_batches ADD COLUMN IF NOT EXISTS "
                "owner_type VARCHAR(50) DEFAULT 'HOSPITAL'"
            )
            for f in FILES:
                cur.execute((ROOT_DIR / f).read_text())
                print(f"applied {f.split('/')[-1]}", flush=True)
            cur.execute(
                "SELECT 'hospitals', count(*) FROM public.hospitals "
                "UNION ALL SELECT 'medicines', count(*) FROM public.medicines "
                "UNION ALL SELECT 'demand_history', count(*) FROM public.demand_history"
            )
            for table, count in cur.fetchall():
                print(f"  {table}: {count}", flush=True)
    print("SETUP OK", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
