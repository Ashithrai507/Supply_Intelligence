# Medical Supply Intelligence Platform

## Software Requirements & Technical Architecture Specification

**Project:** AI-Powered Medical Supply Intelligence & Redistribution
Network\
**Target:** Deployable Web Application\
**Primary Goal:** Predict shortages, identify avoidable wastage, and
recommend feasible medical-supply redistribution before the problem
occurs.

------------------------------------------------------------------------

# 1. Product Definition

## 1.1 What Are We Building?

We are building a **deployable web application** that provides a
centralized, network-wide view of medical supplies across:

-   Hospitals
-   Medical shops/pharmacies
-   Distributors
-   Pharmaceutical manufacturers

The platform tracks:

-   Medicines
-   Batch-level inventory
-   Expiry dates
-   Historical consumption
-   Forecast demand
-   Supplier lead times
-   Transport constraints
-   Patient load
-   Emergency demand
-   Criticality
-   Alternative medicines

The system uses this information to answer:

> **What stock exists, where will it be needed, when will it be needed,
> what is likely to expire, and what action should be taken?**

------------------------------------------------------------------------

# 2. Core Product Principle

The application follows:

``` text
PREDICT
   ↓
UNDERSTAND
   ↓
OPTIMIZE
   ↓
RECOMMEND
   ↓
EXPLAIN
```

The complete operational flow is:

``` text
Supply Network
      ↓
Central Database
      ↓
Data Validation
      ↓
Demand Forecasting
      ↓
Demand Anomaly Detection
      ↓
Stock-out Prediction
      ↓
Expiry / Wastage Detection
      ↓
Usable Surplus Detection
      ↓
Supply Source Selection
      ↓
Criticality Prioritisation
      ↓
Redistribution Optimization
      ↓
Action Recommendations
      ↓
Web Dashboard
      ↓
AI Copilot
```

------------------------------------------------------------------------

# 3. Product Scope

## 3.1 Must Have

The deployed MVP must support:

-   Facility management
-   Medicine management
-   Batch-level inventory
-   Historical demand
-   Demand forecasting
-   Stock-out prediction
-   Expiry-risk detection
-   Usable-surplus calculation
-   Critical-supply prioritisation
-   Redistribution recommendations
-   Recommendation explanations
-   Dashboard visualization
-   Outbreak/what-if simulation
-   Persistent database
-   REST API
-   Production deployment

## 3.2 Strong Differentiators

-   Network-wide source selection
-   Supplier-vs-redistribution comparison
-   Batch-aware redistribution
-   Geographic route visualization
-   Before/after optimization metrics
-   Confidence intervals for forecasts
-   LLM-based operations copilot
-   Audit trail for recommendations

## 3.3 Non-Goals

The system is a decision-support platform.

It must not:

-   prescribe treatment,
-   determine clinical dosage,
-   replace medical professionals,
-   automatically execute physical stock transfers,
-   make unsupported medical claims.

------------------------------------------------------------------------

# 4. User Roles

The initial application can use three logical roles.

## 4.1 Administrator

Can:

-   View the complete network
-   View all facilities
-   Run forecasts
-   Run optimization
-   Run scenarios
-   Review recommendations
-   Accept/reject simulated recommendations

## 4.2 Facility Manager

Can:

-   View own facility
-   View inventory
-   View demand forecasts
-   View stock-out risk
-   View expiry risk
-   View incoming/outgoing recommendations

## 4.3 Analyst

Can:

-   View network analytics
-   Compare scenarios
-   Inspect forecasts
-   Review optimization metrics

For the hackathon, authentication can be simplified while maintaining
the role model in the backend.

------------------------------------------------------------------------

# 5. Deployable System Architecture

