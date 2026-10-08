# Implementation Plan — Medical Supply Early Warning & Redistribution Intelligence System

**Constraints:** 20 hours · 3 people · Hackathon (Singularity 2026) · LLM API key available

**Theme:** *Predict Before It Happens.* Other teams predict the problem — this system **decides what to do about it.**

---

## 1. Architecture (Approach A — approved)

Simulator-centric FastAPI monolith + React dashboard. Everything is a pure function of
`(base_data, scenario_knobs)`, so "normal", "outbreak", "supplier delay", and "combined
crisis" are the same pipeline re-run with different knobs — the before/after demo is free
once the pipeline works.

```
┌─────────────────────────────────────────────────────────┐
│  React dashboard (Vite, Tailwind, Recharts, Leaflet)    │
│  Command Center · Scenario toggle · Copilot drawer      │
└──────┬───────────────────────────────────────┬──────────┘
       │ supabase-js: auth + simple reads      │ REST/JSON
       ▼                                       │ Bearer JWT
┌─────────────────────────┐                    │
│  Supabase               │                    │
│  Auth · PostgreSQL      │                    │
│  + PostGIS · RLS        │                    │
└───────────┬─────────────┘                    │
            ▲ service role                     ▼
            │      ┌────────────────────────────────────────┐
            └──────┤  FastAPI monolith                      │
                   │  simulator/  knobs → full world state  │
                   │  features/   lag, rolling, seasonality │
                   │  models/     LightGBM q10/q50/q90      │
                   │  engines/    stockout · expiry · priority
                   │  optimizer/  OR-Tools LP redistribution│
                   │  explain/    deterministic reason cards│
                   │  copilot/    LLM (context-JSON grounded│
                   │  metrics/    before/after KPI calc     │
                   └────────────────────────────────────────┘
```

Supabase provides the managed PostgreSQL (+PostGIS), Auth, and RLS. The frontend uses it
directly only for auth/session and simple RLS-guarded reads; all business/AI logic goes through
FastAPI (verified Supabase JWT + service-role DB access).

**Anti-goals (YAGNI):** no microservices, no Supabase Edge Functions, no fancy animations, no
MIP (continuous LP solves in milliseconds), no more ML models than needed (one strong pipeline),
no clinical-accuracy claims (decision-support prototype only).

---

## 2. Data model (synthetic, seeded, correlated — not random)

Generated once by the data script, then loaded into **Supabase PostgreSQL** (PostGIS enabled).
Tables map to the authoritative schema in `project.md` §12; the generator runs locally and
`seed.sql` / a seed script populates the database.

| Table | Key fields | Notes |
|---|---|---|
| `hospitals` | id, name, lat/lon, patient_capacity, daily_load, type | ~20, tiered sizes |
| `medicines` | id, name, category, criticality (1–5), has_alternative | ~40 (insulin, antibiotics, paracetamol…) |
| `inventory` | hospital_id, medicine_id, batch_id, qty, expiry_date | batch-level, expiry spread 10–180 days |
| `demand_daily` | hospital_id, medicine_id, date, qty, patient_load, emergency_cases, outbreak_signal | 18 months; `qty = f(base_rate, capacity, seasonality, outbreak_events, noise)` |
| `suppliers` | medicine_id, lead_time_days, min_order, reliability | lead times 3–12 days |
| `transport` | from_id, to_id, distance_km, hours, capacity_units | derived from lat/lon + jitter |

Generator embeds **outbreak events** (demand ×1.5–2.5 for affected categories/regions,
2–6 weeks) and **supplier delay events** in history, so the model genuinely learns outbreak
signal and the demo scenario isn't a gimmick.

---

## 3. Intelligence chain (the score)

### 3.1 Demand forecasting (Feature #1)
- **Model:** one LightGBM regressor with quantile loss → q10 / q50 / q90.
- **Features:** lags (7/14/28), rolling means/std, day-of-week, month/season,
  patient_load, emergency_cases, outbreak_signal, hospital category, medicine criticality.
