"""Seeded synthetic data generator — M2 (issue #5).

Correlated, reproducible world state for every downstream workstream.
Demand is a *function*, not noise::

    qty(f, m, t) = base_rate[m] x capacity_factor[f] x seasonality(t)
                   x weekly(t) x trend(t) x outbreak_mult(f, m, t) x noise

Everything derives from one ``numpy.random.Generator`` seeded by ``--seed``,
plus deterministic UUIDv5 ids, so the same seed always yields byte-identical
frames (parquet bytes may still vary by encoder version — hash the *frames*,
see :func:`frame_hash`, for the stability guarantee).

Tables / columns match ``project.md`` §12 exactly (see ``EXPECTED_COLUMNS``).
Output lives in ``data/generated/*.parquet`` — gitignored, regenerated with::

    uv run python scripts/generate_data.py

Unblocks: #9 (data load), #10 (validation), #13 (forecaster training data).
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_SEED = 42
DEFAULT_HISTORY_DAYS = 540  # 18 x 30 ≈ 18 months (project.md §35: 90–365+ days)
DEFAULT_END_DATE = date(2026, 9, 30)  # fixed (not "today") so reruns are identical
DEFAULT_N_FACILITIES = 20
DEFAULT_N_MEDICINES = 40

CREATED_AT = datetime(2026, 9, 30, 12, 0, 0, tzinfo=timezone.utc)

# Authoritative column order per project.md §12 (+ migrations).
EXPECTED_COLUMNS: dict[str, list[str]] = {
    "facilities": [
        "id",
        "name",
        "type",
        "address",
        "latitude",
        "longitude",
        "patient_capacity",
        "avg_daily_patient_load",
        "emergency_capacity",
        "created_at",
    ],
    "medicines": [
        "id",
        "name",
        "category",
        "unit",
        "criticality_level",
        "alternative_group",
        "created_at",
    ],
    "inventory_batches": [
        "id",
        "facility_id",
        "medicine_id",
        "batch_number",
        "quantity",
        "reserved_quantity",
        "received_date",
        "expiry_date",
        "created_at",
    ],
    "demand_history": [
        "id",
        "facility_id",
        "medicine_id",
        "date",
        "quantity_consumed",
        "patient_load",
        "emergency_cases",
        "outbreak_signal",
    ],
    "suppliers": [
        "id",
        "facility_id",
        "medicine_id",
        "lead_time_days",
        "minimum_order_quantity",
        "maximum_supply_quantity",
    ],
    "routes": [
        "id",
        "source_facility_id",
        "destination_facility_id",
        "distance_km",
        "transport_time_hours",
        "transport_capacity",
    ],
}

TABLES = tuple(EXPECTED_COLUMNS)

# (name, category, unit, criticality 1-5, alternative_group)
MEDICINE_CATALOG: list[tuple[str, str, str, int, str]] = [
    ("Amoxicillin 500mg capsule", "Antibiotics", "capsule", 4, "ALT-AMOX"),
    ("Azithromycin 500mg tablet", "Antibiotics", "tablet", 4, "ALT-MACROLIDE"),
    ("Ceftriaxone 1g injection", "Antibiotics", "vial", 5, "ALT-CEPH"),
    ("Ciprofloxacin 500mg tablet", "Antibiotics", "tablet", 3, "ALT-FLUORO"),
    ("Doxycycline 100mg capsule", "Antibiotics", "capsule", 3, "ALT-TETRA"),
    ("Metronidazole 400mg tablet", "Antibiotics", "tablet", 3, "ALT-NITRO"),
    ("Paracetamol 650mg tablet", "Analgesics", "tablet", 3, "ALT-ANALGESIC"),
    ("Ibuprofen 400mg tablet", "Analgesics", "tablet", 2, "ALT-NSAID"),
    ("Tramadol 50mg capsule", "Analgesics", "capsule", 4, "ALT-OPIOID"),
    ("Diclofenac gel 1%", "Analgesics", "tube", 1, "ALT-NSAID"),
    ("Insulin Glargine 100IU/mL", "Antidiabetics", "vial", 5, "ALT-INSULIN"),
    ("Metformin 500mg tablet", "Antidiabetics", "tablet", 4, "ALT-ORAL-DM"),
    ("Glimepiride 2mg tablet", "Antidiabetics", "tablet", 3, "ALT-ORAL-DM"),
    ("Amlodipine 5mg tablet", "Cardiovascular", "tablet", 4, "ALT-CCB"),
    ("Atorvastatin 20mg tablet", "Cardiovascular", "tablet", 4, "ALT-STATIN"),
    ("Losartan 50mg tablet", "Cardiovascular", "tablet", 3, "ALT-ARB"),
    ("Aspirin 75mg tablet", "Cardiovascular", "tablet", 4, "ALT-ANTIPLAT"),
    ("Furosemide 40mg tablet", "Cardiovascular", "tablet", 3, "ALT-DIURETIC"),
    ("Salbutamol inhaler 100mcg", "Respiratory", "inhaler", 4, "ALT-BRONCHO"),
    ("Budesonide inhaler 200mcg", "Respiratory", "inhaler", 3, "ALT-ICS"),
    ("Cetirizine 10mg tablet", "Respiratory", "tablet", 2, "ALT-ANTIHIST"),
    ("Prednisolone 10mg tablet", "Respiratory", "tablet", 3, "ALT-STEROID"),
    ("Ondansetron 4mg tablet", "Gastrointestinal", "tablet", 3, "ALT-ANTIEMETIC"),
    ("Omeprazole 20mg capsule", "Gastrointestinal", "capsule", 3, "ALT-PPI"),
    ("ORS sachet 21.8g", "Gastrointestinal", "sachet", 4, "ALT-REHYD"),
    ("Zinc dispersible 20mg tablet", "Gastrointestinal", "tablet", 2, "ALT-MICRO"),
    ("Normal Saline 500mL", "IV Fluids & Electrolytes", "bottle", 5, "ALT-CRYSTALLOID"),
    ("Ringer Lactate 500mL", "IV Fluids & Electrolytes", "bottle", 5, "ALT-CRYSTALLOID"),
    ("Dextrose 5% 500mL", "IV Fluids & Electrolytes", "bottle", 4, "ALT-CRYSTALLOID"),
    ("BCG vaccine", "Vaccines", "vial", 3, "ALT-VACCINE"),
    ("Tetanus Toxoid vaccine", "Vaccines", "vial", 4, "ALT-VACCINE"),
    ("Lidocaine 2% injection", "Anesthetics", "vial", 4, "ALT-LOCAL"),
    ("Propofol 1% injection", "Anesthetics", "vial", 5, "ALT-GENERAL"),
    ("Adrenaline 1mg/mL ampoule", "Emergency & Critical Care", "ampoule", 5, "ALT-VASO"),
    ("Norepinephrine 1mg/mL ampoule", "Emergency & Critical Care", "ampoule", 5, "ALT-VASO"),
    ("Hydrocortisone 100mg injection", "Emergency & Critical Care", "vial", 4, "ALT-STEROID"),
    ("Povidone-Iodine 10% solution", "Antiseptics", "bottle", 2, "ALT-ANTISEP"),
    ("Chlorhexidine 4% solution", "Antiseptics", "bottle", 2, "ALT-ANTISEP"),
    ("Ferrous Sulfate 200mg tablet", "Hematinics", "tablet", 2, "ALT-HEMA"),
    ("Oxytocin 10IU injection", "Maternal Health", "ampoule", 5, "ALT-UTERO"),
]

FACILITY_NAMES: list[tuple[str, str]] = [  # (name, type)
    ("St. Martha Tertiary Hospital", "Tertiary"),
    ("Bowring District Hospital", "District"),
    ("Jayanagar General Hospital", "District"),
    ("Yelahanka Community Hospital", "Community"),
    ("Peenya Community Hospital", "Community"),
    ("Whitefield District Hospital", "District"),
    ("Kengeri Community Hospital", "Community"),
    ("Hebbal General Hospital", "District"),
    ("Bommanahalli Community Hospital", "Community"),
    ("Rajajinagar Tertiary Hospital", "Tertiary"),
    ("Apollo Medical Shop - Kormangala", "Pharmacy"),
    ("MedPlus Pharmacy - HSR", "Pharmacy"),
    ("Jan Aushadhi Kendra - Peenya", "Pharmacy"),
    ("Fortis Medical Shop - Bannerghatta", "Pharmacy"),
    ("Namma Pharma - Electronic City", "Pharmacy"),
    ("Karnataka Central Distributor", "Distributor"),
    ("South Zone Pharma Distributor", "Distributor"),
    ("Nandi Distributors", "Distributor"),
    ("Biocon Pharma Manufacturer", "Manufacturer"),
    ("Cipla South Manufacturer", "Manufacturer"),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_rng(seed: int) -> np.random.Generator:
    """Single seeded RNG threading through the whole pipeline."""
    return np.random.default_rng(seed)


def deterministic_uuid(*parts: str) -> str:
    """Stable UUIDv5 from name parts — identical for the same seed + key."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "|".join(parts)))