``` text
                         INTERNET
                            │
                            ▼
                ┌────────────────────────┐
                │       FRONTEND         │
                │ React + TypeScript     │
                │ Vite + Tailwind        │
                └───────┬────────┬───────┘
                        │        │
          @supabase-js  │        │ HTTPS (Bearer JWT)
                        ▼        ▼
        ┌────────────────────┐  ┌────────────────────────┐
        │      SUPABASE      │  │       FASTAPI          │
        │ Auth (JWT/session) │◄─┤      REST API          │
        │ PostgreSQL+PostGIS │  │  (verifies JWT, RBAC)  │
        │ RLS + PostgREST    │  └───────────┬────────────┘
        └─────────┬──────────┘              │
                  │              ┌──────────┼──────────┐
                  │              ▼          ▼          ▼
                  │       ML Services   Optimization  Scenario
                  │       (LightGBM)    (OR-Tools)    Engine
                  │              └──────────┼──────────┘
                  └─────────────────────────┤
                                            ▼
                                ┌────────────────────────┐
                                │     AI COPILOT         │
                                │ LLM + Tool Calling     │
                                └────────────────────────┘
```

**Supabase** provides the managed PostgreSQL database (with **PostGIS**), the
**Auth** layer that issues JWT sessions, database-level **Row Level Security**, and a
PostgREST API. The frontend uses Supabase directly only for authentication/session
management and simple RLS-guarded reads; every piece of business/AI logic routes through
**FastAPI**, which verifies the Supabase-issued JWT, enforces role-based authorization,
and accesses the database with the service role. There are **no Supabase Edge Functions**.

------------------------------------------------------------------------

# 6. Architectural Principle: Modular Monolith

The first deployment should **not** use microservices.

Use a modular FastAPI backend:

``` text
FastAPI
│
├── auth
├── facilities
├── medicines
├── inventory
├── demand
├── forecasting
├── anomaly
├── risk
├── expiry
├── prioritization
├── optimization
├── scenarios
├── recommendations
└── assistant
```

The `auth` module delegates authentication to **Supabase Auth** and verifies
Supabase-issued JWTs; role-based authorization remains enforced inside FastAPI on a
per-module basis. Database access uses the Supabase **service role** (which bypasses RLS),
so business logic is the single trusted writer.

This provides clean separation without deployment complexity.

If the system grows later, individual modules can become independent
services.

------------------------------------------------------------------------

# 7. Frontend Architecture

## Recommended Stack

``` text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
TanStack Query
React Hook Form
Zod
Recharts
React Leaflet / MapLibre
```

## Frontend Structure

``` text
frontend/
├── src/
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── pages/
│   │   ├── Dashboard/
│   │   ├── Facilities/
│   │   ├── Inventory/
│   │   ├── Forecasts/
│   │   ├── Risks/
│   │   ├── Redistribution/
│   │   ├── Scenarios/
│   │   └── Assistant/
│   │
│   ├── components/
│   │   ├── charts/
│   │   ├── maps/
│   │   ├── tables/
│   │   ├── alerts/
│   │   └── common/
│   │
│   ├── api/
│   ├── hooks/
│   ├── types/
│   └── utils/
│
└── package.json
```

------------------------------------------------------------------------

# 8. Frontend Routes

``` text
/
    Network Dashboard

/facilities
    Facility list

/facilities/:id
    Facility detail

/inventory
    Network inventory

/inventory/:medicineId
    Medicine/batch detail

/forecasts
    Demand forecasting

/risks
    Shortage + expiry risks

/redistribution
    Recommended transfers

/scenarios
    What-if simulations

/assistant
    AI Copilot
```

------------------------------------------------------------------------

# 9. Main Dashboard

The main dashboard should immediately answer:

### What is happening right now?

Show:

``` text
Total Facilities
Total Inventory
Critical Shortages
Expiry Risks
Potential Surplus
Recommended Transfers
Supplier Delays
```

Then show:

### Critical Alerts

``` text
Hospital A
Insulin
Stock-out in 3.7 days
```

### Expiry Alerts

