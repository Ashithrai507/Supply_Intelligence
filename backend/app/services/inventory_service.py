"""Inventory and batch intelligence service."""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.entities import (
    DemandHistory,
    InventoryBatch,
    Medicine,
    PurchaseOrder,
    SupplierMedicine,
)
from app.schemas.medpredict import BatchSchema, MedicineInventoryDetail

# The dataset demand history ends on 2026-09-30.
# The simulation operational date starts on 2026-10-01.
SIMULATION_CURRENT_DATE = date(2026, 10, 1)


def get_current_operational_date() -> date:
    return SIMULATION_CURRENT_DATE


def calculate_medicine_inventory(
    db: Session,
    hospital_id: str,
    medicine_id: str,
    surge_multiplier: float = 1.0,
) -> MedicineInventoryDetail | None:
    today = get_current_operational_date()

    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        return None

    batches = (
        db.query(InventoryBatch)
        .filter(
            InventoryBatch.hospital_id == hospital_id,
            InventoryBatch.medicine_id == medicine_id,
        )
        .all()
    )

    # 1. Recent daily demand (mean of last 14 days)
    recent_demands = (
        db.query(DemandHistory.quantity_consumed)
        .filter(
            DemandHistory.hospital_id == hospital_id,
            DemandHistory.medicine_id == medicine_id,
        )
        .order_by(DemandHistory.date.desc())
        .limit(14)
        .all()
    )
    if recent_demands:
        base_daily_demand = float(sum(d[0] for d in recent_demands) / len(recent_demands))
    else:
        base_daily_demand = 10.0

    daily_demand = max(1.0, round(base_daily_demand * surge_multiplier, 1))

    # 2. Batch aggregation and expiry calculation
    total_qty = 0
    reserved_qty = 0
    usable_qty = 0
    batch_schemas: list[BatchSchema] = []

    for b in batches:
        b_qty = b.quantity
        b_res = b.reserved_quantity
        total_qty += b_qty
        reserved_qty += b_res

        days_to_exp = (b.expiry_date - today).days
        is_expired = days_to_exp <= 0

        usable_batch = 0
        potential_waste = 0

        if not is_expired:
            usable_batch = max(0, b_qty - b_res)
            usable_qty += usable_batch

            # Expected consumption before expiry
            expected_consumption = daily_demand * days_to_exp
            potential_waste = max(0, int(round(b_qty - expected_consumption)))
        else:
            potential_waste = b_qty

        batch_schemas.append(
            BatchSchema(
                id=b.id,
                batch_number=b.batch_number,
                quantity=b_qty,
                reserved_quantity=b_res,
                usable_quantity=usable_batch,
                received_date=b.received_date.isoformat() if b.received_date else None,
                expiry_date=b.expiry_date.isoformat(),
                days_to_expiry=days_to_exp,
                is_expired=is_expired,
                potential_wastage=potential_waste,
            )
        )

    # 3. Days of Supply
    days_of_supply = round(usable_qty / daily_demand, 1)

    # 4. Incoming purchase orders
    pending_pos = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.hospital_id == hospital_id,
            PurchaseOrder.medicine_id == medicine_id,
            PurchaseOrder.status.in_(["PENDING", "ORDERED", "PARTIALLY_RECEIVED"]),
        )
        .all()
    )
    incoming_po_qty = sum(po.ordered_quantity - po.received_quantity for po in pending_pos)

    # 5. Supplier lead time
    supp_link = (
        db.query(SupplierMedicine)
        .filter(SupplierMedicine.medicine_id == medicine_id)
        .order_by(SupplierMedicine.lead_time_days.asc())
        .first()
    )
    lead_time_days = supp_link.lead_time_days if supp_link else 7

    # 6. Deterministic stock-out simulation
    # Projected stock daily walk
    projected_stock = float(usable_qty)
    days_until_stockout: float | None = None
    projected_stockout_date: str | None = None
    safety_stock = daily_demand * 2.0  # 2 days safety buffer

    # Walk forward up to 60 days
    stockout_step = None
    for step in range(1, 61):
        step_date = today + timedelta(days=step)
        # Check incoming supply on this date
        supply_today = sum(
            po.ordered_quantity - po.received_quantity
            for po in pending_pos
            if po.expected_delivery_date == step_date
        )
        projected_stock += supply_today - daily_demand

        if projected_stock <= safety_stock and stockout_step is None:
            # Fractional step estimate
            surplus_before = projected_stock + daily_demand - safety_stock
            frac = max(0.0, min(1.0, surplus_before / daily_demand))
            stockout_step = round(float(step - 1 + frac), 1)
            days_until_stockout = stockout_step
            projected_stockout_date = (today + timedelta(days=int(stockout_step))).isoformat()
            break

    if days_until_stockout is None:
        days_until_stockout = 999.0  # Safe

    # Risk level classification
    if days_until_stockout <= 3.0:
        risk_level = "CRITICAL"
    elif days_until_stockout <= 7.0:
        risk_level = "HIGH"
    elif days_until_stockout <= 14.0:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return MedicineInventoryDetail(
        hospital_id=hospital_id,
        medicine_id=medicine_id,
        medicine_name=medicine.name,
        category=medicine.category,
        unit=medicine.unit,
        criticality_level=medicine.criticality_level,
        total_quantity=total_qty,
        reserved_quantity=reserved_qty,
        usable_inventory=usable_qty,
        expected_daily_demand=daily_demand,
        days_of_supply=days_of_supply,
        projected_stockout_date=projected_stockout_date,
        days_until_stockout=days_until_stockout if days_until_stockout < 900 else None,
        risk_level=risk_level,
        batches=batch_schemas,
        incoming_purchase_orders_quantity=incoming_po_qty,
        supplier_lead_time_days=lead_time_days,
    )


def list_hospital_inventory(
    db: Session,
    hospital_id: str,
    surge_multiplier: float = 1.0,
) -> list[MedicineInventoryDetail]:
    medicines = db.query(Medicine).all()
    results = []
    for med in medicines:
        inv = calculate_medicine_inventory(db, hospital_id, med.id, surge_multiplier)
        if inv:
            results.append(inv)
    return results