def haversine_km(
    lat1: np.ndarray | float, lon1: np.ndarray | float,
    lat2: np.ndarray | float, lon2: np.ndarray | float,
) -> np.ndarray | float:
    """Great-circle distance in km."""
    r = 6371.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp = np.radians(np.asarray(lat2) - np.asarray(lat1))
    dl = np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def frame_hash(df: pd.DataFrame) -> str:
    """Stable sha256 over CSV-serialized frame (column order + values)."""
    payload = df.to_csv(index=False).encode()
    return hashlib.sha256(payload).hexdigest()


# ---------------------------------------------------------------------------
# Generators — one per §12 table
# ---------------------------------------------------------------------------


def generate_facilities(rng: np.random.Generator, seed: int) -> pd.DataFrame:
    """~20 facilities around Bengaluru, tiered sizes (hospitals → makers)."""
    n = min(DEFAULT_N_FACILITIES, len(FACILITY_NAMES))
    # Bengaluru centre + spread (~±55 km); jitter is seeded.
    lats = 12.9716 + rng.normal(0, 0.22, n)
    lons = 77.5946 + rng.normal(0, 0.22, n)

    rows = []
    for i in range(n):
        name, ftype = FACILITY_NAMES[i]
        if ftype == "Tertiary":
            cap = int(rng.integers(800, 1201))
        elif ftype == "District":
            cap = int(rng.integers(300, 601))
        elif ftype == "Community":
            cap = int(rng.integers(80, 201))
        elif ftype == "Pharmacy":
            cap = int(rng.integers(20, 61))
        elif ftype == "Distributor":
            cap = int(rng.integers(0, 21))
        else:  # Manufacturer
            cap = 0
        avg_load = int(round(cap * float(rng.uniform(0.55, 0.75)))) if cap else 0
        rows.append(
            {
                "id": deterministic_uuid(f"seed-{seed}", "facility", f"{i:03d}"),
                "name": name,
                "type": ftype,
                "address": f"{100 + i * 7}, {name.split(' - ')[-1]} Road, Bengaluru",
                "latitude": round(float(lats[i]), 6),
                "longitude": round(float(lons[i]), 6),
                "patient_capacity": cap,
                "avg_daily_patient_load": avg_load,
                # Emergency throughput ≈ 8–15% of daily load (0 for makers).
                "emergency_capacity": int(round(avg_load * float(rng.uniform(0.08, 0.15)))),
                "created_at": CREATED_AT,
            }
        )
    return pd.DataFrame(rows, columns=EXPECTED_COLUMNS["facilities"])


