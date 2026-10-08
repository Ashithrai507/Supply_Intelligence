-- RLS policies per project.md §11 — defense in depth for direct PostgREST access.
-- FastAPI connects with the service role (bypasses RLS) and enforces the same
-- role model in application code (§32). Tables written only by the backend
-- expose no insert/update policies (deny by default).

-- helper claims (JWT app_metadata stamped by the trigger in the next migration)
create or replace function public.jwt_role() returns text
language sql stable as $$
  select auth.jwt() -> 'app_metadata' ->> 'role'
$$;

create or replace function public.jwt_facility_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'facility_id', '')::uuid
$$;

-- facility-scoped tables that get read policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'facilities', 'inventory_batches', 'demand_history', 'suppliers',
    'routes', 'forecasts', 'risk_predictions', 'recommendations'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    -- ADMIN: full read
    execute format(
      'create policy admin_read_%I on public.%I for select to authenticated
         using (public.jwt_role() = ''ADMIN'')', t, t);

    -- ANALYST: read-only network-wide analytics
    execute format(
      'create policy analyst_read_%I on public.%I for select to authenticated
         using (public.jwt_role() = ''ANALYST'')', t, t);

    -- FACILITY_MANAGER: rows scoped to their own facility_id
    -- (facility_id column name varies for routes; scope on it when present)
    if t in ('facilities') then
      execute format(
        'create policy manager_read_%I on public.%I for select to authenticated
           using (public.jwt_role() = ''FACILITY_MANAGER''
                  and id = public.jwt_facility_id())', t, t);
    elsif t in ('routes') then
      execute format(
        'create policy manager_read_%I on public.%I for select to authenticated
           using (public.jwt_role() = ''FACILITY_MANAGER''
                  and (source_facility_id = public.jwt_facility_id()
                       or destination_facility_id = public.jwt_facility_id()))', t, t);
    else
      execute format(
        'create policy manager_read_%I on public.%I for select to authenticated
           using (public.jwt_role() = ''FACILITY_MANAGER''
                  and facility_id = public.jwt_facility_id())', t, t);
    end if;
  end loop;
end $$;

-- profiles: users read their own row; admins read all
alter table public.profiles enable row level security;
create policy profiles_self_read on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_admin_read on public.profiles
  for select to authenticated using (public.jwt_role() = 'ADMIN');
