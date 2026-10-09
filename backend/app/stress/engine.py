"""MedResilience simulation engine: deterministic daily stock-balance model.

For each (hospital, medicine, day):
    closing = opening + receipts + incoming_transfers
              - demand_served - outgoing_transfers - expired
    unmet   = demand - demand_served            (tracked, never negative stock)

Respects lead times, transport availability, expiry (FIFO), safety minimums.
No randomness: identical inputs always reproduce identical outputs.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date, timedelta

import pandas as pd

# ---------------------------------------------------------------- inputs ---


@dataclass
class SimInput:
    """Everything the engine needs, loaded once per simulation."""

    hospitals: pd.DataFrame  # id, name
    medicines: pd.DataFrame  # id, name, category, criticality_level
    inventory: pd.DataFrame  # hospital_id, medicine_id, quantity, expiry_date
    demand_daily: pd.DataFrame  # hospital_id, medicine_id, daily_demand
    suppliers: pd.DataFrame  # source_id, medicine_id, lead_time_days, unit_price, minimum_order_quantity
    sources: pd.DataFrame  # source_id, name
    purchase_orders: pd.DataFrame  # hospital_id, source_id, medicine_id, expected_delivery_date, ordered_quantity, received_quantity, status
    routes: pd.DataFrame  # route_id, source_id, hospital_id, distance_km, transit_days, cost_per_unit


def deterministic_routes(supplier_medicines: pd.DataFrame, purchase_orders: pd.DataFrame) -> pd.DataFrame:
    """Synthesize transport routes (SIMULATED data): one route per
    (source, hospital) pair seen in purchase orders, plus fallback pairs from
    supplier coverage. Distance/transit derived from id hashes — stable."""
    pairs = purchase_orders[["source_id", "hospital_id"]].drop_duplicates()
    if pairs.empty:
        pairs = supplier_medicines[["source_id"]].drop_duplicates().assign(hospital_id="H01")
    rows = []
    for _, r in pairs.iterrows():
        h = int(hashlib.md5(f"{r['source_id']}->{r['hospital_id']}".encode()).hexdigest()[:8], 16)
        distance = 5 + (h % 56)  # 5–60 km
        transit = 1 + (h % 3)  # 1–3 days
        rows.append({
            "route_id": f"R-{r['source_id']}-{r['hospital_id']}",
            "source_id": r["source_id"],
            "hospital_id": r["hospital_id"],
            "distance_km": float(distance),
            "transit_days": transit,
            "cost_per_unit": round(0.05 * distance, 2),
        })
    return pd.DataFrame(rows)


# --------------------------------------------------------------- params ---


@dataclass
class Disruption:
    """One crisis event. Unset fields mean 'no disruption of that kind'."""

    kind: str  # supplier_shutdown | price_shock | route_disruption | demand_surge
    supplier_id: str | None = None
    medicine_ids: list[str] = field(default_factory=list)
    hospital_ids: list[str] = field(default_factory=list)
    route_ids: list[str] = field(default_factory=list)
    start_day: int = 0  # offset from simulation start
    duration_days: int = 7
    magnitude_pct: float = 0.0  # price +% | demand +% (surge)
    reroute_extra_days: int = 2
    reroute_extra_cost_per_unit: float = 0.0


@dataclass
class SimParams:
    horizon_days: int = 14
    start_date: date | None = None  # defaults to day after latest demand date
    disruptions: list[Disruption] = field(default_factory=list)
    safety_days: float = 2.0  # safety buffer in days of demand


def _active(params: SimParams, d: Disruption, day: int) -> bool:
    return d.start_day <= day < d.start_day + d.duration_days


def supplier_down(params: SimParams, supplier_id: str, day: int) -> bool:
    return any(
        d.kind == "supplier_shutdown" and d.supplier_id == supplier_id and _active(params, d, day)
        for d in params.disruptions
    )


def price_multiplier(params: SimParams, medicine_id: str, day: int) -> float:
    mult = 1.0
    for d in params.disruptions:
        if d.kind == "price_shock" and _active(params, d, day):
            if not d.medicine_ids or medicine_id in d.medicine_ids:
                mult *= 1.0 + d.magnitude_pct / 100.0
    return mult


def demand_multiplier(params: SimParams, hospital_id: str, medicine_id: str, day: int) -> float:
    mult = 1.0
    for d in params.disruptions:
        if d.kind == "demand_surge" and _active(params, d, day):
            if (not d.hospital_ids or hospital_id in d.hospital_ids) and (
                not d.medicine_ids or medicine_id in d.medicine_ids
            ):
                mult *= 1.0 + d.magnitude_pct / 100.0
    return mult


def route_disabled(params: SimParams, route_id: str, day: int) -> Disruption | None:
    for d in params.disruptions:
        if d.kind == "route_disruption" and _active(params, d, day):
            if not d.route_ids or route_id in d.route_ids:
                return d
    return None


# ----------------------------------------------------------------- run ----


@dataclass
class DayResult:
    hospital_id: str
    medicine_id: str
    day: int
    date: str
    opening: float
    receipts: float
    demand: float
    served: float
    unmet: float
    expired: float
    closing: float
    procurement_cost: float
    transport_cost: float


def simulate(data: SimInput, params: SimParams) -> pd.DataFrame:
    """Run the daily balance. Returns one row per (hospital, medicine, day)."""
    start = params.start_date or date.today()
    stock: dict[tuple[str, str], float] = {}
    for _, r in data.inventory.iterrows():
        key = (r["hospital_id"], r["medicine_id"])
        stock[key] = stock.get(key, 0.0) + float(r["quantity"])

    # Expiry schedule: (hospital, medicine) -> sorted list of (expiry_day_offset, qty).
    # Day offsets are relative to simulation start for determinism in tests.
    expiry: dict[tuple[str, str], list[list]] = {}
    for _, r in data.inventory.iterrows():
        key = (r["hospital_id"], r["medicine_id"])
        try:
            exp = date.fromisoformat(str(r["expiry_date"]))
            offset = (exp - start).days
        except ValueError:
            continue
        expiry.setdefault(key, []).append([offset, float(r["quantity"])])
    for batches in expiry.values():
        batches.sort()

    demand_lookup = {
        (r["hospital_id"], r["medicine_id"]): float(r["daily_demand"])
        for _, r in data.demand_daily.iterrows()
    }
    price_lookup = {
        (r["source_id"], r["medicine_id"]): (float(r["unit_price"]), int(r["lead_time_days"]))
        for _, r in data.suppliers.iterrows()
    }

    # Route lookup for source→hospital transit of receipts.
    route_lookup = {
        (r["source_id"], r["hospital_id"]): r for _, r in data.routes.iterrows()
    }
    po_source = {
        (r["hospital_id"], r["medicine_id"]): r["source_id"]
        for _, r in data.purchase_orders.iterrows()
    }

    # Purchase-order receipts by (hospital, medicine, day_offset).
    # Values: (qty, unit_price, unit_transport_cost incl. any reroute surcharge).
    receipts: dict[tuple[str, str, int], list[tuple[float, float, float]]] = {}
    for _, po in data.purchase_orders.iterrows():
        if str(po.get("status", "PENDING")).upper() not in ("PENDING", "PARTIALLY_RECEIVED", "ORDERED"):
            continue
        try:
            due = (date.fromisoformat(str(po["expected_delivery_date"])) - start).days
        except ValueError:
            continue
        if due < 0:
            due = 0
        qty = float(po["ordered_quantity"]) - float(po.get("received_quantity", 0) or 0)
        if qty <= 0:
            continue
        price, _ = price_lookup.get(
            (po["source_id"], po["medicine_id"]), (0.0, 7)
        )
        route = route_lookup.get((po["source_id"], po["hospital_id"]))
        unit_trans = float(route["cost_per_unit"]) if route is not None else 0.0
        receipts.setdefault((po["hospital_id"], po["medicine_id"], due), []).append((qty, price, unit_trans))

    pairs = sorted({(r["hospital_id"], r["medicine_id"]) for _, r in data.inventory.iterrows()})

    out: list[DayResult] = []
    for day in range(params.horizon_days):
        today = (start + timedelta(days=day)).isoformat()
        for hid, mid in pairs:
            opening = stock.get((hid, mid), 0.0)
            base_demand = demand_lookup.get((hid, mid), 0.0)
            demand = base_demand * demand_multiplier(params, hid, mid, day)

            # Receipts due today (supplier shutdown blocks them while active).
            rec_qty, proc_cost, trans_cost = 0.0, 0.0, 0.0
            for qty, price, unit_trans in receipts.get((hid, mid, day), []):
                src = po_source.get((hid, mid))
                if src and supplier_down(params, src, day):
                    continue  # shipment never leaves the shut supplier
                route = route_lookup.get((src, hid)) if src else None
                arrival = day
                if route is not None:
                    dis = route_disabled(params, route["route_id"], day)
                    if dis:
                        arrival = day + dis.reroute_extra_days
                        unit_trans = unit_trans + dis.reroute_extra_cost_per_unit
                if arrival != day:
                    receipts.setdefault((hid, mid, arrival), []).append((qty, price, unit_trans))
                    continue
                rec_qty += qty
                proc_cost += qty * price * price_multiplier(params, mid, day)
                trans_cost += qty * unit_trans

            available = opening + rec_qty
            served = min(available, demand)
            unmet = demand - served
            remaining = available - served

            # Expiry (FIFO): batches expiring today or earlier that outlive demand.
            expired = 0.0
            batches = expiry.get((hid, mid), [])
            while batches and batches[0][0] <= day and remaining > 0:
                exp_qty = min(batches[0][1], remaining)
                expired += exp_qty
                remaining -= exp_qty
                batches[0][1] -= exp_qty
                if batches[0][1] <= 0:
                    batches.pop(0)

            closing = max(0.0, remaining)
            stock[(hid, mid)] = closing
            out.append(DayResult(
                hospital_id=hid, medicine_id=mid, day=day, date=today,
                opening=round(opening, 2), receipts=round(rec_qty, 2),
                demand=round(demand, 2), served=round(served, 2),
                unmet=round(unmet, 2), expired=round(expired, 2),
                closing=round(closing, 2),
                procurement_cost=round(proc_cost, 2), transport_cost=round(trans_cost, 2),
            ))
    return pd.DataFrame([r.__dict__ for r in out])


def summarize(timeline: pd.DataFrame, data: SimInput, params: SimParams) -> dict:
    """Aggregate KPIs + per-pair stock-out info from a simulation timeline."""
    if timeline.empty:
        return {"total_unmet": 0.0, "shortage_pairs": 0, "procurement_cost": 0.0,
                "transport_cost": 0.0, "expired": 0.0, "pairs": []}
    crit = set(
        data.medicines[data.medicines["criticality_level"] == "CRITICAL"]["id"].tolist()
    )
    pairs = []
    for (hid, mid), grp in timeline.groupby(["hospital_id", "medicine_id"]):
        grp = grp.sort_values("day")
        unmet_total = float(grp["unmet"].sum())
        zero_days = grp[grp["closing"] <= 0]
        stockout_day = int(zero_days["day"].min()) if not zero_days.empty else None
        pairs.append({
            "hospital_id": hid, "medicine_id": mid,
            "unmet_demand": round(unmet_total, 2),
            "stockout_day": stockout_day,
            "closing": float(grp.iloc[-1]["closing"]),
            "critical": mid in crit,
            "shortage": unmet_total > 0,
        })
    return {
        "total_unmet": round(float(timeline["unmet"].sum()), 2),
        "shortage_pairs": sum(1 for p in pairs if p["shortage"]),
        "procurement_cost": round(float(timeline["procurement_cost"].sum()), 2),
        "transport_cost": round(float(timeline["transport_cost"].sum()), 2),
        "expired": round(float(timeline["expired"].sum()), 2),
        "pairs": pairs,
    }