def generate_medicines(seed: int) -> pd.DataFrame:
    """~40 medicines — fixed catalog (deterministic by construction)."""
    rows = [
        {
            "id": deterministic_uuid(f"seed-{seed}", "medicine", f"{i:03d}"),
            "name": name,
            "category": cat,
            "unit": unit,
            "criticality_level": crit,
            "alternative_group": alt,
            "created_at": CREATED_AT,
        }
        for i, (name, cat, unit, crit, alt) in enumerate(MEDICINE_CATALOG)
    ]
    return pd.DataFrame(rows, columns=EXPECTED_COLUMNS["medicines"])


def define_outbreak_events(
    history_days: int, facility_lats: pd.Series, seed: int
) -> list[dict]:
    """Three embedded outbreak events (×1.5–2.5 demand, 2–6 weeks).

    Windows are fixed fractions of the timeline (30/62/82%) so reruns and
    different ``--days`` values keep comparable shape; the affected
    categories/regions/multipliers are the demo's outbreak signal (#5).
    """
    median_lat = float(facility_lats.median())
    north = [i for i, v in enumerate(facility_lats) if v >= median_lat]
    south = [i for i, v in enumerate(facility_lats) if v < median_lat]
    return [
        {
            "id": "EVT-OUTBREAK-RESP",
            "kind": "outbreak",
            "start_offset": int(0.30 * history_days),
            "duration_days": 35,  # 5 weeks
            "categories": ["Respiratory", "Antibiotics"],
            "facility_idx": north,
            "multiplier": 2.2,
        },
        {
            "id": "EVT-OUTBREAK-GI",
            "kind": "outbreak",
            "start_offset": int(0.62 * history_days),
            "duration_days": 21,  # 3 weeks
            "categories": ["Gastrointestinal", "IV Fluids & Electrolytes"],
            "facility_idx": south,
            "multiplier": 1.8,
        },
        {
            "id": "EVT-OUTBREAK-FEVER",
            "kind": "outbreak",
            "start_offset": int(0.82 * history_days),
            "duration_days": 14,  # 2 weeks
            "categories": ["Analgesics", "Antiseptics"],
            "facility_idx": list(range(len(facility_lats))),
            "multiplier": 1.6,
        },
        {
            "id": "EVT-SUPPLIER-DELAY",
            "kind": "supplier_delay",
            "start_offset": int(0.62 * history_days),
            "duration_days": 35,
            "categories": [],
            "facility_idx": [],
            "multiplier": None,
            "note": "lead time 5 → 12 days on affected supplier links",
        },
    ]


