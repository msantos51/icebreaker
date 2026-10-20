-- Mission delivery helpers.

-- Registers this device's Expo push token for the signed-in user. A device that switches accounts
-- moves its token to the new user, so a phone never receives the previous owner's missions.
create function public.register_push_token(p_token text, p_platform text) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Records a mission run, atomically re-checking the silence period. Two partners pressing
-- "Estamos aborrecidos" at the same time must result in a single mission: the couple row is
-- locked, so the second call sees the first run and returns null. Server-side only.
create function public.start_mission_run(
  p_couple_id uuid,
  p_mission_id text,
  p_role_a_user_id uuid,
  p_source public.trigger_source
) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  silence smallint;
  run_id uuid;
begin
  select c.silence_period_min into silence from public.couples c where c.id = p_couple_id for update;
  if not found then
    return null;
  end if;
  if exists (
    select 1 from public.mission_runs r
    where r.couple_id = p_couple_id and r.sent_at > now() - make_interval(mins => silence)
  ) then
    return null;
  end if;
  insert into public.mission_runs (couple_id, mission_id, source, role_a_user_id)
  values (p_couple_id, p_mission_id, p_source, p_role_a_user_id)
  returning id into run_id;
  return run_id;
end;
$$;

revoke execute on function public.start_mission_run(uuid, text, uuid, public.trigger_source)
  from public, anon, authenticated;
grant execute on function public.start_mission_run(uuid, text, uuid, public.trigger_source)
  to service_role;
