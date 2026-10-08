"""
Load CSV data from data/synthetic/ into the SQLite database (data/medpredict.db).

Usage:
    uv run python scripts/load_sqlite.py
    uv run python scripts/load_sqlite.py --reset   # wipe and reload
"""

import csv
import os
import sys
from datetime import date
from pathlib import Path

# Allow running from repo root
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.database import Base, engine, SessionLocal  # noqa: E402
from app.models.entities import (  # noqa: E402
    DemandHistory,
    Hospital,
    InventoryBatch,
    Medicine,
    PurchaseOrder,
    SupplierMedicine,
    SupplySource,
)

DATA_DIR = ROOT / "data" / "synthetic"

RESET = "--reset" in sys.argv


def parse_date(s: str) -> date | None:
    """Convert ISO date string to Python date; return None if empty."""
    if not s or s.strip() == "":
        return None
    try:
        return date.fromisoformat(s.strip())
    except ValueError:
        return None


def load_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def run():
    print("🔧  Creating tables (if not exist)…")
    Base.metadata.create_all(engine)

    db = SessionLocal()
    try:
        if RESET:
            print("🗑   Wiping existing rows…")
            db.query(DemandHistory).delete()
            db.query(PurchaseOrder).delete()
            db.query(InventoryBatch).delete()
            db.query(SupplierMedicine).delete()
            db.query(SupplySource).delete()
            db.query(Medicine).delete()
            db.query(Hospital).delete()
            db.commit()

        # ── 1. hospitals ───────────────────────────────────────────────
        print("📥  Loading hospitals…")
        rows = load_csv(DATA_DIR / "hospitals.csv")
        existing_ids = {r.hospital_id for r in db.query(Hospital.id).all()} if not RESET else set()
        added = 0
        for r in rows:
            hid = r["hospital_id"]
            if hid in existing_ids:
                continue
            db.add(Hospital(
                id=hid,
                name=r["hospital_name"],
                city=r.get("city"),
                bed_capacity=int(r.get("bed_capacity") or 0),
                avg_daily_patients=int(r.get("avg_daily_patients") or 0),
            ))
            added += 1
        db.commit()
        print(f"   ✅  {added} hospitals added")

        # ── 2. medicines ───────────────────────────────────────────────
        print("📥  Loading medicines…")
        rows = load_csv(DATA_DIR / "medicines.csv")
        existing_ids = {r.id for r in db.query(Medicine.id).all()} if not RESET else set()
        added = 0
        for r in rows:
            mid = r["medicine_id"]
            if mid in existing_ids:
                continue
            db.add(Medicine(
                id=mid,
                name=r["medicine_name"],
                category=r.get("category", "General"),
                unit=r.get("unit", "unit"),
                criticality_level=r.get("criticality_level", "MEDIUM").upper(),
            ))
            added += 1
        db.commit()
        print(f"   ✅  {added} medicines added")

        # ── 3. supply_sources ──────────────────────────────────────────
        print("📥  Loading supply_sources…")
        rows = load_csv(DATA_DIR / "supply_sources.csv")
        existing_ids = {r.id for r in db.query(SupplySource.id).all()} if not RESET else set()
        added = 0
        for r in rows:
            sid = r["source_id"]
            if sid in existing_ids:
                continue
            db.add(SupplySource(
                id=sid,
                name=r["source_name"],
                source_type=r.get("source_type", "DISTRIBUTOR").upper(),
                city=r.get("city"),
            ))
            added += 1
        db.commit()
        print(f"   ✅  {added} supply sources added")

        # ── 4. supplier_medicines ──────────────────────────────────────
        print("📥  Loading supplier_medicines…")
        rows = load_csv(DATA_DIR / "supplier_medicines.csv")
        # Use composite key to avoid duplicates
        existing_pairs = {
            (r.source_id, r.medicine_id)
            for r in db.query(SupplierMedicine.source_id, SupplierMedicine.medicine_id).all()
        } if not RESET else set()
        added = 0
        for r in rows:
            key = (r["source_id"], r["medicine_id"])
            if key in existing_pairs:
                continue
            db.add(SupplierMedicine(
                source_id=r["source_id"],
                medicine_id=r["medicine_id"],
                lead_time_days=int(r.get("lead_time_days") or 7),
                unit_price=float(r.get("unit_price") or 0.0),
                minimum_order_quantity=int(r.get("minimum_order_quantity") or 1),
            ))
            added += 1
        db.commit()
        print(f"   ✅  {added} supplier–medicine links added")

        # ── 5. inventory_batches ───────────────────────────────────────
        print("📥  Loading inventory_batches…")
        rows = load_csv(DATA_DIR / "inventory_batches.csv")
        existing_ids = {r.id for r in db.query(InventoryBatch.id).all()} if not RESET else set()
        added = 0
        for r in rows:
            bid = r["inventory_id"]
            if bid in existing_ids:
                continue
            # CSV uses owner_id for hospital_id
            hospital_id = r.get("owner_id") or r.get("hospital_id") or None
            db.add(InventoryBatch(
                id=bid,
                hospital_id=hospital_id,
                owner_type=r.get("owner_type", "HOSPITAL"),
                medicine_id=r["medicine_id"],
                batch_number=r["batch_number"],
                quantity=int(r.get("quantity") or 0),
                reserved_quantity=int(r.get("reserved_quantity") or 0),
                received_date=parse_date(r.get("received_date", "")),
                expiry_date=parse_date(r["expiry_date"]),
            ))
            added += 1
            if added % 500 == 0:
                db.commit()
                print(f"   …{added} batches…")
        db.commit()
        print(f"   ✅  {added} inventory batches added")

        # ── 6. demand_history ──────────────────────────────────────────
        print("📥  Loading demand_history (this may take a moment)…")
        rows = load_csv(DATA_DIR / "demand_history.csv")
        added = 0
        # Batch insert for speed
        batch_size = 2000
        for i, r in enumerate(rows):
            db.add(DemandHistory(
                hospital_id=r["hospital_id"],
                medicine_id=r["medicine_id"],
                date=parse_date(r["date"]),
                quantity_consumed=int(r.get("quantity_consumed") or 0),
                patient_load=int(r.get("patient_load") or 0),
                emergency_cases=int(r.get("emergency_cases") or 0),
                outbreak_signal=int(r.get("outbreak_signal") or 0),
            ))
            added += 1
            if added % batch_size == 0:
                db.commit()
                print(f"   …{added} demand rows…")
        db.commit()
        print(f"   ✅  {added} demand history rows added")

        # ── 7. purchase_orders ─────────────────────────────────────────
        print("📥  Loading purchase_orders…")
        rows = load_csv(DATA_DIR / "purchase_orders.csv")
        existing_ids = {r.id for r in db.query(PurchaseOrder.id).all()} if not RESET else set()
        added = 0
        for r in rows:
            pid = r["po_id"]
            if pid in existing_ids:
                continue
            db.add(PurchaseOrder(
                id=pid,
                hospital_id=r["hospital_id"],
                source_id=r["source_id"],
                medicine_id=r["medicine_id"],
                order_date=parse_date(r["order_date"]),
                expected_delivery_date=parse_date(r.get("expected_delivery_date") or r["order_date"]),
                ordered_quantity=int(r.get("ordered_quantity") or 0),
                received_quantity=int(r.get("received_quantity") or 0),
                status=r.get("status", "PENDING").upper(),
            ))
            added += 1
        db.commit()
        print(f"   ✅  {added} purchase orders added")

        # ── Summary ────────────────────────────────────────────────────
        print()
        print("✅  Database loaded successfully!")
        print(f"   Hospitals:          {db.query(Hospital).count()}")
        print(f"   Medicines:          {db.query(Medicine).count()}")
        print(f"   Supply Sources:     {db.query(SupplySource).count()}")
        print(f"   Supplier→Medicine:  {db.query(SupplierMedicine).count()}")
        print(f"   Inventory Batches:  {db.query(InventoryBatch).count()}")
        print(f"   Demand History:     {db.query(DemandHistory).count()}")
        print(f"   Purchase Orders:    {db.query(PurchaseOrder).count()}")

    finally:
        db.close()


if __name__ == "__main__":
    run()
