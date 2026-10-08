"""Risk intelligence service for stock-out and expiry risks."""

from sqlalchemy.orm import Session

from app.schemas.medpredict import ExpiryRiskItem, StockoutRiskItem
from app.services.inventory_service import list_hospital_inventory


def get_stockout_risks(
    db: Session,
    hospital_id: str,
    surge_multiplier: float = 1.0,
) -> list[StockoutRiskItem]:
    inventory_items = list_hospital_inventory(db, hospital_id, surge_multiplier)
    risk_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

    stockout_items = []
    for inv in inventory_items:
        stockout_items.append(
            StockoutRiskItem(
                hospital_id=inv.hospital_id,
                medicine_id=inv.medicine_id,
                medicine_name=inv.medicine_name,
                category=inv.category,
                criticality_level=inv.criticality_level,
                current_stock=inv.total_quantity,
                usable_stock=inv.usable_inventory,
                daily_demand=inv.expected_daily_demand,
                days_of_supply=inv.days_of_supply,
                days_until_stockout=inv.days_until_stockout,
                projected_stockout_date=inv.projected_stockout_date,
                risk_level=inv.risk_level,
            )
        )

    # Sort by risk level priority (CRITICAL first), then days of supply ascending
    stockout_items.sort(
        key=lambda x: (
            risk_rank.get(x.risk_level, 99),
            x.days_until_stockout if x.days_until_stockout is not None else 999.0,
            x.days_of_supply,
        )
    )
    return stockout_items


def get_expiry_risks(
    db: Session,
    hospital_id: str,
    surge_multiplier: float = 1.0,
) -> list[ExpiryRiskItem]:
    inventory_items = list_hospital_inventory(db, hospital_id, surge_multiplier)

    expiry_items = []
    for inv in inventory_items:
        for b in inv.batches:
            if b.potential_wastage > 0:
                exp_consump = round(inv.expected_daily_demand * max(0, b.days_to_expiry), 1)
                expiry_items.append(
                    ExpiryRiskItem(
                        hospital_id=hospital_id,
                        medicine_id=inv.medicine_id,
                        medicine_name=inv.medicine_name,
                        batch_id=b.id,
                        batch_number=b.batch_number,
                        quantity=b.quantity,
                        expiry_date=b.expiry_date,
                        days_to_expiry=b.days_to_expiry,
                        expected_consumption_before_expiry=exp_consump,
                        potential_wastage=b.potential_wastage,
                    )
                )

    # Sort by nearest expiry first
    expiry_items.sort(key=lambda x: (x.days_to_expiry, -x.potential_wastage))
    return expiry_items
