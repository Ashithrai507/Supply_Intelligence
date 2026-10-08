"""What-if demand surge simulation service."""


from sqlalchemy.orm import Session

from app.schemas.medpredict import SimulationComparison
from app.services.inventory_service import calculate_medicine_inventory


def run_demand_simulation(
    db: Session,
    hospital_id: str,
    medicine_id: str,
    demand_increase_pct: int = 40,
) -> SimulationComparison | None:
    multiplier = 1.0 + (demand_increase_pct / 100.0)

    # 1. Baseline calculation (multiplier = 1.0)
    baseline_inv = calculate_medicine_inventory(db, hospital_id, medicine_id, surge_multiplier=1.0)
    if not baseline_inv:
        return None

    # Baseline order recommendation calculation
    lead_time = baseline_inv.supplier_lead_time_days
    base_req = (baseline_inv.expected_daily_demand * lead_time) + (baseline_inv.expected_daily_demand * 2.0)
    base_deficit = base_req - baseline_inv.usable_inventory - baseline_inv.incoming_purchase_orders_quantity
    base_order = max(0, int(round(base_deficit)))

    # 2. Simulated calculation with surge multiplier
    sim_inv = calculate_medicine_inventory(db, hospital_id, medicine_id, surge_multiplier=multiplier)
    if not sim_inv:
        return None

    sim_req = (sim_inv.expected_daily_demand * lead_time) + (sim_inv.expected_daily_demand * 2.0)
    sim_deficit = sim_req - sim_inv.usable_inventory - sim_inv.incoming_purchase_orders_quantity
    sim_order = max(0, int(round(sim_deficit)))

    # Generate summary message
    stockout_shift = ""
    if baseline_inv.days_until_stockout and sim_inv.days_until_stockout:
        days_diff = round(baseline_inv.days_until_stockout - sim_inv.days_until_stockout, 1)
        stockout_shift = (
            f"Stockout window accelerates by {days_diff} days (from {baseline_inv.days_until_stockout}d to {sim_inv.days_until_stockout}d). "
        )

    order_diff = sim_order - base_order
    summary = (
        f"Under a +{demand_increase_pct}% demand surge, daily consumption jumps from {baseline_inv.expected_daily_demand} "
        f"to {sim_inv.expected_daily_demand} units/day. {stockout_shift}"
        f"Risk shifts from {baseline_inv.risk_level} to {sim_inv.risk_level}. "
        f"Procurement requirement increases by +{order_diff} units (recommended order: {sim_order} units)."
    )

    return SimulationComparison(
        baseline_stockout_date=baseline_inv.projected_stockout_date,
        baseline_days_until_stockout=baseline_inv.days_until_stockout,
        baseline_risk_level=baseline_inv.risk_level,
        baseline_recommended_order=base_order,
        baseline_daily_demand=baseline_inv.expected_daily_demand,
        simulated_stockout_date=sim_inv.projected_stockout_date,
        simulated_days_until_stockout=sim_inv.days_until_stockout,
        simulated_risk_level=sim_inv.risk_level,
        simulated_recommended_order=sim_order,
        simulated_daily_demand=sim_inv.expected_daily_demand,
        demand_increase_pct=demand_increase_pct,
        multiplier=multiplier,
        summary=summary,
    )
