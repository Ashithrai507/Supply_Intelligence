"""Loader tests (issue #9) — FK order, reset safety, loud failures, verification.

No live database: psycopg is stubbed with fakes speaking the same
``cursor()/copy()/commit()/rollback()`` protocol the loader uses.
"""

from __future__ import annotations

import importlib.util
import re
from datetime import date
from pathlib import Path

import pytest

from app.repositories import loader as loader_mod
from app.repositories.loader import (
    LOAD_ORDER,
    RESET_DELETE_ORDER,
    SEED_DEMO_FACILITY_ID,
    LoaderError,
    copy_table,
    ensure_schema,
    expected_stats,
    load_all,
    read_tables,
    reset_tables,
    resolve_database_url,
    spot_check,
    verify_load,
)
from app.simulator.data import TABLES, generate_all

ROOT = Path(__file__).resolve().parents[2]
END = date(2026, 9, 30)


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class FakeCopy:
    def __init__(self) -> None:
        self.chunks: list[str] = []

    def __enter__(self) -> FakeCopy:
        return self

    def __exit__(self, *exc) -> bool:
        return False

    def write(self, data: str) -> None:
        self.chunks.append(data)


class FakeCursor:
    """Records statements; serves programmed stats/spot rows to fetchone()."""

    def __init__(self, stats: dict | None = None, spot: dict | None = None) -> None:
        self.executed: list[tuple[str, object]] = []
        self.copies: dict[str, FakeCopy] = {}
        self.stats = stats or {}
        self.spot = spot or {}
        self._sql = ""

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *exc) -> bool:
        return False

    def execute(self, sql: str, params: object = None) -> None:
        sql = sql if isinstance(sql, str) else str(sql)
        self.executed.append((sql, params))
        self._sql = sql

    def fetchone(self) -> tuple | None:
        if "WHERE facility_id" in self._sql:
            key = "demand" if "demand_history" in self._sql else "inventory"
            return self.spot[key]
        for table in TABLES:
            if f"FROM public.{table}" in self._sql:
                return self.stats[table]
        raise AssertionError(f"unexpected query: {self._sql}")

    def copy(self, sql: str) -> FakeCopy:
        sql = sql if isinstance(sql, str) else str(sql)
        table = re.search(r"COPY public\.(\w+)", sql).group(1)  # type: ignore[union-attr]
        cp = FakeCopy()
        self.copies[table] = cp
        return cp


class FakeConn:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cur = cursor
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self) -> FakeCursor:
        return self._cur

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        self.closed = True


def _small_tables():
    tables, _ = generate_all(seed=9, history_days=5, end=END)
    return tables


def _programmed_fake(tables, demand_spot=None, inventory_spot=None, stats_override=None):
    stats = {t: tuple(v) for t, v in expected_stats(tables).items()}
    if stats_override:
        stats.update(stats_override)
    fid = str(tables["facilities"]["id"].iloc[0])
    dem = tables["demand_history"]
    inv = tables["inventory_batches"]
    spot = {
        "demand": demand_spot
        or (
            int((dem["facility_id"] == fid).sum()),
            int(dem.loc[dem["facility_id"] == fid, "quantity_consumed"].sum()),
        ),
        "inventory": inventory_spot
        or (
            int((inv["facility_id"] == fid).sum()),
            int(inv.loc[inv["facility_id"] == fid, "quantity"].sum()),
        ),
    }
    cur = FakeCursor(stats=stats, spot=spot)
    return FakeConn(cur), cur


def _load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_load_order_parents_before_children() -> None:
    assert tuple(LOAD_ORDER) == (
        "facilities",
        "medicines",
        "inventory_batches",
        "demand_history",
        "suppliers",
        "routes",
    )
    assert tuple(RESET_DELETE_ORDER) == tuple(reversed(LOAD_ORDER))


def test_resolve_database_url_prefers_flag(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "env-url")
    assert resolve_database_url("flag-url") == "flag-url"
    assert resolve_database_url(None) == "env-url"
    monkeypatch.delenv("DATABASE_URL")
    with pytest.raises(LoaderError, match="no database URL"):
        resolve_database_url(None)


