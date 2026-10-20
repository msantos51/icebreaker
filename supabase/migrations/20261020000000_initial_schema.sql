-- Initial schema for Phase 1 (manual trigger).
--
-- Privacy rules baked into the schema:
--   * A user's profile (including "hoje não") is only visible to that user, never to the partner.
--   * The mission catalogue and mission runs are not readable by clients at all: missions are only
--     delivered through push notifications, and there is no visible history.
--   * No phone-usage content is ever stored. Aggregated signals arrive in Phase 2 (`presence`).

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  -- How this user refers to the partner. Rendered into {parceiro} in this user's messages.
  partner_nickname text check (char_length(partner_nickname) between 1 and 40),
  -- "Hoje não": no missions for this user until this instant. Never exposed to the partner.
  snoozed_until timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles: owner can update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- couples
-- ---------------------------------------------------------------------------

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null unique references public.profiles (id) on delete cascade,
  user_b_id uuid not null unique references public.profiles (id) on delete cascade,
  paired_at timestamptz not null default now(),
  -- Opt-in per level: each partner picks the maximum level they accept; the couple gets the
  -- lower of the two, so provocative levels only apply when both turned them on.
  level_a smallint not null default 1 check (level_a between 1 and 3),
  level_b smallint not null default 1 check (level_b between 1 and 3),
  timezone text not null default 'Europe/Lisbon',
  window_start time not null default '19:00',
  window_end time not null default '23:30',
  usage_threshold_min smallint not null default 20 check (usage_threshold_min between 5 and 120),
  silence_period_min smallint not null default 60 check (silence_period_min between 15 and 240),
  max_missions_per_night smallint not null default 2 check (max_missions_per_night between 1 and 3),
  check (user_a_id <> user_b_id),
  check (window_start <> window_end)
);

-- A user can belong to at most one couple, in either slot.
create function public.ensure_single_couple() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.couples c
    where c.id <> new.id
      and (c.user_a_id in (new.user_a_id, new.user_b_id)
        or c.user_b_id in (new.user_a_id, new.user_b_id))
  ) then
    raise exception 'user already in a couple' using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

create trigger couples_single_couple
  before insert or update of user_a_id, user_b_id on public.couples
  for each row execute function public.ensure_single_couple();

-- Members may change shared settings, and only their own level. Identity columns are immutable.
create function public.guard_couple_update() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.user_a_id <> old.user_a_id or new.user_b_id <> old.user_b_id
     or new.paired_at <> old.paired_at then
    raise exception 'couple members cannot be changed' using errcode = 'check_violation';
  end if;
  if auth.uid() is not null then
    if new.level_a <> old.level_a and auth.uid() <> old.user_a_id then
      raise exception 'only the partner can change their own level' using errcode = 'check_violation';
    end if;
    if new.level_b <> old.level_b and auth.uid() <> old.user_b_id then
      raise exception 'only the partner can change their own level' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger couples_guard_update
  before update on public.couples
  for each row execute function public.guard_couple_update();

alter table public.couples enable row level security;

create policy "couples: members can read" on public.couples
  for select to authenticated using (auth.uid() in (user_a_id, user_b_id));

create policy "couples: members can update settings" on public.couples
  for update to authenticated
  using (auth.uid() in (user_a_id, user_b_id))
  with check (auth.uid() in (user_a_id, user_b_id));

-- Unpairing: either member can delete the couple; its history is deleted in cascade.
create policy "couples: members can unpair" on public.couples
  for delete to authenticated using (auth.uid() in (user_a_id, user_b_id));

-- ---------------------------------------------------------------------------
-- pairing_codes: created and redeemed only through RPCs (see the pairing migration)
-- ---------------------------------------------------------------------------

create table public.pairing_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  expires_at timestamptz not null
);

alter table public.pairing_codes enable row level security;

create policy "pairing_codes: owner can read" on public.pairing_codes
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- missions: catalogue, server-side only
-- ---------------------------------------------------------------------------

create type public.mission_type as enum (
  'actor_audience', 'secret_mission', 'opposing', 'coop', 'kindness', 'decision'
);

create table public.missions (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  type public.mission_type not null,
  level smallint not null check (level between 1 and 3),
  tags text[] not null default '{}',
  message_a text not null check (char_length(message_a) <= 200),
  message_b text not null check (char_length(message_b) <= 200),
  follow_up text not null check (char_length(follow_up) <= 200),
  active boolean not null default true
);

alter table public.missions enable row level security;
-- No policies: clients cannot read the catalogue (it would spoil the secret halves).

-- ---------------------------------------------------------------------------
-- mission_runs: one row per mission sent to a couple, server-side only
-- ---------------------------------------------------------------------------

create type public.trigger_source as enum ('manual', 'auto');

create table public.mission_runs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  mission_id text not null references public.missions (id),
  source public.trigger_source not null,
  -- Which partner received message_a (the other received message_b).
  role_a_user_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  accepted_a boolean,
  accepted_b boolean,
  skipped_by uuid references public.profiles (id) on delete set null,
  -- Phase 2: aggregated minutes both partners stayed off the phone after the mission.
  offphone_minutes_after smallint check (offphone_minutes_after >= 0)
);

create index mission_runs_couple_sent_at on public.mission_runs (couple_id, sent_at desc);

alter table public.mission_runs enable row level security;
-- No policies: there is no visible history.

-- ---------------------------------------------------------------------------
-- push_tokens: Expo push tokens per device
-- ---------------------------------------------------------------------------

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens: owner can read" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());

create policy "push_tokens: owner can insert" on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());

create policy "push_tokens: owner can update" on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "push_tokens: owner can delete" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (Supabase exposes tables to `authenticated`; RLS does the filtering)
-- ---------------------------------------------------------------------------

revoke all on public.missions, public.mission_runs from anon, authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert on public.couples from authenticated;
revoke insert, update, delete on public.pairing_codes from authenticated;