- **Horizons:** 7 / 14 / 30 days, reported per-hospital per-medicine.
- **Metrics shown:** MAE, RMSE, MAPE (never bare "94% accuracy").

### 3.2 Days-to-stock-out (Feature #2)
- Deterministic projection: walk q50 forecast against current stock until stock < 0.
- **Risk probability:** Monte-Carlo over q10/q50/q90 draws → P(stock-out within lead time).
- Risk card: current stock, predicted demand/day, supplier lead time, days-to-stock-out,
  risk level, **main reasons** (e.g., "demand +34%", "supplier delay +3 days").
- Classifier metrics: Precision, Recall, F1, ROC-AUC against simulated ground truth.

### 3.3 Expiry / wastage (Feature #3)
- Per batch: `surplus = qty − expected_use_before_expiry` (integrate q50 forecast to expiry).
- Output is a number, not a flag: "5,500 units are likely to expire unused."
- Surplus immediately feeds the redistribution optimizer as supply.

### 3.4 Redistribution optimizer (Feature #4 — biggest effort)
- **LP (OR-Tools, CBC/GLOP):**
  - **Minimize:** transport_cost + stockout_risk_penalty + expiry_waste + unmet_demand
  - **s.t.** available stock, hospital safety stock, expiry feasibility
    (transit time + remaining shelf life), transport capacity, lead time, demand requirements.
- Inputs span supply side (stock, surplus, expiry, safety stock), demand side (forecast,
  shortage, patient load, emergency), logistics (distance, time, capacity, lead time),
  criticality (importance, alternatives).
- **Explainability:** every transfer ships a deterministic reason card (no LLM):
  "✓ A runs out in 3.2 days ✓ B has 4,200 surplus ✓ batch expires in 21 days ✓ 18 km ✓
  C has 12 days of stock ✓ A has higher emergency demand." Judges can check the numbers.

### 3.5 Priority engine (Feature #5)
Transparent weighted score, displayed as weights:

```
Priority = 40% shortage severity + 25% emergency demand + 15% patient load
         + 10% lack of alternatives + 10% time-until-stockout
```

Used to allocate limited supply (waterfall) when multiple hospitals compete; every
allocation shows its score breakdown.

### 3.6 Anomaly detection
Simple, explainable z-score/rolling-residual detector on demand — feeds alerts and the
forecast features. No heavyweight model.

---

## 4. Scenario simulator & impact (the demo)

**Scenarios:** A normal · B outbreak (demand +70%) · C supplier delay (5→12 days) ·
D expiry crisis · E competing hospitals · **F combined crisis (final demo)**.

**Flow:** toggle scenario → whole pipeline recomputes → dashboard updates →
click **Optimize Redistribution** → transfer list appears.

**Impact simulator (computed, never invented):**

| KPI | Before AI | After optimization |
|---|---|---|
| Expected shortage (units) | X | Y |
| Expected wastage (units) | X | Y |
| Stock-out hospitals | X | Y |
| Unmet demand / stock-out events / expired inventory / transport km | | |

**Metrics:** forecast MAE/RMSE/MAPE · stock-out Precision/Recall/F1/ROC-AUC ·
operational deltas (unmet demand ↓, stock-out events ↓, expired inventory ↓, transport ↓).

---

## 5. API contract (frozen at hour 2 — frontend builds against mocks)

```
GET  /api/state?scenario=normal|outbreak|delay|crisis
     → { kpis, alerts[], risk_cards[] }
GET  /api/forecast/{hospital_id}/{medicine_id}?scenario=...
     → { history[], horizons: {d7[], d14[], d30[]}, quantiles }
POST /api/redistribution/optimize
     → { transfers[], before_kpis, after_kpis }
GET  /api/transfers/{id}/explain
     → { reasons[], numbers }        ← deterministic, no LLM
POST /api/copilot  { question, scenario }
     → { answer, citations[] }       ← LLM grounded on state JSON
GET  /api/network?scenario=...
     → { nodes[], edges[] }          ← map data
```

