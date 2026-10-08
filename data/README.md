# Synthetic data — data-generating process (M2, issue #5)

Regenerate everything with one command (from the repo root):

```bash
uv run python scripts/generate_data.py
uv run python scripts/generate_data.py --seed 42 --days 540 --end-date 2026-09-30
```

Output: `data/generated/*.parquet` (gitignored) + `_manifest.json`
(seed, windows, row counts, sha256 per table). Same seed → identical frames.

## Implementation

- Library: `backend/app/simulator/data.py` (`generate_all(seed, days, end)`)
- CLI: `scripts/generate_data.py` (thin wrapper: generate → validate → write)
- Tests: `backend/tests/test_data_generator.py`

## Process (per facility × medicine × day)

```
qty = base_rate[m] × capacity_factor[f] × seasonality(t) × weekly(t)
      × trend(t) × outbreak_mult(f, m, t) × lognormal noise(σ=0.15)
```

| Driver | Detail |
|---|---|
| `base_rate[m]` | per-medicine daily base, U(2, 40) — antibiotics/IV fluids high |
| `capacity_factor[f]` | `avg_daily_patient_load / mean(load)`, floored; distributors/makers get a proxy throughput ×1.6 |
| `seasonality(t)` | annual sinusoid (amp 0.10–0.30 per medicine) + 1.2× winter bump (Dec–Feb) for Respiratory/Antibiotics/Vaccines |
| `weekly(t)` | 1.0 weekday, 0.85 Sat, 0.75 Sun |
| `trend(t)` | 1 + slope·t, slope U(−0.0001, 0.0005) — slight growth |
| `outbreak_mult` | 1.5–2.5 inside embedded events (below), else 1.0 |
| `patient_load` | tracks the same seasonal/weekly/outbreak drivers (+30% in outbreaks) + N(1, 0.1) |
| `emergency_cases` | Poisson(load × 0.05–0.12), +Poisson(2) bump in outbreaks |
| `outbreak_signal` | true inside an event window for affected category × region |

## Embedded history events (`_manifest.json → events`)

| ID | Window | Target | Effect |
|---|---|---|---|
| `EVT-OUTBREAK-RESP` | 30% mark, 35 days | Respiratory + Antibiotics, northern half | demand ×2.2 |
| `EVT-OUTBREAK-GI` | 62% mark, 21 days | Gastrointestinal + IV Fluids, southern half | demand ×1.8 |
| `EVT-OUTBREAK-FEVER` | 82% mark, 14 days | Analgesics + Antiseptics, all facilities | demand ×1.6 |
| `EVT-SUPPLIER-DELAY` | 62% mark, 35 days | ~25% of supplier links | lead time 5 → 10–12 days |

## Other tables

- **facilities** — 20 (10 hospitals, 5 pharmacies, 3 distributors, 2 makers) around Bengaluru; tiered `patient_capacity` (Tertiary 800–1200 … Pharmacy 20–60).
- **medicines** — fixed 40-row catalog (name, category, unit, criticality 1–5, alternative group).
- **inventory_batches** — 2–4 batches per facility×medicine; `quantity` ∝ that pair's mean daily use × 20–90 days; `received_date` within 90 days before end; `expiry_date` = end + U(10, 180) days.
- **suppliers** — full facility×medicine grid; baseline lead U(3, 7), delayed links U(10, 12); MOQ U(50, 500), max = MOQ × 5–20.
- **routes** — all directed pairs (380); haversine distance + ±10% jitter; `time = dist/45 + 0.5h`; capacity U(500, 5000).

All ids are deterministic UUIDv5(`seed | table | key`); `created_at` is a fixed
timestamp so reruns are byte-comparable at the frame level.
