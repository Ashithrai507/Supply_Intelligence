-- initial schema: all core tables per project.md §12 (authoritative)
-- applies from scratch via `supabase db reset`

-- PostGIS for geo (distance/time on routes; project.md §11)
create extension if not exists postgis with schema extensions;

-- roles (project.md §4, §32)
create type public.user_role as enum ('ADMIN', 'FACILITY_MANAGER', 'ANALYST');

-- ========== profiles (§12) ==========
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'ANALYST',
  facility_id uuid, -- required for FACILITY_MANAGER (enforced by app + RLS)
  created_at timestamptz not null default now()
);

-- ========== facilities (§12) ==========
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  address text,
  latitude double precision,
  longitude double precision,
  patient_capacity int not null default 0,
  avg_daily_patient_load int not null default 0,
  emergency_capacity int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_facility_fk
  foreign key (facility_id) references public.facilities (id) on delete set null;

-- ========== medicines (§12) ==========
create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit text not null,
  criticality_level int not null check (criticality_level between 1 and 5),
  alternative_group text,
  created_at timestamptz not null default now()
);

-- ========== inventory_batches (§12) ==========
create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  batch_number text not null,
  quantity int not null check (quantity >= 0),
  reserved_quantity int not null default 0 check (reserved_quantity >= 0),
  received_date date not null default current_date,
  expiry_date date not null,
  created_at timestamptz not null default now()
);

-- ========== demand_history (§12) ==========
create table public.demand_history (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  date date not null,
  quantity_consumed int not null check (quantity_consumed >= 0),
  patient_load int not null default 0,
  emergency_cases int not null default 0,
  outbreak_signal boolean not null default false
);

-- ========== suppliers (§12) ==========
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  lead_time_days int not null check (lead_time_days >= 0),
  minimum_order_quantity int not null default 0,
  maximum_supply_quantity int
);

-- ========== routes (§12) ==========
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  source_facility_id uuid not null references public.facilities (id) on delete cascade,
  destination_facility_id uuid not null references public.facilities (id) on delete cascade,
  distance_km double precision not null check (distance_km >= 0),
  transport_time_hours double precision not null check (transport_time_hours >= 0),
  transport_capacity int not null default 0,
  check (source_facility_id <> destination_facility_id)
);

-- ========== forecasts (§12) ==========
create table public.forecasts (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  forecast_date date not null,
  predicted_demand double precision not null,
  lower_bound double precision,
  upper_bound double precision,
  model_version text not null,
  created_at timestamptz not null default now()
);

-- ========== risk_predictions (§12) ==========
create table public.risk_predictions (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  stockout_probability double precision check (stockout_probability between 0 and 1),
  days_until_stockout double precision,
  expiry_risk double precision,
  potential_wastage int,
  risk_level text not null,
  created_at timestamptz not null default now()
);

-- ========== recommendations (§12) ==========
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  source_facility_id uuid not null references public.facilities (id) on delete cascade,
  destination_facility_id uuid not null references public.facilities (id) on delete cascade,
  medicine_id uuid not null references public.medicines (id) on delete restrict,
  batch_id uuid references public.inventory_batches (id) on delete set null,
  quantity int not null check (quantity > 0),
  eta_hours double precision,
  priority_score double precision,
  reason text,
  status text not null default 'proposed',
  created_at timestamptz not null default now()
);

-- ========== indexes (hot paths) ==========
create index idx_demand_history_fac_med_date
  on public.demand_history (facility_id, medicine_id, date);
create index idx_demand_history_date on public.demand_history (date);

create index idx_inventory_fac_med on public.inventory_batches (facility_id, medicine_id);
create index idx_inventory_expiry on public.inventory_batches (expiry_date);

create index idx_forecasts_fac_med_date
  on public.forecasts (facility_id, medicine_id, forecast_date);

create index idx_risk_fac_med on public.risk_predictions (facility_id, medicine_id);
create index idx_risk_created on public.risk_predictions (created_at desc);

create index idx_routes_source on public.routes (source_facility_id);
create index idx_routes_destination on public.routes (destination_facility_id);

create index idx_suppliers_fac_med on public.suppliers (facility_id, medicine_id);

create index idx_recommendations_status on public.recommendations (status, created_at desc);
create index idx_recommendations_source on public.recommendations (source_facility_id);
create index idx_recommendations_destination on public.recommendations (destination_facility_id);