``` text
Hospital B
Medicine X
4,300 potentially excess
Expiry in 20 days
```

### Recommended Actions

``` text
Hospital B → Hospital A
1,500 vials
ETA: 4 hours
```

------------------------------------------------------------------------

# 10. Backend Architecture

## Recommended Stack

``` text
Python 3.11+
FastAPI
Pydantic
SQLAlchemy
supabase-py
psycopg
Supabase PostgreSQL
PostGIS
```

Schema and migrations are owned by the **Supabase CLI** (§11); there is no separate
migration tool in the backend. The backend connects to the Supabase pooler and uses the
service role for privileged database access.

## Backend Structure

``` text
backend/
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── auth.py
│   │   ├── facilities.py
│   │   ├── medicines.py
│   │   ├── inventory.py
│   │   ├── demand.py
│   │   ├── forecasts.py
│   │   ├── risks.py
│   │   ├── redistribution.py
│   │   ├── scenarios.py
│   │   └── assistant.py
│   │
│   ├── models/
│   ├── schemas/
│   ├── repositories/
│   │
│   ├── services/
│   │   ├── inventory_service.py
│   │   ├── forecast_service.py
│   │   ├── risk_service.py
│   │   ├── expiry_service.py
│   │   ├── priority_service.py
│   │   ├── optimization_service.py
│   │   ├── scenario_service.py
│   │   └── assistant_service.py
│   │
│   └── core/
│       ├── config.py
│       ├── security.py
│       └── logging.py
│
├── ml/
│   ├── training/
│   ├── inference/
│   ├── preprocessing/
│   └── artifacts/
│
├── tests/
└── requirements.txt
```

------------------------------------------------------------------------

# 11. Database Architecture

## Recommended Database

**Supabase-managed PostgreSQL**, with **PostGIS** enabled.

Supabase provides the managed PostgreSQL database, the authentication layer, database-level
Row Level Security, and a PostgREST API. The schema and all RLS policies are versioned as
**Supabase CLI SQL migrations** under `supabase/migrations/`, which are the single source of
truth; SQLAlchemy models in the backend mirror them.

## Core Tables

``` text
users            (Supabase Auth: auth.users — managed by Supabase)
profiles         (application role + facility scoping, 1:1 with auth.users)
facilities
medicines
medicine_alternatives
inventory_batches
demand_history
suppliers
supplier_products
routes
forecasts
risk_predictions
recommendations
scenarios
scenario_results
audit_logs
```

## Row Level Security

RLS is enabled on the facility-scoped tables. Policies key off `auth.uid()` and the
JWT `app_metadata` claims (`role`, `facility_id`):

``` text
ADMIN              → full access to all facilities
FACILITY_MANAGER   → rows scoped to their own facility_id
ANALYST            → read-only network-wide analytics
```

FastAPI connects with the **service role** (bypassing RLS) and enforces the same role model
in application code; RLS protects direct frontend/PostgREST access as defense in depth.
Tables written only by the backend expose no PostgREST policies (deny by default).

------------------------------------------------------------------------

# 12. Core Database Schema

## profiles

``` text
id                     (references auth.users.id)
role                   (ADMIN | FACILITY_MANAGER | ANALYST)
facility_id            (nullable; required for FACILITY_MANAGER)
created_at
```

A trigger on `auth.users` creates a matching `profiles` row and stamps the `role` /
`facility_id` into the user's `app_metadata`, so both the FastAPI RBAC checks and the RLS
policies read the same claims.

## facilities

``` text
id
name
type
address
latitude
longitude
patient_capacity
avg_daily_patient_load
emergency_capacity
created_at
```

## medicines

``` text
id
name
category
unit
criticality_level
alternative_group
created_at
```

## inventory_batches

``` text
id
facility_id
medicine_id
batch_number
quantity
reserved_quantity
received_date
expiry_date
created_at
```

## demand_history

