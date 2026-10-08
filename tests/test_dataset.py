import csv
import os
import subprocess
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "scripts" / "generate_dataset.py"


def _read_csv(path):
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames or []
    return fieldnames, rows


def test_schema_and_counts():
    # Run generator
    out = tempfile.mkdtemp()
    res = subprocess.run(
        [sys.executable, str(GEN), "--out", out, "--seed", "42"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0, f"Generator failed: {res.stderr}\n{res.stdout}"

    # Read all files
    h_fields, h_rows = _read_csv(os.path.join(out, "hospitals.csv"))
    m_fields, m_rows = _read_csv(os.path.join(out, "medicines.csv"))
    i_fields, i_rows = _read_csv(os.path.join(out, "inventory.csv"))
    d_fields, d_rows = _read_csv(os.path.join(out, "demand_history.csv"))

    # Schemas
    assert h_fields == ["hospital_id", "name", "location", "patient_load", "emergency_load", "latitude", "longitude"]
    assert m_fields == ["medicine_id", "name", "category", "criticality", "alternative_available"]
    assert i_fields == ["hospital_id", "medicine_id", "current_quantity", "expiry_date", "supplier", "supplier_lead_time_days"]
    assert d_fields == ["hospital_id", "medicine_id", "date", "quantity_used"]

    # Counts
    assert len(h_rows) == 12
    assert len(m_rows) == 15
    assert len(i_rows) == 180
    assert len(d_rows) == 10800
