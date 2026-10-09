"""M1 tests: stock-balance math, disruptions, determinism (all hand-computed)."""

from datetime import date

import pandas as pd

from app.stress.engine import (
    Disruption,
    SimInput,
    SimParams,
    deterministic_routes,
    simulate,
    summarize,
)

START = date(2026, 10, 1)


def make_input(**overrides) -> SimInput:
    base = {
        "hospitals": pd.DataFrame([{"id": "H1", "name": "Hosp 1"}]),
        "medicines": pd.DataFrame(
            [{"id": "M1", "name": "Med 1", "category": "C", "criticality_level": "HIGH"}]
        ),
        "inventory": pd.DataFrame([{
            "hospital_id": "H1", "medicine_id": "M1",
            "quantity": 100, "expiry_date": "2027-01-01",
        }]),
        "demand_daily": pd.DataFrame(
            [{"hospital_id": "H1", "medicine_id": "M1", "daily_demand": 10.0}]
        ),
        "suppliers": pd.DataFrame([{
            "source_id": "S1", "medicine_id": "M1",
            "lead_time_days": 3, "unit_price": 5.0, "minimum_order_quantity": 10,
        }]),
        "sources": pd.DataFrame([{"source_id": "S1", "name": "Sup 1"}]),
        "purchase_orders": pd.DataFrame(
            columns=["hospital_id", "source_id", "medicine_id", "expected_delivery_date",
                     "ordered_quantity", "received_quantity", "status"]
        ),
        "routes": pd.DataFrame([{
            "route_id": "R-S1-H1", "source_id": "S1", "hospital_id": "H1",
            "distance_km": 10.0, "transit_days": 1, "cost_per_unit": 0.5,
        }]),
    }
    base.update(overrides)
    return SimInput(**base)


def params(**kw) -> SimParams:
    return SimParams(horizon_days=5, start_date=START, **kw)


def test_basic_balance_no_receipts():
    t = simulate(make_input(), params())
    assert t["closing"].tolist() == [90.0, 80.0, 70.0, 60.0, 50.0]
    assert t["unmet"].sum() == 0.0
    assert t["served"].tolist() == [10.0] * 5


def test_unmet_tracked_stock_never_negative():
    inv = pd.DataFrame([{
        "hospital_id": "H1", "medicine_id": "M1", "quantity": 5, "expiry_date": "2027-01-01",
    }])
    t = simulate(make_input(inventory=inv), params())
    assert t.iloc[0]["served"] == 5.0
    assert t.iloc[0]["unmet"] == 5.0
    assert (t["closing"] >= 0).all()


def test_receipt_arrives_and_costs():
    pos = pd.DataFrame([{
        "hospital_id": "H1", "source_id": "S1", "medicine_id": "M1",
        "expected_delivery_date": "2026-10-03", "ordered_quantity": 50,
        "received_quantity": 0, "status": "PENDING",
    }])
    t = simulate(make_input(purchase_orders=pos), params())
    assert t.iloc[2]["receipts"] == 50.0
    assert t.iloc[2]["procurement_cost"] == 250.0  # 50 × 5.0
    assert t.iloc[2]["transport_cost"] == 25.0  # 50 × 0.5
    assert t.iloc[2]["closing"] == 120.0  # 80 + 50 - 10


def test_supplier_shutdown_blocks_receipt():
    pos = pd.DataFrame([{
        "hospital_id": "H1", "source_id": "S1", "medicine_id": "M1",
        "expected_delivery_date": "2026-10-03", "ordered_quantity": 50,
        "received_quantity": 0, "status": "PENDING",
    }])
    dis = Disruption(kind="supplier_shutdown", supplier_id="S1", start_day=0, duration_days=5)
    t = simulate(make_input(purchase_orders=pos), params(disruptions=[dis]))
    assert t["receipts"].sum() == 0.0
    assert t["procurement_cost"].sum() == 0.0


def test_demand_surge_and_price_shock():
    surge = Disruption(kind="demand_surge", magnitude_pct=100.0, start_day=0, duration_days=5)
    t = simulate(make_input(), params(disruptions=[surge]))
    assert t["demand"].tolist() == [20.0] * 5
    assert t["closing"].tolist() == [80.0, 60.0, 40.0, 20.0, 0.0]

    pos = pd.DataFrame([{
        "hospital_id": "H1", "source_id": "S1", "medicine_id": "M1",
        "expected_delivery_date": "2026-10-02", "ordered_quantity": 10,
        "received_quantity": 0, "status": "PENDING",
    }])
    shock = Disruption(kind="price_shock", magnitude_pct=50.0, start_day=0, duration_days=5)
    t2 = simulate(make_input(purchase_orders=pos), params(disruptions=[shock]))
    assert t2.iloc[1]["procurement_cost"] == 75.0  # 10 × 5.0 × 1.5
    assert t2.iloc[1]["receipts"] == 10.0  # quantities unaffected


def test_route_disruption_delays_receipt():
    pos = pd.DataFrame([{
        "hospital_id": "H1", "source_id": "S1", "medicine_id": "M1",
        "expected_delivery_date": "2026-10-02", "ordered_quantity": 20,
        "received_quantity": 0, "status": "PENDING",
    }])
    dis = Disruption(kind="route_disruption", route_ids=["R-S1-H1"],
                     start_day=1, duration_days=1,
                     reroute_extra_days=2, reroute_extra_cost_per_unit=1.0)
    t = simulate(make_input(purchase_orders=pos), params(disruptions=[dis]))
    assert t.iloc[1]["receipts"] == 0.0  # delayed, not lost
    assert t.iloc[3]["receipts"] == 20.0
    assert t.iloc[3]["transport_cost"] == 20.0 * 1.5  # 0.5 + 1.0 reroute


def test_expiry_waste_never_negative():
    inv = pd.DataFrame([{
        "hospital_id": "H1", "medicine_id": "M1", "quantity": 100, "expiry_date": "2026-10-02",
    }])
    t = simulate(make_input(inventory=inv), params())
    # Day 0: serve 10 from 100 → 90 left; day 1 batch expires: 90-10=80 served... expiry takes remainder
    assert t["expired"].sum() > 0
    assert (t["closing"] >= 0).all()
    # Conservation: opening + receipts == served + unmet_served... check served+closing+expired == 100
    assert t["served"].sum() + t.iloc[-1]["closing"] + t["expired"].sum() == 100.0


def test_deterministic_routes_and_runs():
    sup = pd.DataFrame([{"source_id": "S1", "medicine_id": "M1"}])
    pos = pd.DataFrame([{"source_id": "S1", "hospital_id": "H1"}])
    r1 = deterministic_routes(sup, pos)
    r2 = deterministic_routes(sup, pos)
    pd.testing.assert_frame_equal(r1, r2)

    data = make_input()
    t1 = simulate(data, params())
    t2 = simulate(data, params())
    pd.testing.assert_frame_equal(t1, t2)


def test_summarize_kpis():
    inv = pd.DataFrame([{
        "hospital_id": "H1", "medicine_id": "M1", "quantity": 15, "expiry_date": "2027-01-01",
    }])
    t = simulate(make_input(inventory=inv), params())
    s = summarize(t, make_input(inventory=inv), params())
    assert s["shortage_pairs"] == 1
    assert s["total_unmet"] == 35.0  # (10-5... day0: 15-10=5 served... unmet days 1-4: 10*4=40? )
    assert s["pairs"][0]["stockout_day"] == 1