``` text
id
facility_id
medicine_id
date
quantity_consumed
patient_load
emergency_cases
outbreak_signal
```

## suppliers

``` text
id
facility_id
medicine_id
lead_time_days
minimum_order_quantity
maximum_supply_quantity
```

## routes

``` text
id
source_facility_id
destination_facility_id
distance_km
transport_time_hours
transport_capacity
```

## forecasts

``` text
id
facility_id
medicine_id
forecast_date
predicted_demand
lower_bound
upper_bound
model_version
created_at
```

## risk_predictions

``` text
id
facility_id
medicine_id
stockout_probability
days_until_stockout
expiry_risk
potential_wastage
risk_level
created_at
```

## recommendations

``` text
id
source_facility_id
destination_facility_id
medicine_id
batch_id
quantity
eta_hours
priority_score
reason
status
created_at
```

------------------------------------------------------------------------

# 13. API Design

The backend exposes REST APIs. Every endpoint except `GET /health` requires an
`Authorization: Bearer <supabase-jwt>` header; FastAPI verifies the Supabase JWT and
enforces the caller's role.

## Auth

``` http
GET /api/v1/auth/me
```

## Facilities

``` http
GET /api/v1/facilities
GET /api/v1/facilities/{id}
POST /api/v1/facilities
```

## Inventory

``` http
GET /api/v1/inventory
GET /api/v1/inventory/{facility_id}
POST /api/v1/inventory
```

## Demand

``` http
GET /api/v1/demand
POST /api/v1/demand
```

## Forecasting

``` http
POST /api/v1/forecasts/run
GET /api/v1/forecasts
GET /api/v1/forecasts/{facility_id}/{medicine_id}
```

## Risk

``` http
GET /api/v1/risks/stockout
GET /api/v1/risks/expiry
```

## Redistribution

``` http
POST /api/v1/redistribution/optimize
GET /api/v1/redistribution/recommendations
GET /api/v1/redistribution/recommendations/{id}
```

## Scenarios

``` http
POST /api/v1/scenarios
POST /api/v1/scenarios/{id}/run
GET /api/v1/scenarios/{id}
```

## Assistant

``` http
POST /api/v1/assistant/query
```

------------------------------------------------------------------------

# 14. ML Architecture

The ML pipeline is not a single model.

It consists of several components:

``` text
Historical Data
      ↓
Feature Engineering
      ↓
┌───────────────┬────────────────┐
│               │                │
▼               ▼                ▼
Forecasting   Anomaly        Risk Logic
Model         Detection
│               │                │
└───────────────┴────────────────┘
                ↓
        Inventory Simulation
                ↓
        Optimization Engine
```

------------------------------------------------------------------------

# 15. Demand Forecasting Model

## Recommended Model: LightGBM

LightGBM is the recommended primary model because it is:

-   fast,
-   strong on tabular data,
-   effective with engineered time-series features,
-   relatively easy to explain,
-   practical for a hackathon deployment.

## Features

``` text
lag_1
lag_7
lag_14
lag_28

rolling_mean_7
rolling_mean_14
rolling_mean_28

rolling_std_7
rolling_std_28

day_of_week
month
season

patient_load
emergency_cases
outbreak_signal

recent_growth_rate
facility_id
medicine_id
```

## Forecast Horizons

``` text
7 days
14 days
30 days
```

------------------------------------------------------------------------

# 16. Forecast Baseline

Always maintain a baseline:

``` text
7-day moving average
```

The project should compare:

``` text
Baseline
vs
LightGBM
```

using:

``` text
MAE
RMSE
MAPE
```

The final model should be selected based on validation performance, not
complexity.

------------------------------------------------------------------------

# 17. Demand Anomaly Detection

## Recommended Model

**Isolation Forest**

Use it to detect:

-   sudden demand increases,
-   abnormal consumption,
-   outbreak-like patterns.

Input features:

