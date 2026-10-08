"""Dashboard summary aggregation service."""


from sqlalchemy.orm import Session

from app.models.entities import Hospital, Medicine, PurchaseOrder
from app.schemas.medpredict import (
    DashboardKPIs,
    DashboardResponse,
    HospitalSchema,
)
from app.services.procurement_service import (
    generate_procurement_recommendations,
    generate_redistribution_suggestions,
)
from app.services.risk_service import get_expiry_risks, get_stockout_risks


def get_hospital_dashboard(
    db: Session,
    hospital_id: str,
    surge_multiplier: float = 1.0,
) -> DashboardResponse | None:
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        # Fallback to the first hospital if ID not found
        hospital = db.query(Hospital).first()
        if not hospital:
            return None
        hospital_id = hospital.id

    hosp_schema = HospitalSchema(
        id=hospital.id,
        name=hospital.name,
        city=hospital.city,
        bed_capacity=hospital.bed_capacity,
        avg_daily_patients=hospital.avg_daily_patients,
    )

    # 1. Risks & alerts
    stockout_risks = get_stockout_risks(db, hospital_id, surge_multiplier)
    expiry_risks = get_expiry_risks(db, hospital_id, surge_multiplier)

    # 2. Recommendations
    procurement_recs = generate_procurement_recommendations(db, hospital_id, surge_multiplier)
    redistribution = generate_redistribution_suggestions(db, hospital_id)

    # 3. Counts
    total_meds = db.query(Medicine).count()
    crit_count = sum(1 for r in stockout_risks if r.risk_level == "CRITICAL")
    high_count = sum(1 for r in stockout_risks if r.risk_level == "HIGH")
    exp_batches_count = len(expiry_risks)
    total_wastage_units = sum(e.potential_wastage for e in expiry_risks)

    pending_pos_count = (
        db.query(PurchaseOrder)
        .filter(
            PurchaseOrder.hospital_id == hospital_id,
            PurchaseOrder.status.in_(["PENDING", "ORDERED", "PARTIALLY_RECEIVED"]),
        )
        .count()
    )

    kpis = DashboardKPIs(
        total_medicines=total_meds,
        critical_stockout_risks=crit_count,
        high_stockout_risks=high_count,
        expiry_risk_batches=exp_batches_count,
        total_potential_wastage_units=total_wastage_units,
        pending_procurement_orders=pending_pos_count,
        total_recommended_orders=len(procurement_recs),
    )

    return DashboardResponse(
        hospital=hosp_schema,
        kpis=kpis,
        critical_alerts=stockout_risks[:5],
        expiry_alerts=expiry_risks[:5],
        top_recommendations=procurement_recs[:5],
        redistribution_suggestions=redistribution,
    )
