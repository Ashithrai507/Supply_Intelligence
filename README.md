# Supply Intelligence — Medical Supply Early Warning & Redistribution Intelligence System

> **Predict before it happens.** A decision-support prototype that forecasts hospital
> medical supply demand, predicts stock-outs and wastage, and **decides what to do about
> them** — with an explainable redistribution optimizer, a priority engine, and a
> before/after impact simulator.

Built for **Singularity 2026 Hackathon** (20-hour build). See **[PLAN.md](PLAN.md)** for
the full implementation plan and **[WORKPLAN.md](WORKPLAN.md)** for the Phase 1 backend
work split between team members.

## The chain judges see

```
Hospital Data
     ↓
Inventory + Demand + Expiry + Suppliers
     ↓
       AI/ML Layer
 ┌─────┼─────────┬─────────┐
 ↓     ↓         ↓         ↓
Demand Stock-out Expiry   Anomaly
Forecast  Risk    Risk    Detection
 └─────┬─────────┴─────────┘
       ↓
Redistribution Optimizer (LP)
       ↓
Priority Engine
       ↓
Recommended Actions (with explanations)
       ↓
Dashboard + AI Operations Copilot
```

## Features

| # | Feature | What it produces |
|---|---------|------------------|
| 1 | **Multi-horizon demand forecasting** | 7/14/30-day forecasts per hospital×medicine (LightGBM, quantile q10/q50/q90) with seasonality, patient load, and outbreak signals |
| 2 | **Stock-out prediction** | *Days until stock-out* (e.g. "🔴 runs out in 5.8 days"), risk probability, and main reasons (demand ↑34%, supplier delay +3 days) |
| 3 | **Expiry/wastage intelligence** | A number, not a flag: "5,500 units likely to expire unused" → feeds redistribution |
| 4 | **Redistribution optimizer** | OR-Tools linear program minimizing transport + stock-out risk + wastage + unmet demand, subject to stock, safety-stock, expiry, capacity, and lead-time constraints |
| 5 | **Priority engine** | Transparent weighted score: 40% shortage severity, 25% emergency demand, 15% patient load, 10% lack of alternatives, 10% time-until-stockout |
| 6 | **Explainability** | Deterministic "WHY THIS ACTION" cards for every transfer — every number checkable |
| 7 | **Scenario simulator** | Normal · Outbreak (+70% demand) · Supplier delay · Expiry crisis · Competing hospitals · **Combined crisis** |
| 8 | **Impact simulator** | Computed before/after: shortage, wastage, stock-out hospitals |
| 9 | **Dashboard** | Command center: KPIs, alerts, recommended actions, forecast graph, network map |
| 10 | **AI Operations Copilot** *(bonus)* | LLM grounded on computed results: "Which hospitals are at highest risk next week?" |

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **Python 3.11+** | One language for data, ML, and API |
| API | **FastAPI** + Uvicorn + Pydantic | Typed contract, auto OpenAPI docs for the UI |
| ML / forecasting | **LightGBM** (quantile loss), pandas, NumPy, scikit-learn | Explainable, fast, handles mixed features + metrics |
| Optimization | **OR-Tools** (CBC/GLOP) | Simple LP modeling with a free solver |
| Database | **Supabase PostgreSQL** (+ **PostGIS**), schema via **Supabase CLI** migrations | Managed Postgres, geo support, no DB server to run |
| Auth | **Supabase Auth** (JWT) + **Row Level Security** | Managed auth/sessions; DB-level access control |
| Testing | **pytest** | Unit + integration tests per workstream |
| LLM | OpenAI-compatible API (copilot, built last) | Grounded on computed results JSON |
| Frontend *(Phase 2)* | **React + Vite + Tailwind CSS**, **Recharts**, **Leaflet**, `@supabase/supabase-js` | Fast dashboard, forecast charts, network map |
| Tooling | Git/GitHub, **uv** (Python env/deps), Ruff (lint) | Minimal, reproducible setup |

## Architecture

Target architecture: **React + TypeScript** → **Supabase** (Auth + PostgreSQL/PostGIS/RLS)
←→ **FastAPI** (ML, risk/expiry engines, OR-Tools optimizer, scenario engine, LLM copilot).
The frontend uses Supabase directly only for auth/session and simple RLS-guarded reads; all
business/AI logic goes through FastAPI. Modular monolith — no microservices, no Edge Functions.

- **`supabase/`** — Supabase config, **SQL migrations** (schema + RLS policies — source of
  truth), and `seed.sql` (roles, profiles, demo users).
- **`backend/`** — FastAPI monolith. Everything is a pure function of
  `(base_data, scenario_knobs)`, so every scenario re-runs the same pipeline.
  - `simulator/` scenario knobs → world state
  - `models/` LightGBM forecaster (q10/q50/q90)
  - `engines/` stock-out · expiry · priority
  - `optimizer/` OR-Tools LP redistribution
  - `explain/` deterministic reason cards
  - `copilot/` LLM endpoint (context-JSON grounded)
  - `metrics/` before/after KPI calculator
  - `core/security.py` Supabase JWT verification + RBAC
- **`frontend/`** — React (Vite, Tailwind, Recharts, Leaflet, `@supabase/supabase-js`):
  command center, scenario toggle, explainability cards, copilot drawer, Supabase auth/session.
- **`data/`** — seeded synthetic dataset with *correlated* variables (demand =
  f(base rate, capacity, seasonality, outbreak events, noise)), ~20 hospitals × ~40
  medicines, 18 months of history with embedded outbreak and supplier-delay events, loaded
  into **Supabase PostgreSQL**.

## Data model

`hospitals` · `medicines` · `inventory` (batch-level expiry) · `demand_daily`
(patient load, emergency cases, outbreak signal) · `suppliers` (lead times) ·
`transport` (distance, time, capacity) · `profiles` (role + facility scoping).

All tables live in **Supabase PostgreSQL** (PostGIS enabled) and are created by the Supabase
CLI SQL migrations in `supabase/migrations/`; RLS policies scope facility-level access.
See `project.md` §12 for the authoritative schema.

## Metrics

- **Forecasting:** MAE, RMSE, MAPE
- **Stock-out:** Precision, Recall, F1, ROC-AUC
- **Operations:** unmet demand ↓ · stock-out events ↓ · expired inventory ↓ · transport distance ↓

## Status

**Phase 1 (backend) planned** — see [WORKPLAN.md](WORKPLAN.md) for task ownership and
milestones M1–M6. Not yet implemented; starts with scaffold + Supabase (migrations/RLS/auth)
+ API contract (M1), then data generator → forecasting → optimizer → integration. UI begins at M6.

> Decision-support prototype for a hackathon demo. **Not a clinical system** — no
> medical accuracy claims.