``` text
recent demand
demand growth
rolling mean
rolling standard deviation
patient-load change
emergency-case change
```

Output:

``` text
NORMAL
WARNING
ANOMALY
```

The anomaly signal should be fed back into the forecasting/risk
pipeline.

------------------------------------------------------------------------

# 18. Stock-out Prediction

Stock-out prediction should combine ML forecasts with deterministic
inventory simulation.

For each future day:

``` text
projected_stock(t+1)
=
projected_stock(t)
+ incoming_supply
- predicted_demand
```

Stop when:

``` text
projected_stock <= safety_stock
```

Output:

``` text
days_until_stockout
stockout_date
stockout_probability
risk_level
```

This is preferable to training a separate black-box model for stock-out
prediction because the result remains explainable.

------------------------------------------------------------------------

# 19. Expiry Risk Engine

For each inventory batch:

``` text
days_to_expiry
```

Calculate expected demand until expiry:

``` text
expected_consumption_before_expiry
```

Then:

``` text
potential_wastage =
max(
    0,
    current_quantity
    - expected_consumption_before_expiry
    - safety_stock
)
```

This identifies inventory that may become unusable without requiring an
arbitrary "expires soon" threshold.

------------------------------------------------------------------------

# 20. Usable Surplus

The central redistribution variable is:

``` text
usable_surplus =
available_stock
- forecast_demand_until_horizon
- safety_stock
```

Then apply constraints:

``` text
expiry
reserved_stock
transport_time
source minimum stock
```

Only stock classified as usable surplus can enter the redistribution
optimizer.

------------------------------------------------------------------------

# 21. Criticality / Priority Engine

When several facilities require the same limited medicine, calculate:

``` text
priority_score =
0.40 * shortage_severity
+ 0.25 * emergency_demand
+ 0.15 * patient_load
+ 0.10 * time_until_stockout
+ 0.10 * alternative_availability_factor
```

The weights must be configurable.

The dashboard should show the score components so the decision remains
transparent.

------------------------------------------------------------------------

# 22. Redistribution Optimization

## Recommended Technology

**Google OR-Tools**

The optimizer decides:

``` text
source
destination
medicine
batch
quantity
```

## Objective

Minimize:

``` text
stockout risk
+
expected wastage
+
transport cost/time
+
unmet critical demand
+
source disruption
```

## Constraints

``` text
source available stock
source safety stock
destination demand
destination capacity
batch expiry
transport capacity
transport time
supplier lead time
criticality
```

------------------------------------------------------------------------

# 23. Source Selection

For every shortage, candidate sources are:

``` text
Hospitals
Medical shops
Distributors
Manufacturers
```

Evaluate:

``` text
available quantity
usable surplus
expiry window
distance
transport time
supplier lead time
source risk
```

The system should compare immediate redistribution against future
supplier replenishment.

Example:

``` text
Hospital A needs stock in 3 days.

Hospital B:
surplus = 4,300
ETA = 4 hours

Manufacturer:
available = 20,000
lead time = 5 days

Preferred source:
Hospital B
```

------------------------------------------------------------------------

# 24. AI Copilot

The AI assistant sits above the analytics system.

Architecture:

``` text
User Question
     ↓
LLM
     ↓
Tool / Function Call
     ↓
FastAPI
     ↓
Analytics / Optimization
     ↓
Structured JSON
     ↓
LLM
     ↓
Explanation
```

The LLM should not independently invent inventory or recommendations.

## Supported Questions

``` text
Which hospitals are at highest shortage risk next week?

Which medicines are likely to expire?

Why are we transferring Medicine X from Hospital B?

What is the best source for Hospital A?

What happens if demand increases by 60%?

Which facilities have usable surplus?
```

------------------------------------------------------------------------

# 25. Scenario Engine

The web application should support controlled what-if scenarios.

Inputs:

``` text
demand multiplier
patient-load multiplier
emergency-case multiplier
outbreak signal
supplier delay
transport reduction
inventory adjustment
```

