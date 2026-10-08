"""Forecasting service wrapping LightGBM inference and historical demand retrieval."""

from sqlalchemy.orm import Session

from app.models.entities import DemandHistory, Medicine
from app.schemas.medpredict import ForecastPoint, ForecastResponse
from ml.forecaster import forecast_demand


def get_medicine_forecast(
    db: Session,
    hospital_id: str,
    medicine_id: str,
    horizon_days: int = 7,
    demand_surge_multiplier: float = 1.0,
    history_days: int = 14,
) -> ForecastResponse | None:
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        return None

    # 1. Run LightGBM forecast
    fc_result = forecast_demand(
        db=db,
        hospital_id=hospital_id,
        medicine_id=medicine_id,
        horizon_days=horizon_days,
        demand_surge_multiplier=demand_surge_multiplier,
    )

    # 2. Retrieve recent historical consumption
    hist_records = (
        db.query(DemandHistory)
        .filter(
            DemandHistory.hospital_id == hospital_id,
            DemandHistory.medicine_id == medicine_id,
        )
        .order_by(DemandHistory.date.desc())
        .limit(history_days)
        .all()
    )
    hist_records = sorted(hist_records, key=lambda r: r.date)
    historical_points = [
        ForecastPoint(date=r.date.isoformat(), predicted_demand=float(r.quantity_consumed))
        for r in hist_records
    ]

    forecast_points = [
        ForecastPoint(date=item["date"], predicted_demand=item["predicted_demand"])
        for item in fc_result["forecast"]
    ]

    return ForecastResponse(
        hospital_id=hospital_id,
        medicine_id=medicine_id,
        medicine_name=medicine.name,
        horizon_days=horizon_days,
        forecast=forecast_points,
        historical=historical_points,
        model=fc_result["model"],
        model_version=fc_result["model_version"],
        metrics=fc_result.get("metrics", {}),
        baseline_metrics=fc_result.get("baseline_metrics", {}),
    )