def generate_demand_history(
    facilities: pd.DataFrame,
    medicines: pd.DataFrame,
    rng: np.random.Generator,
    seed: int,
    start: date,
    history_days: int,
    events: list[dict],
) -> pd.DataFrame:
    """18 months of correlated daily demand per facility × medicine.

    ``qty = base_rate × capacity × seasonality × weekly × trend × outbreak
    × lognormal noise``; ``patient_load``/``emergency_cases`` move with the
    same drivers so the forecaster (#13) has real signal to learn.
    """
    n_fac, n_med = len(facilities), len(medicines)
    dates = [start + timedelta(days=d) for d in range(history_days)]
    day_of_year = np.array([d.timetuple().tm_yday for d in dates])
    weekday = np.array([d.weekday() for d in dates])
    month = np.array([d.month for d in dates])
    weekly = np.where(weekday < 5, 1.0, np.where(weekday == 5, 0.85, 0.75))
    winter = np.where(np.isin(month, [12, 1, 2]), 1.2, 1.0)

    mean_load = max(1.0, float(facilities["avg_daily_patient_load"].mean()))
    cap_factor = (facilities["avg_daily_patient_load"] / mean_load).clip(lower=0.15).to_numpy()
    # Non-care nodes (distributors/makers) still move units: proxy throughput.
    cap_factor = np.where(cap_factor < 0.2, 0.2, cap_factor)
    type_mult = np.where(
        facilities["type"].isin(["Distributor", "Manufacturer"]), 1.6, 1.0
    )

    # Per-medicine drivers (seeded once — stable across facilities).
    m_rng = np.random.default_rng(seed * 1000 + 7)
    base_rate = m_rng.uniform(2.0, 40.0, n_med)
    season_amp = m_rng.uniform(0.10, 0.30, n_med)
    season_phase = m_rng.uniform(0, 2 * np.pi, n_med)
    is_winter_cat = medicines["category"].isin(
        ["Respiratory", "Antibiotics", "Vaccines"]
    ).to_numpy()

    # Event lookup: (facility_idx, medicine_idx) -> outbreak multiplier array.
    med_cat = medicines["category"].to_numpy()
    outbreak_mult = np.ones((n_fac, n_med, history_days))
    outbreak_active = np.zeros((n_fac, n_med, history_days), dtype=bool)
    for ev in events:
        if ev["kind"] != "outbreak":
            continue
        s, e = ev["start_offset"], min(history_days, ev["start_offset"] + ev["duration_days"])
        cat_mask = np.isin(med_cat, ev["categories"])[None, :]
        fac_mask = np.zeros((n_fac, 1), dtype=bool)
        fac_mask[ev["facility_idx"], 0] = True
        hit = fac_mask & cat_mask  # (n_fac, n_med)
        outbreak_mult[:, :, s:e] = np.where(
            hit[:, :, None], ev["multiplier"], outbreak_mult[:, :, s:e]
        )
        outbreak_active[:, :, s:e] = outbreak_active[:, :, s:e] | hit[:, :, None]

    annual = 1 + season_amp[None, :, None] * np.sin(
        2 * np.pi * day_of_year[None, None, :] / 365.25 + season_phase[None, :, None]
    )
    winter_bump = np.where(is_winter_cat[None, :, None], winter[None, None, :], 1.0)
    slopes = rng.uniform(-0.0001, 0.0005, size=(n_fac, n_med))[:, :, None]
    trend = 1 + slopes * np.arange(history_days)[None, None, :]
    base = (
        base_rate[None, :, None]
        * cap_factor[:, None, None]
        * type_mult[:, None, None]
    )
    noise = rng.lognormal(mean=0.0, sigma=0.15, size=(n_fac, n_med, history_days))
    qty = np.clip(
        np.round(
            base * annual * winter_bump * weekly[None, None, :]
            * trend * outbreak_mult * noise
        ),
        0,
        None,
    ).astype(int)

    avg_load = facilities["avg_daily_patient_load"].to_numpy()[:, None]
    pload_noise = rng.normal(1.0, 0.10, size=(n_fac, history_days))
    active_any = outbreak_active.any(axis=1)  # (n_fac, days)
    patient_load = np.clip(
        np.round(
            np.maximum(avg_load, 8.0)
            * (0.85 + 0.3 * (annual.mean(axis=1) - 1 + 1))
            * weekly[None, :]
            * np.where(active_any, 1.3, 1.0)
            * pload_noise
        ),
        0,
        None,
    ).astype(int)
    emerg_rate = rng.uniform(0.05, 0.12, size=(n_fac,))[:, None]
    emergency_cases = np.clip(
        rng.poisson(np.maximum(patient_load * emerg_rate, 0.2)).astype(int)
        + np.where(active_any, rng.poisson(2.0, size=(n_fac, history_days)), 0),
        0,
        None,
    )

    fac_ids = facilities["id"].to_numpy()
    med_ids = medicines["id"].to_numpy()
    frames = []
    for fi in range(n_fac):
        for mi in range(n_med):
            frames.append(
                pd.DataFrame(
                    {
                        "id": [
                            deterministic_uuid(
                                f"seed-{seed}", "demand", f"{fi:03d}-{mi:03d}-{d:04d}"
                            )
                            for d in range(history_days)
                        ],
                        "facility_id": fac_ids[fi],
                        "medicine_id": med_ids[mi],
                        "date": pd.to_datetime(dates).date,
                        "quantity_consumed": qty[fi, mi, :],
                        "patient_load": patient_load[fi, :],
                        "emergency_cases": emergency_cases[fi, :],
                        "outbreak_signal": outbreak_active[fi, mi, :],
                    }
                )
            )
    return pd.concat(frames, ignore_index=True)[EXPECTED_COLUMNS["demand_history"]]


