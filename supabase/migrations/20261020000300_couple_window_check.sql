-- The app "day" (nightly mission limit, "hoje não") starts at 05:00 local time, so the couple's
-- window may not include 05:00 (see packages/core/src/trigger.ts, validateSettings).
create function public.window_includes_day_boundary(p_start time, p_end time) returns boolean
  language sql immutable set search_path = '' as $$
  select case
    when p_start < p_end then p_start < '05:00' and p_end > '05:00'
    else p_start < '05:00' or p_end > '05:00'
  end
$$;

alter table public.couples
  add constraint couples_window_day_boundary
  check (not public.window_includes_day_boundary(window_start, window_end));