Pipeline:

``` text
Scenario
  ↓
Modify simulation state
  ↓
Forecast
  ↓
Stock-out risk
  ↓
Expiry risk
  ↓
Priority
  ↓
Optimization
  ↓
Compare against baseline
```

------------------------------------------------------------------------

# 26. Frontend Functional Requirements

The dashboard must provide:

## Network Overview

-   Total facilities
-   Total stock
-   Critical shortages
-   Expiry risks
-   Usable surplus
-   Recommended transfers
-   Supplier delays

## Shortage Intelligence

-   Medicine
-   Facility
-   Current stock
-   Forecast demand
-   Days until stock-out
-   Risk level

## Expiry Intelligence

-   Batch
-   Quantity
-   Expiry
-   Expected consumption
-   Potential wastage
-   Transfer candidate status

## Redistribution

-   Source
-   Destination
-   Medicine
-   Batch
-   Quantity
-   ETA
-   Priority
-   Explanation

## Scenario Simulation

-   Configure scenario
-   Run simulation
-   Compare before/after
-   View new recommendations

## AI Copilot

-   Natural-language queries
-   Recommendation explanations
-   Network summaries

------------------------------------------------------------------------

# 27. Deployment Architecture

The application must be deployable as a real web application.

Recommended initial deployment:

``` text
                    PUBLIC INTERNET
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   Frontend Hosting              Supabase Platform
   React Production Build        Auth + PostgreSQL
              │                  + PostGIS + RLS
              │ HTTPS                    ▲
              ▼                          │ (service role)
        FastAPI Backend ─────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
   ML      OR-Tools   Scenario
 Models    Optimizer   Engine
    └─────────┼─────────┘
              ▼
             LLM
```

The deployed stack is: **Supabase** (managed Postgres + PostGIS + Auth + RLS), the
**FastAPI** backend, and the **React** frontend served as a static production build.
No database server is provisioned or operated by the team.

------------------------------------------------------------------------

# 28. Containerization

Use Docker.

Recommended services:

``` text
frontend
backend
```

PostgreSQL is **not** a Compose service: it is provided by Supabase. For local
development, the full Supabase stack (Postgres + PostGIS + Auth + PostgREST) runs via the
Supabase CLI:

``` bash
supabase start
```

Optional:

``` text
redis
```

The local environment should be reproducible with:

``` bash
supabase start      # Supabase (Postgres + Auth + PostGIS)
docker compose up   # backend + frontend
```

The same application should be deployable to a cloud environment without
architectural changes (a hosted Supabase project replaces the local stack).

------------------------------------------------------------------------

# 29. Environment Configuration

Use environment variables.

Example:

``` text
# Frontend (Vite)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=

# Backend (FastAPI)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=
LLM_API_KEY=
CORS_ORIGINS=
ENVIRONMENT=
```

`DATABASE_URL` points at the Supabase pooler. `SUPABASE_JWT_SECRET` (or a JWKS URL for
asymmetric keys) is used to verify Supabase-issued tokens. The service role key is
backend-only and must never be exposed to the frontend.

Never commit secrets to Git.

Provide:

``` text
.env.example
```

------------------------------------------------------------------------

# 30. API and ML Separation

The ML pipeline should not be tightly coupled to the frontend.

Recommended:

``` text
Frontend
   ↓
REST API
   ↓
Forecast Service
   ↓
Model Artifact
```

Model artifacts should be versioned:

``` text
models/
    demand_lgbm_v1.joblib
```

Every forecast record should store:

``` text
model_version
created_at
```

This allows future model updates without losing traceability.

------------------------------------------------------------------------

# 31. Background Processing

For the hackathon MVP, expensive ML/optimization operations may be
triggered synchronously if execution is fast enough.

If processing becomes slow, introduce:

``` text
Redis
+
Celery / RQ
```

for:

-   forecast jobs,
-   optimization jobs,
-   scenario simulations.

Do not add a task queue unless required.

------------------------------------------------------------------------

# 32. Authentication and Authorization

Authentication is delegated to **Supabase Auth**:

``` text
Supabase Auth (email/password → JWT session)
Row Level Security (database-level access control)
Role-based authorization (enforced in FastAPI)
```

Roles:

``` text
ADMIN
FACILITY_MANAGER
ANALYST
```

Flow:

``` text
Frontend supabase.auth.signInWithPassword()
      ↓
Supabase issues JWT (sub, app_metadata.role, app_metadata.facility_id)
      ↓
Frontend calls FastAPI with Authorization: Bearer <jwt>
      ↓
FastAPI verifies the JWT and enforces RBAC
      ↓
FastAPI accesses the database with the service role
```

The `profiles` table mirrors `auth.users` and holds `role` + `facility_id`; a trigger keeps
the JWT `app_metadata` claims in sync so both FastAPI and RLS read the same values. For a
hackathon demo, a simplified login UI can be used while preserving this backend and
database authorization model.

------------------------------------------------------------------------

# 33. Observability

Minimum:

-   structured backend logging,
-   request IDs,
-   API error logging,
-   model execution timing,
-   optimization execution timing,
-   health endpoint.

Required endpoint:

``` http
GET /health
```

Response:

``` json
{
  "status": "ok",
  "database": "ok",
  "model": "ok"
}
```

------------------------------------------------------------------------

# 34. Testing Requirements

## Backend

Use:

``` text
pytest
```

Test:

-   inventory calculations,
-   forecast input validation,
-   stock-out calculations,
-   expiry calculations,
-   priority scoring,
-   optimizer constraints,
-   API responses.

## Frontend

Use:

``` text
Vitest
React Testing Library
```

Test:

-   dashboard components,
-   API loading states,
-   error states,
-   recommendation display,
-   scenario configuration.

## Integration

At minimum test:

``` text
Inventory
  ↓
Forecast
  ↓
Risk
  ↓
Optimization
  ↓
Recommendation API
```

------------------------------------------------------------------------

# 35. Data Requirements

The prototype can use synthetic data.

Synthetic data must be relational and realistic rather than randomly
generated.

Recommended scale:

``` text
10–100 hospitals
50–500 medical shops
5–20 manufacturers/distributors
20–100 medicines
Multiple batches per medicine
90–365 days historical demand
```

The generator should create:

-   normal demand,
-   seasonality,
-   demand spikes,
-   outbreak scenarios,
-   supplier delays,
-   excess inventory,
-   near-expiry batches,
-   competing shortages.

------------------------------------------------------------------------

# 36. Demo Scenario

The final deployed application should demonstrate:

``` text
NORMAL NETWORK
      ↓
OUTBREAK TRIGGER
      ↓
Demand +60%
      ↓
Forecast updates
      ↓
Shortage risks increase
      ↓
Expiry risks detected
      ↓
Usable surplus identified
      ↓
Hospitals prioritised
      ↓
Redistribution optimized
      ↓
Recommendations generated
      ↓
Before vs After comparison
```

The final dashboard should show measurable impact:

``` text
Stock-out risks
Before → X
After  → Y

Potential wastage
Before → X
After  → Y

Unmet critical demand
Before → X
After  → Y
```

The numbers must be generated from the simulation.

------------------------------------------------------------------------

# 37. Technical Requirements Summary

## Mandatory

### Frontend

``` text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
TanStack Query
@supabase/supabase-js
```

### Backend

``` text
Python
FastAPI
Pydantic
SQLAlchemy
supabase-py
psycopg
```

### Database

``` text
Supabase PostgreSQL
PostGIS
Row Level Security
```

### Auth

``` text
Supabase Auth
Supabase CLI (local stack + migrations)
```

### ML

``` text
pandas
NumPy
scikit-learn
LightGBM
joblib
```