def generate_inventory_batches(
    facilities: pd.DataFrame,
    medicines: pd.DataFrame,
    demand_history: pd.DataFrame,
    rng: np.random.Generator,
    seed: int,
    end: date,
) -> pd.DataFrame:
    """2–4 batches per facility × medicine; expiry spread 10–180 days out.

    Stock levels scale with each pair's own mean daily demand so high-use
    SKUs hold more units (correlates with #14/#15 risk engines).
    """
    avg_use = (
        demand_history.groupby(["facility_id", "medicine_id"])["quantity_consumed"]
        .mean()
        .to_dict()
    )
    fac_ids = facilities["id"].to_numpy()
    med_ids = medicines["id"].to_numpy()
    rows = []
    for fi, fid in enumerate(fac_ids):
        for mi, mid in enumerate(med_ids):
            daily = max(1.0, float(avg_use.get((fid, mid), 5.0)))
            days_stock = float(rng.uniform(20, 90))
            total = max(10, int(round(daily * days_stock * float(rng.uniform(0.8, 1.2)))))
            n_batches = int(rng.integers(2, 5))
            splits = rng.dirichlet(np.ones(n_batches)) if n_batches > 1 else np.ones(1)
            for k in range(n_batches):
                qty = max(1, int(round(total * splits[k])))
                received = end - timedelta(days=int(rng.integers(0, 91)))
                expiry = end + timedelta(days=int(rng.integers(10, 181)))
                if expiry <= received:  # keep the invariant strict
                    expiry = received + timedelta(days=30)
                rows.append(
                    {
                        "id": deterministic_uuid(
                            f"seed-{seed}", "batch", f"{fi:03d}-{mi:03d}-{k:02d}"
                        ),
                        "facility_id": fid,
                        "medicine_id": mid,
                        "batch_number": f"B-{fi:02d}-{mi:02d}-{k:02d}",
                        "quantity": qty,
                        "reserved_quantity": int(round(qty * float(rng.uniform(0, 0.10)))),
                        "received_date": received,
                        "expiry_date": expiry,
                        "created_at": CREATED_AT,
                    }
                )
    return pd.DataFrame(rows, columns=EXPECTED_COLUMNS["inventory_batches"])


