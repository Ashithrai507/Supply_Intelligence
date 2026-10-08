"""M2 data-generator tests (issue #5): §12 schema, determinism, outbreak signal."""

from datetime import date

import pandas as pd

from app.simulator.data import (
    EXPECTED_COLUMNS,
    define_outbreak_events,
    frame_hash,
    generate_all,
    generate_facilities,
    make_rng,
    validate_schema,
    write_parquet,
)

SEED = 42
END = date(2026, 9, 30)


def _small():
    tables, manifest = generate_all(seed=SEED, history_days=60, end=END)
    return tables, manifest


def test_tables_match_section_12_columns() -> None:
    tables, _ = _small()
    assert set(tables) == set(EXPECTED_COLUMNS)
    for name, want in EXPECTED_COLUMNS.items():
        assert list(tables[name].columns) == want, name
    assert validate_schema(tables) == []


def test_volumes_and_referential_integrity() -> None:
    tables, _ = _small()
    assert len(tables["facilities"]) == 20
    assert len(tables["medicines"]) == 40
    assert len(tables["demand_history"]) == 20 * 40 * 60
    assert len(tables["routes"]) == 20 * 19  # all directed pairs, no self-loops
    fac = set(tables["facilities"]["id"])
    med = set(tables["medicines"]["id"])
    assert set(tables["demand_history"]["facility_id"]) <= fac
    assert set(tables["demand_history"]["medicine_id"]) <= med
    assert set(tables["suppliers"]["facility_id"]) <= fac
    assert set(tables["inventory_batches"]["facility_id"]) <= fac


def test_same_seed_identical_output() -> None:
    t1, m1 = generate_all(seed=SEED, history_days=60, end=END)
    t2, m2 = generate_all(seed=SEED, history_days=60, end=END)
    for name in t1:
        assert frame_hash(t1[name]) == frame_hash(t2[name]), name
        pd.testing.assert_frame_equal(t1[name], t2[name])
    assert m1["hashes"] == m2["hashes"]


def test_different_seed_differs() -> None:
    t1, _ = generate_all(seed=SEED, history_days=60, end=END)
    t3, _ = generate_all(seed=123, history_days=60, end=END)
    assert frame_hash(t1["demand_history"]) != frame_hash(t3["demand_history"])


def test_outbreak_spikes_visible() -> None:
    tables, manifest = generate_all(seed=SEED, history_days=180, end=END)
    dem = tables["demand_history"]
    flagged = dem[dem["outbreak_signal"]]
    assert not flagged.empty
    ratio = flagged["quantity_consumed"].mean() / dem[~dem["outbreak_signal"]][
        "quantity_consumed"
    ].mean()
    assert ratio > 1.3, f"outbreak/baseline ratio {ratio:.2f} too low"
    kinds = [e["kind"] for e in manifest["events"]]
    assert kinds.count("outbreak") == 3 and "supplier_delay" in kinds


def test_supplier_delay_and_expiry_spread() -> None:
    tables, _ = _small()
    lead = tables["suppliers"]["lead_time_days"]
    assert lead.between(3, 12).all()
    assert (lead >= 10).any()  # delayed links (5 → 12 day story)
    inv = tables["inventory_batches"]
    assert (inv["expiry_date"] > inv["received_date"]).all()
    spread = (pd.to_datetime(inv["expiry_date"]) - pd.to_datetime(END)).dt.days
    assert spread.between(10, 180).all()


def test_define_outbreak_events_shape() -> None:
    fac = generate_facilities(make_rng(SEED), SEED)
    events = define_outbreak_events(540, fac["latitude"], SEED)
    for ev in events:
        if ev["kind"] == "outbreak":
            assert 14 <= ev["duration_days"] <= 42  # 2–6 weeks
            assert 1.5 <= ev["multiplier"] <= 2.5


def test_write_parquet_roundtrip(tmp_path) -> None:
    tables, manifest = _small()
    write_parquet(tables, manifest, tmp_path)
    for name in tables:
        assert (tmp_path / f"{name}.parquet").exists()
        back = pd.read_parquet(tmp_path / f"{name}.parquet")
        assert list(back.columns) == EXPECTED_COLUMNS[name]
        assert len(back) == len(tables[name])
    assert (tmp_path / "_manifest.json").exists()
