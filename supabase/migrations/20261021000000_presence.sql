-- Phase 2: automatic trigger on Android.
--
-- presence holds only aggregated signals sent by each phone: a hash of the public IP (computed on
-- the server, the raw IP is never stored), minutes of continuous use and Do Not Disturb. Never app
-- names, per-app times or content. Not readable by clients: not even the partner can see it.

create table public.presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  public_ip_hash text not null,
  continuous_usage_min smallint not null check (continuous_usage_min between 0 and 1440),
  dnd boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.presence enable row level security;
-- No policies: written and read only by the heartbeat Edge Function (service role).
revoke all on public.presence from anon, authenticated;

-- Main metric: minutes both stayed off the phone after a mission. Each phone reports its own
-- number; the run keeps the lower one, since "off the phone" only lasts while neither picks it up.
alter table public.mission_runs
  add column offphone_minutes_role_a smallint check (offphone_minutes_role_a between 0 and 120),
  add column offphone_minutes_role_b smallint check (offphone_minutes_role_b between 0 and 120);

-- Records one partner's off-phone minutes for a run. Server-side only.
create function public.report_offphone_minutes(p_run_id uuid, p_user_id uuid, p_minutes smallint)
  returns boolean
  language plpgsql security definer set search_path = '' as $$
declare
  run public.mission_runs;
  is_role_a boolean;
begin
  select r.* into run from public.mission_runs r where r.id = p_run_id for update;
  if not found then
    return false;
  end if;
  select (p_user_id = run.role_a_user_id) into is_role_a
  from public.couples c
  where c.id = run.couple_id and p_user_id in (c.user_a_id, c.user_b_id);
  if is_role_a is null then
    return false;
  end if;

  if is_role_a then
    update public.mission_runs set offphone_minutes_role_a = p_minutes where id = p_run_id;
  else
    update public.mission_runs set offphone_minutes_role_b = p_minutes where id = p_run_id;
  end if;
  update public.mission_runs
  set offphone_minutes_after = least(offphone_minutes_role_a, offphone_minutes_role_b)
  where id = p_run_id
    and offphone_minutes_role_a is not null
    and offphone_minutes_role_b is not null;
  return true;
end;
$$;

revoke execute on function public.report_offphone_minutes(uuid, uuid, smallint)
  from public, anon, authenticated;
grant execute on function public.report_offphone_minutes(uuid, uuid, smallint) to service_role;