def generate_suppliers(
    facilities: pd.DataFrame,
    medicines: pd.DataFrame,
    rng: np.random.Generator,
    seed: int,
    events: list[dict],
) -> pd.DataFrame:
    """One link per facility × medicine; lead times 3–12 days.

    ~25% of links sit inside the supplier-delay event window and carry the
    delayed 10–12 day lead time (5 → 12 day story from #5).
    """
    delay_ids = set()
    for ev in events:
        if ev["kind"] == "supplier_delay":
            delay_ids.add(ev["id"])
    _ = delay_ids  # recorded in the manifest; links below carry the effect
    fac_ids = facilities["id"].to_numpy()
    med_ids = medicines["id"].to_numpy()
    rows = []
    for fi, fid in enumerate(fac_ids):
        for mi, mid in enumerate(med_ids):
            delayed = bool(rng.random() < 0.25)
            lead = (
                int(rng.integers(10, 13)) if delayed else int(rng.integers(3, 8))
            )
            moq = int(rng.integers(50, 501))
            rows.append(
                {
                    "id": deterministic_uuid(
                        f"seed-{seed}", "supplier", f"{fi:03d}-{mi:03d}"
                    ),
                    "facility_id": fid,
                    "medicine_id": mid,
                    "lead_time_days": lead,
                    "minimum_order_quantity": moq,
                    "maximum_supply_quantity": moq * int(rng.integers(5, 21)),
                }
            )
    return pd.DataFrame(rows, columns=EXPECTED_COLUMNS["suppliers"])


