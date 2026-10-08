"""Procurement and redistribution recommendation engine."""

import math
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.entities import (
    Hospital,
    InventoryBatch,
    SupplierMedicine,
    SupplySource,
)
from app.schemas.medpredict import ProcurementRecommendation, SimpleRedistribution
from app.services.inventory_service import (
    get_current_operational_date,
    list_hospital_inventory,
)


def generate_procurement_recommendations(
    db: Session,
    hospital_id: str,
    surge_multiplier: float = 1.0,
) -> list[ProcurementRecommendation]:
    """Generates simple, transparent procurement recommendations for a hospital."""
    today = get_current_operational_date()
    inventory_items = list_hospital_inventory(db, hospital_id, surge_multiplier)
    recommendations: list[ProcurementRecommendation] = []

    for inv in inventory_items:
        # Supplier lookup
        supp_link = (
            db.query(SupplierMedicine)
            .filter(SupplierMedicine.medicine_id == inv.medicine_id)
            .order_by(SupplierMedicine.lead_time_days.asc(), SupplierMedicine.unit_price.asc())
            .first()
        )

        lead_time = supp_link.lead_time_days if supp_link else 7
        moq = supp_link.minimum_order_quantity if supp_link else 10
        unit_price = supp_link.unit_price if supp_link else 100.0

        source_name = "Approved Distributor"
        source_id = None
        if supp_link:
            source = db.query(SupplySource).filter(SupplySource.id == supp_link.source_id).first()
            if source:
                source_name = source.name
                source_id = source.id

        # Lead time demand & safety stock
        forecast_lead_time_demand = inv.expected_daily_demand * lead_time
        safety_stock = inv.expected_daily_demand * 2.0  # 2 days buffer
        required_inventory = forecast_lead_time_demand + safety_stock

        # Usable stock & incoming POs
        usable_stock = float(inv.usable_inventory)
        incoming_po = float(inv.incoming_purchase_orders_quantity)

        deficit = required_inventory - usable_stock - incoming_po

        if deficit > 0:
            raw_order = int(math.ceil(deficit))
            order_qty = max(raw_order, moq)

            # Determine urgency
            days_stockout = inv.days_until_stockout if inv.days_until_stockout is not None else 999.0
            if days_stockout <= lead_time:
                urgency = "CRITICAL"
            elif days_stockout <= lead_time * 1.5:
                urgency = "HIGH"
            else:
                urgency = "MEDIUM"

            delivery_date = (today + timedelta(days=lead_time)).isoformat()
            reason = (
                f"Usable stock ({inv.usable_inventory} {inv.unit}) is insufficient for expected lead time demand "
                f"({int(round(forecast_lead_time_demand))} {inv.unit} over {lead_time} days) and safety buffer. "
                f"Current supply lasts {inv.days_of_supply} days."
            )

            recommendations.append(
                ProcurementRecommendation(
                    id=f"REC-{hospital_id}-{inv.medicine_id}",
                    medicine_id=inv.medicine_id,
                    medicine_name=inv.medicine_name,
                    category=inv.category,
                    criticality_level=inv.criticality_level,
                    recommended_quantity=order_qty,
                    source_id=source_id,
                    source_name=source_name,
                    lead_time_days=lead_time,
                    unit_price=round(unit_price, 2),
                    estimated_cost=round(order_qty * unit_price, 2),
                    expected_delivery_date=delivery_date,
                    urgency=urgency,
                    reason=reason,
                )
            )

    # Sort: CRITICAL first, then HIGH, then estimated cost
    urgency_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
    recommendations.sort(key=lambda r: (urgency_rank.get(r.urgency, 99), -r.estimated_cost))
    return recommendations


def generate_redistribution_suggestions(
    db: Session,
    hospital_id: str,
) -> list[SimpleRedistribution]:
    """Simple redistribution heuristic: if this hospital has shortage (< 7 DOS),

    check if another source has surplus stock.
    """
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    hosp_name = hospital.name if hospital else hospital_id

    inventory_items = list_hospital_inventory(db, hospital_id)
    shortage_meds = {item.medicine_id: item for item in inventory_items if item.days_of_supply < 7.0}

    suggestions = []
    if not shortage_meds:
        return suggestions

    # Check inventory at other sources for these shortage medicines
    other_batches = (
        db.query(InventoryBatch)
        .filter(
            InventoryBatch.hospital_id != hospital_id,
            InventoryBatch.medicine_id.in_(list(shortage_meds.keys())),
            InventoryBatch.quantity > 50,
        )
        .limit(10)
        .all()
    )

    for b in other_batches:
        med = shortage_meds.get(b.medicine_id)
        if not med:
            continue
        source_label = f"Facility {b.hospital_id or b.owner_type}"
        transfer_qty = min(int(b.quantity * 0.5), int(med.expected_daily_demand * 7))
        if transfer_qty > 0:
            suggestions.append(
                SimpleRedistribution(
                    medicine_id=med.medicine_id,
                    medicine_name=med.medicine_name,
                    source_name=source_label,
                    destination_hospital_name=hosp_name,
                    suggested_quantity=transfer_qty,
                    reason=(
                        f"Excess inventory ({b.quantity} units) available at {source_label}; "
                        f"{hosp_name} facing stockout risk in {med.days_of_supply} days."
                    ),
                )
            )
            if len(suggestions) >= 3:
                break

    return suggestions
