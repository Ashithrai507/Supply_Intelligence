-- profiles bootstrap: trigger on auth.users creates the profiles row and
-- stamps role/facility_id into app_metadata so FastAPI RBAC (§32) and RLS
-- policies read the same claims (project.md §12 profiles).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
  requested_facility uuid;
begin
  -- role/facility come from signup metadata (seed + demo logins provide them)
  begin
    requested_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::public.user_role, 'ANALYST');
  exception when invalid_text_representation then
    requested_role := 'ANALYST';
  end;

  begin
    requested_facility := nullif(new.raw_user_meta_data ->> 'facility_id', '')::uuid;
  exception when invalid_text_representation then
    requested_facility := null;
  end;

  insert into public.profiles (id, role, facility_id)
  values (new.id, requested_role, requested_facility)
  on conflict (id) do update
    set role = excluded.role, facility_id = excluded.facility_id;

  -- stamp claims into app_metadata (read by JWT consumers + RLS helpers)
  new.app_metadata := coalesce(new.app_metadata, '{}'::jsonb) || jsonb_build_object(
    'role', requested_role,
    'facility_id', case when requested_facility is null
                        then null else requested_facility::text end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  before insert on auth.users
  for each row execute function public.handle_new_user();