def test_read_tables_missing_files_raises(tmp_path) -> None:
    with pytest.raises(LoaderError, match="generate_data"):
        read_tables(tmp_path)


def test_schema_mismatch_fails_loudly() -> None:
    tables = _small_tables()
    tables["demand_history"] = tables["demand_history"].drop(columns=["outbreak_signal"])
    with pytest.raises(LoaderError, match="schema mismatch"):
        ensure_schema(tables)
    ensure_schema(_small_tables())  # good tables pass


def test_reset_preserves_seed_demo_row() -> None:
    conn, cur = _programmed_fake(_small_tables())
    reset_tables(conn)
    by_table = {sql.split("public.")[1].split()[0]: (sql, p) for sql, p in cur.executed}
    assert set(by_table) == set(TABLES)
    sql, params = by_table["facilities"]
    assert "<>" in sql and params == (SEED_DEMO_FACILITY_ID,)
    # children wiped before parents
    order = [sql.split("public.")[1].split()[0] for sql, _ in cur.executed]
    assert order.index("demand_history") < order.index("facilities")
    assert order.index("inventory_batches") < order.index("medicines")


def test_copy_table_writes_headerless_csv_in_section12_order() -> None:
    tables = _small_tables()
    conn, cur = _programmed_fake(tables)
    assert copy_table(conn, "medicines", tables["medicines"]) == 40
    payload = "".join(cur.copies["medicines"].chunks)
    assert len(payload.strip().splitlines()) == 40
    assert "criticality_level" not in payload  # no header row


def test_load_all_end_to_end_fake_db(tmp_path, monkeypatch) -> None:
    from app.simulator.data import write_parquet

    tables, manifest = generate_all(seed=9, history_days=5, end=END)
    write_parquet(tables, manifest, tmp_path)
    conn, cur = _programmed_fake(tables)
    monkeypatch.setattr(loader_mod, "connect", lambda url: conn)

    summary = load_all(tmp_path, "fake-url", reset=True)

    assert list(summary["rows"]) == list(LOAD_ORDER)
    assert summary["rows"]["demand_history"] == 20 * 40 * 5
    assert summary["reset"] is True
    assert summary["spot"]["demand_rows"] == 40 * 5  # one facility, 18-month shape
    assert conn.committed and conn.closed and not conn.rolled_back


def test_verify_fails_on_count_mismatch(tmp_path, monkeypatch) -> None:
    from app.simulator.data import write_parquet

    tables, manifest = generate_all(seed=9, history_days=5, end=END)
    write_parquet(tables, manifest, tmp_path)
    bad = list(expected_stats(tables)["demand_history"])
    bad[0] += 1
    conn, _ = _programmed_fake(tables, stats_override={"demand_history": tuple(bad)})
    monkeypatch.setattr(loader_mod, "connect", lambda url: conn)
    with pytest.raises(LoaderError, match="demand_history"):
        load_all(tmp_path, "fake-url", reset=True)
    assert conn.rolled_back and not conn.committed


def test_spot_check_mismatch_raises() -> None:
    tables = _small_tables()
    conn, _ = _programmed_fake(tables, demand_spot=(1, 1))
    with pytest.raises(LoaderError, match="spot check failed"):
        spot_check(conn, tables)
    conn_ok, _ = _programmed_fake(tables)
    assert verify_load(conn_ok, tables) and spot_check(conn_ok, tables)["demand_rows"] > 0


def test_cli_parsers_have_load_wiring() -> None:
    load_cli = _load_module("load_cli", "load_supabase.py")
    args = load_cli.parse_args([])
    assert args.reset is False
    assert load_cli.parse_args(["--reset"]).reset is True

    gen_cli = _load_module("gen_cli", "generate_data.py")
    g = gen_cli.parse_args([])
    assert g.load is False and g.load_reset is True
    assert gen_cli.parse_args(["--load", "--no-load-reset"]).load_reset is False