All FastAPI routes require `Authorization: Bearer <supabase-jwt>`; FastAPI verifies the
Supabase JWT and enforces the role (ADMIN / FACILITY_MANAGER / ANALYST). The frontend also
talks to Supabase Auth directly for login/session and to PostgREST for simple RLS-guarded reads.

**Copilot (bonus, ~10% of score):** Operations Copilot answering "which hospitals are at
highest risk next week?" / "why B → A?" from computed results JSON. Built **last**, only
if core is done. Deterministic reason cards are the primary explanation layer, so the demo
never depends on the LLM.

---

## 6. Dashboard — story in 5 seconds

1. **Header:** MEDICAL SUPPLY COMMAND CENTER — hospitals, medicines, critical shortages,
   expiry risks, recommended transfers.
2. **Scenario toggle** (Normal / Outbreak / Supplier delay / Combined crisis).
3. **Critical alerts** — 🔴 stock-out in N days, 🟠 expiry risk units.
4. **Recommended actions** — `B → A, 1,200 units, 18 km, reason: critical shortage`,
   expandable **WHY THIS ACTION** card.
5. **Forecast graph** — current → 7 / 14 / 30 days with quantile band.
6. **Network map** (Leaflet) — hospitals + transfer routes.
7. **Before / After impact panel.**
8. **Copilot drawer.**

---

## 7. Team split & 20-hour schedule

| Person | Owns |
|---|---|
| **P1 — Data/ML** | Synthetic generator → forecasting → stock-out & expiry engines → model metrics |
| **P2 — Backend/Optimizer** | Supabase setup (migrations, RLS, auth verification), FastAPI skeleton, OR-Tools LP optimizer, priority engine, scenario API, metrics, copilot endpoint |
| **P3 — Frontend/Demo** | React dashboard, map, scenario toggle, explainability cards, copilot drawer, demo script |

**Coordination rule:** freeze the API contract + JSON schemas at **hour 2**. P3 builds
against mock responses immediately; zero later coordination cost.

| Hours | Milestone |
|---|---|
| 0–2 | Architecture freeze, repo scaffold, **Supabase project + migrations/RLS**, API contract, data schema, mock JSON |
| 2–6 | Generator v1 · forecasting v1 · FastAPI with mocks · dashboard skeleton |
| 6–10 | Stock-out + expiry engines · optimizer v1 · dashboard main views |
| 10–14 | Scenario simulator · priority engine · before/after metrics · map |
| 14–17 | Copilot · explainability polish · uncertainty bands |
| 17–19 | End-to-end run of **Scenario F**; fix demo-path bugs only |
| 19–20 | Rehearse demo · backup screenshots/video · slides |

**Priority:** 🔴 must-have = dataset, forecasting, days-to-stock-out, expiry detection,
optimization, priority, explainable recommendations, working dashboard. 🟠 differentiators
= outbreak/delay simulation, before/after impact, map, uncertainty. 🟡 if time = copilot,
NL querying, what-if generation. ❌ never = animations, many models, generic chatbot,
microservices, Supabase Edge Functions.

---

## 8. Final demo script (Scenario F)

1. "It's Monday morning. An outbreak has increased demand for three medicines by 60%."
2. Toggle → **7 hospitals at shortage risk** with days-to-stock-out per medicine.
3. "We can prevent 6 of these 7 shortages." → click **Optimize Redistribution** →
   transfer list with distances and reasons.
4. **BEFORE:** 7 at risk, 9,200 units wasted → **AFTER:** 1 at risk, 2,700 units wasted.
5. Judge asks "Why B → A?" → copilot/reason card reads back the actual numbers.

## 9. Repo layout

```
backend/
  app/ (main.py, simulator/, features/, models/, engines/, optimizer/, explain/, copilot/, metrics/)
  tests/
frontend/
  src/ (pages/, components/, api/, hooks/, types/, mocks/)
supabase/
  config.toml
  migrations/   (schema + RLS — source of truth)
  seed.sql
data/generated/
docs/
scripts/  (generate_data.py, train.py, seed_db.py, run_pipeline.py)
```