### Optimization

``` text
Google OR-Tools
```

### Deployment

``` text
Docker
Docker Compose
Git/GitHub
```

## Recommended

``` text
PostGIS
MapLibre / React Leaflet
Redis
MLflow
Celery/RQ
```

Use recommended components only when their value is clear.

------------------------------------------------------------------------

# 38. Suggested Final Technology Stack

  Layer             Technology                      Purpose
  ----------------- ------------------------------- ----------------------------
  Frontend          React + TypeScript              Web application
  Build             Vite                            Frontend build/development
  UI                Tailwind + shadcn/ui            Dashboard UI
  Data fetching     TanStack Query                  API state
  Charts            Recharts                        Analytics
  Maps              MapLibre / Leaflet              Network visualization
  Backend           FastAPI                         REST API
  ORM               SQLAlchemy                      Database access
  Validation        Pydantic                        API/data validation
  Database          Supabase PostgreSQL             Managed persistent storage
  Geo               PostGIS                         Geographic calculations
  Auth              Supabase Auth (+ RLS)           Authentication/authorization
  Schema            Supabase CLI migrations         Schema + RLS policies
  Forecast          LightGBM                        Demand prediction
  Anomaly           Isolation Forest                Demand spike detection
  Optimization      OR-Tools                        Redistribution
  ML utilities      pandas / NumPy / scikit-learn   Data/ML
  LLM               Tool-calling capable LLM        Copilot/explanations
  Containers        Docker                          Reproducible deployment
  Testing           pytest / Vitest                 Quality
  Version control   Git/GitHub                      Collaboration

------------------------------------------------------------------------

# 39. Engineering Priorities

Implementation should happen in this order:

## Phase 1 --- Foundation

``` text
Database
Backend
Frontend shell
Synthetic data generator
```

## Phase 2 --- Intelligence

``` text
Demand forecasting
Stock-out prediction
Expiry detection
Usable surplus
```

## Phase 3 --- Decision Engine

``` text
Priority scoring
Source selection
OR-Tools optimization
Recommendation explanations
```

## Phase 4 --- Product

``` text
Dashboard
Network map
Scenario simulator
```

## Phase 5 --- AI

``` text
LLM Copilot
Tool calling
Natural-language explanations
```

## Phase 6 --- Deployment

``` text
Docker
Production build
Database deployment
Backend deployment
Frontend deployment
Environment configuration
Health checks
```

------------------------------------------------------------------------

# 40. Definition of Done

The project is considered complete when a user can:

``` text
1. Open the deployed web application.
2. View the medical supply network.
3. Inspect inventory and batches.
4. View predicted demand.
5. See facilities at stock-out risk.
6. See inventory at expiry risk.
7. See usable surplus.
8. Run redistribution optimization.
9. Review recommended transfers.
10. Understand why a transfer was recommended.
11. Trigger an outbreak scenario.
12. Compare network status before and after optimization.
13. Ask the AI Copilot questions about the network.
```

The system should be demonstrable end-to-end without requiring
developers to run notebooks manually.

------------------------------------------------------------------------

# 41. Final Architecture Principle

The project should remain a **single deployable web product** with
modular internal services.

The core relationship is:

``` text
DATABASE
    ↓
ML
    ↓
RISK
    ↓
OPTIMIZATION
    ↓
API
    ↓
WEB APP
    ↓
AI COPILOT
```

The LLM is an interface to the intelligence layer, not the intelligence
layer itself.

The forecasting model predicts.

The risk engine interprets.

The optimizer decides the best feasible allocation.

The web application presents the decision.

The human operator remains in control.

------------------------------------------------------------------------

# 42. One-Line Project Definition

> **A deployable AI-powered web platform that predicts medical-supply
> shortages, detects expiry-bound surplus, and optimizes network-wide
> redistribution across hospitals and other supply nodes before
> shortages and wastage occur.**