def generate_routes(
    facilities: pd.DataFrame, rng: np.random.Generator, seed: int
) -> pd.DataFrame:
    """All directed pairs; distance/time/capacity from lat/lon + jitter."""
    lats = facilities["latitude"].to_numpy()
    lons = facilities["longitude"].to_numpy()
    ids = facilities["id"].to_numpy()
    n = len(facilities)
    dist = np.asarray(haversine_km(lats[:, None], lons[:, None], lats[None, :], lons[None, :]))
    jitter = rng.uniform(0.9, 1.1, size=(n, n))
    dist = np.round(dist * jitter, 2)
    time_h = np.round(dist / 45.0 + 0.5 + rng.uniform(-0.2, 0.5, size=(n, n)), 2)
    cap = rng.integers(500, 5001, size=(n, n))
    rows = []
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            rows.append(
                {
                    "id": deterministic_uuid(
                        f"seed-{seed}", "route", f"{i:03d}-{j:03d}"
                    ),
                    "source_facility_id": ids[i],
                    "destination_facility_id": ids[j],
                    "distance_km": max(1.0, float(dist[i, j])),
                    "transport_time_hours": max(0.5, float(time_h[i, j])),
                    "transport_capacity": int(cap[i, j]),
                }
            )
    return pd.DataFrame(rows, columns=EXPECTED_COLUMNS["routes"])


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def generate_all(
    seed: int = DEFAULT_SEED,
    history_days: int = DEFAULT_HISTORY_DAYS,
    end: date = DEFAULT_END_DATE,
) -> tuple[dict[str, pd.DataFrame], dict]:
    """Full world state + event manifest. Pure function of (seed, days, end)."""
    rng = make_rng(seed)
    start = end - timedelta(days=history_days - 1)
    facilities = generate_facilities(rng, seed)
    medicines = generate_medicines(seed)
    events = define_outbreak_events(history_days, facilities["latitude"], seed)
    demand_history = generate_demand_history(
        facilities, medicines, rng, seed, start, history_days, events
    )
    inventory_batches = generate_inventory_batches(
        facilities, medicines, demand_history, rng, seed, end
    )
    suppliers = generate_suppliers(facilities, medicines, rng, seed, events)
    routes = generate_routes(facilities, rng, seed)
    tables = {
        "facilities": facilities,
        "medicines": medicines,
        "inventory_batches": inventory_batches,
        "demand_history": demand_history,
        "suppliers": suppliers,
        "routes": routes,
    }
    manifest = {
        "seed": seed,
        "history_days": history_days,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "events": events,
        "row_counts": {k: len(v) for k, v in tables.items()},
        "hashes": {k: frame_hash(v) for k, v in tables.items()},
    }
    return tables, manifest


def write_parquet(
    tables: dict[str, pd.DataFrame], manifest: dict, out_dir: str | Path
) -> dict:
    """Write ``<table>.parquet`` + ``_manifest.json`` (hashes included)."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, df in tables.items():
        df.to_parquet(out / f"{name}.parquet", index=False)
    with open(out / "_manifest.json", "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, default=str)
    return manifest


def validate_schema(tables: dict[str, pd.DataFrame]) -> list[str]:
    """Check frames against project.md §12 columns + core invariants."""
    errors: list[str] = []
    if set(tables) != set(TABLES):
        errors.append(f"tables mismatch: got {sorted(tables)}, want {sorted(TABLES)}")
    for name, want in EXPECTED_COLUMNS.items():
        if name not in tables:
            continue
        got = list(tables[name].columns)
        if got != want:
            errors.append(f"{name}: columns {got} != §12 {want}")
        if tables[name].empty:
            errors.append(f"{name}: empty")
        id_col = tables[name].iloc[:, 0]
        if id_col.duplicated().any():
            errors.append(f"{name}: duplicate ids")
    if not errors:
        dem = tables["demand_history"]
        out = dem[dem["outbreak_signal"]]
        if out.empty:
            errors.append("demand_history: no outbreak_signal rows")
        sup = tables["suppliers"]
        if not sup["lead_time_days"].between(3, 12).all():
            errors.append("suppliers: lead_time_days outside 3–12")
        inv = tables["inventory_batches"]
        if not (inv["expiry_date"] > inv["received_date"]).all():
            errors.append("inventory_batches: expiry_date <= received_date")
        rt = tables["routes"]
        if (rt["source_facility_id"] == rt["destination_facility_id"]).any():
            errors.append("routes: self-loop")
    return errors
