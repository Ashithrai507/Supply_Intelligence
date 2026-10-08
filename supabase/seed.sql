-- Seed: three demo roles (project.md §4) + one demo facility for the facility
-- manager. Passwords are demo-only (local Supabase Auth). Re-run safe.

-- demo facility (stable id so profiles.facility_id survives data reloads;
-- synthetic-data loader (#9) must upsert, not blind-truncate, this row)
insert into public.facilities (
  id, name, type, address, latitude, longitude,
  patient_capacity, avg_daily_patient_load, emergency_capacity
)
values (
  '00000000-0000-0000-0000-00000000fac1',
  'Seed Demo Hospital', 'District', '1 Demo Road',
  12.9716, 77.5946, 400, 260, 40
)
on conflict (id) do nothing;

-- demo auth users; the trigger (20261008090200) creates profiles and stamps
-- app_metadata.role / app_metadata.facility_id from raw_user_meta_data.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  x.email, crypt('demo-password-123', gen_salt('bf')),
  now(), '{}'::jsonb, x.meta, now(), now()
from (values
  ('00000000-0000-0000-0000-00000000adm1',
   'admin@demo.local',
   '{"role":"ADMIN"}'::jsonb),
  ('00000000-0000-0000-0000-00000000mgr1',
   'manager@demo.local',
   '{"role":"FACILITY_MANAGER","facility_id":"00000000-0000-0000-0000-00000000fac1"}'::jsonb),
  ('00000000-0000-0000-0000-00000000anl1',
   'analyst@demo.local',
   '{"role":"ANALYST"}'::jsonb)
) as x(id, email, meta)
on conflict (id) do nothing;

-- ensure profiles exist even if users predate the trigger
insert into public.profiles (id, role, facility_id)
select u.id,
       coalesce((u.raw_user_meta_data ->> 'role')::public.user_role, 'ANALYST'),
       nullif(u.raw_user_meta_data ->> 'facility_id', '')::uuid
from auth.users u
where u.email in ('admin@demo.local','manager@demo.local','analyst@demo.local')
on conflict (id) do nothing;
