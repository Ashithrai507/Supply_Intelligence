"""Data seeder for MedPredict 7-table MVP."""

import uuid
from datetime import datetime
from pathlib import Path

import pandas as pd

from app.core.database import Base, SessionLocal, engine
from app.models.entities import (
    DemandHistory,
    Hospital,
    InventoryBatch,
    Medicine,
    PurchaseOrder,
    SupplierMedicine,
    SupplySource,
)

ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = ROOT_DIR / "data" / "synthetic"


def seed_database(data_dir: Path = DATA_DIR, reset: bool = True) -> dict[str, int]:
    """Seed the database from CSV files in data_dir."""
    print(f"Creating tables on database: {engine.url}...")
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        if reset:
            print("Resetting existing records...")
            session.query(PurchaseOrder).delete()
            session.query(InventoryBatch).delete()
            session.query(DemandHistory).delete()
            session.query(SupplierMedicine).delete()
            session.query(SupplySource).delete()
            session.query(Medicine).delete()
            session.query(Hospital).delete()
            session.commit()

        counts = {}

        # 1. Hospitals
        hosp_df = pd.read_csv(data_dir / "hospitals.csv")
        hosp_objs = [
            Hospital(
                id=row["hospital_id"],
                name=row["hospital_name"],
                city=row.get("city", "Bengaluru"),
                bed_capacity=int(row.get("bed_capacity", 0)),
                avg_daily_patients=int(row.get("avg_daily_patients", 0)),
            )
            for _, row in hosp_df.iterrows()
        ]
        session.bulk_save_objects(hosp_objs)
        session.commit()
        counts["hospitals"] = len(hosp_objs)

        # 2. Medicines
        med_df = pd.read_csv(data_dir / "medicines.csv")
        med_objs = [
            Medicine(
                id=row["medicine_id"],
                name=row["medicine_name"],
                category=row["category"],
                unit=row["unit"],
                criticality_level=row["criticality_level"],
            )
            for _, row in med_df.iterrows()
        ]
        session.bulk_save_objects(med_objs)
        session.commit()
        counts["medicines"] = len(med_objs)

        # 3. Supply Sources
        src_df = pd.read_csv(data_dir / "supply_sources.csv")
        src_objs = [
            SupplySource(
                id=row["source_id"],
                name=row["source_name"],
                source_type=row["source_type"],
                city=row.get("city", "Bengaluru"),
            )
            for _, row in src_df.iterrows()
        ]
        session.bulk_save_objects(src_objs)
        session.commit()
        counts["supply_sources"] = len(src_objs)

        # 4. Supplier Medicines
        sm_df = pd.read_csv(data_dir / "supplier_medicines.csv")
        sm_objs = [
            SupplierMedicine(
                id=str(uuid.uuid4()),
                source_id=row["source_id"],
                medicine_id=row["medicine_id"],
                lead_time_days=int(row["lead_time_days"]),
                unit_price=float(row["unit_price"]),
                minimum_order_quantity=int(row["minimum_order_quantity"]),
            )
            for _, row in sm_df.iterrows()
        ]
        session.bulk_save_objects(sm_objs)
        session.commit()
        counts["supplier_medicines"] = len(sm_objs)

        # 5. Inventory Batches
        inv_df = pd.read_csv(data_dir / "inventory_batches.csv")
        inv_objs = []
        valid_hospital_ids = set(hosp_df["hospital_id"])
        for _, row in inv_df.iterrows():
            owner_id = row["owner_id"]
            hosp_id = owner_id if owner_id in valid_hospital_ids else None
            rec_date = (
                datetime.strptime(row["received_date"], "%Y-%m-%d").date()
                if pd.notna(row.get("received_date"))
                else None
            )
            exp_date = datetime.strptime(row["expiry_date"], "%Y-%m-%d").date()
            inv_objs.append(
                InventoryBatch(
                    id=row["inventory_id"],
                    hospital_id=hosp_id,
                    owner_type=row.get("owner_type", "HOSPITAL"),
                    medicine_id=row["medicine_id"],
                    batch_number=row["batch_number"],
                    quantity=int(row["quantity"]),
                    reserved_quantity=int(row.get("reserved_quantity", 0)),
                    received_date=rec_date,
                    expiry_date=exp_date,
                )
            )
        session.bulk_save_objects(inv_objs)
        session.commit()
        counts["inventory_batches"] = len(inv_objs)

        # 6. Purchase Orders
        po_df = pd.read_csv(data_dir / "purchase_orders.csv")
        po_objs = []
        for _, row in po_df.iterrows():
            order_date = datetime.strptime(row["order_date"], "%Y-%m-%d").date()
            delivery_date = datetime.strptime(
                row["expected_delivery_date"], "%Y-%m-%d"
            ).date()
            po_objs.append(
                PurchaseOrder(
                    id=row["po_id"],
                    hospital_id=row["hospital_id"],
                    source_id=row["source_id"],
                    medicine_id=row["medicine_id"],
                    order_date=order_date,
                    expected_delivery_date=delivery_date,
                    ordered_quantity=int(row["ordered_quantity"]),
                    received_quantity=int(row.get("received_quantity", 0)),
                    status=row.get("status", "PENDING"),
                )
            )
        session.bulk_save_objects(po_objs)
        session.commit()
        counts["purchase_orders"] = len(po_objs)

        # 7. Demand History
        print("Loading demand history (146,000 records)...")
        dh_df = pd.read_csv(data_dir / "demand_history.csv")
        chunk_size = 10000
        total_dh = len(dh_df)
        for i in range(0, total_dh, chunk_size):
            chunk = dh_df.iloc[i : i + chunk_size]
            dh_objs = [
                DemandHistory(
                    id=f"{row['hospital_id']}_{row['medicine_id']}_{row['date']}",
                    hospital_id=row["hospital_id"],
                    medicine_id=row["medicine_id"],
                    date=datetime.strptime(row["date"], "%Y-%m-%d").date(),
                    quantity_consumed=int(row["quantity_consumed"]),
                    patient_load=int(row.get("patient_load", 0)),
                    emergency_cases=int(row.get("emergency_cases", 0)),
                    outbreak_signal=int(row.get("outbreak_signal", 0)),
                )
                for _, row in chunk.iterrows()
            ]
            session.bulk_save_objects(dh_objs)
            session.commit()
        counts["demand_history"] = total_dh

        print("Seeding completed successfully!")
        for tbl, count in counts.items():
            print(f"  {tbl:20s}: {count:7d} records")
        return counts

    except Exception as e:
        session.rollback()
        print(f"Error during seeding: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    seed_database()
