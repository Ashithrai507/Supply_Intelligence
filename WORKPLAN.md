# Backend Work Plan — Phase 1 (Basic Structure First)

**Rule for this phase:** build and test the backend pipeline end-to-end with the API
contract; **no UI work** until the structure works (`curl` + tests are the acceptance bar).
Scope, architecture, and constraints are in [PLAN.md](PLAN.md); tech stack is in
[README.md](README.md#tech-stack).

**Stack (Phase 1):** Python 3.11 · FastAPI + Pydantic · LightGBM + pandas/NumPy/scikit-learn ·
OR-Tools (CBC/GLOP) · **Supabase** (managed PostgreSQL + PostGIS + Auth + RLS; schema via
Supabase CLI SQL migrations) · `supabase-py` + `psycopg` · pytest. Local services run via
`supabase start`; no self-managed database server.

## Team & ownership

| Owner | Workstream | Deliverables |
|---|---|---|
| **[Skanda02](https://github.com/Skanda02)** | **Integration / FastAPI lead** | Repo structure (`backend/app/…`), **Supabase setup** (`supabase/` config, SQL migrations, RLS policies, seed, auth), FastAPI app + router wiring, **frozen API contract** (`PLAN.md` §5) as Pydantic schemas, Supabase JWT verification + RBAC dependency, `simulator/` scenario knobs → world state orchestration, `metrics/` before/after KPI calculator, integration tests (pytest), mock JSON fixtures for later UI work |
| **[Manvitha1311](https://github.com/Manvitha1311)** | **Synthetic data** | `scripts/generate_data.py` + `simulator/data.py` (pandas/NumPy, seeded): `hospitals`, `medicines`, `inventory` (batch expiry), `demand_daily` (correlated: base rate × capacity × seasonality × outbreak events × noise), `suppliers`, `transport` tables → **loaded into Supabase PostgreSQL** (matching `project.md` §12) · ~20 hospitals × ~40 medicines, 18 months history · embedded outbreak + supplier-delay events · reproducible · schema validation + generator tests |
| **[hegdesrinivasm](https://github.com/hegdesrinivasm)** | **Forecasting & risk** | `features/` (lags 7/14/28, rolling stats, calendar, patient load, outbreak signal — pandas) · `models/` **LightGBM** quantile forecaster (q10/q50/q90), horizons 7/14/30 · `engines/stockout.py` days-to-stock-out via q50 walk + Monte-Carlo risk probability (uses supplier lead time) · **expiry engine** `engines/expiry.py`: `surplus = qty − expected_use_before_expiry` · model metrics with scikit-learn: MAE/RMSE/MAPE + stock-out Precision/Recall/F1/ROC-AUC |
| **[Ashithrai507](https://github.com/Ashithrai507)** | **Optimizer & priority** | `optimizer/` **OR-Tools** LP (CBC/GLOP): min transport cost + stock-out risk + expiry waste + unmet demand, s.t. stock, safety stock, expiry feasibility, transport capacity, lead time · `engines/priority.py` weighted score (40/25/15/10/10) + waterfall allocation · `explain/` deterministic reason cards (every number checkable) · solver tests (small hand-checkable instances) |

**Shared contract:** the JSON schemas Skanda02 freezes in hour 2 are binding — every
workstream returns/consumes those shapes. Interactions only through them.

## Build order (dependencies)

```
1. Skanda02: repo scaffold + Supabase (migrations/RLS/auth) + API contract + mocks  ← blocks nothing
2. Manvitha111: data generator (seeded) → Supabase                        ← blocks ML
3. hegdesrinivasm: features → forecaster → stockout/expiry               ← blocks optimizer inputs
4. Ashithrai507: optimizer + priority + explain                          ← can build on mock risk cards
5. Skanda02: wire pipeline → /api/state, /optimize, /metrics, integration tests
6. Then: copilot endpoint (last), then UI phase
```

Parallel-safe: 1 and 4 start immediately (Ashithrai507 develops against mock risk cards);
2 starts day one; 3 starts once `demand_daily` schema lands (day one, not generator-complete).

## Milestones

| # | Milestone | Done when |
|---|---|---|
| M1 | Scaffold + contract | `uv sync` works, `supabase start` up, migrations/RLS applied, empty endpoints return contract-shaped mocks, `curl /api/state` valid |
| M2 | Data | `uv run python scripts/generate_data.py` produces all tables and loads them into Supabase; tests pass; history shows visible outbreak spikes |
| M3 | Forecast + risk | Backtest metrics printed (MAE/RMSE/MAPE); stock-out engine returns days + probability for every hospital×medicine |
| M4 | Optimizer | `/api/redistribution/optimize` returns feasible transfers on normal scenario; every transfer has a reason card; OR-Tools LP solves < 1s |
| M5 | Integration | Full pipeline runs for all scenarios; `/api/metrics` shows computed before/after deltas; authenticated requests enforced; end-to-end test green |
| M6 | Phase gate | **UI phase begins** (per PLAN.md §6) |

## Definition of done (per workstream)

- Code in your own module — no edits outside your area without telling Skanda02
- Unit tests for your module, passing locally
- Endpoints/outputs match the frozen contract exactly
- Nothing invented: every KPI/number computed from the pipeline

## Explicitly out of scope (Phase 1)

React UI · Leaflet map · copilot drawer · animations · microservices · Supabase Edge
Functions · extra ML models. Supabase migrations/RLS and JWT verification **are** in Phase 1.
Copilot endpoint starts only after M5.
