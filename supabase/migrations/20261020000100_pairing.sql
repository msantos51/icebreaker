-- Pairing: one partner creates a 6-character code (valid 15 minutes), the other redeems it.
-- Both happen through security-definer functions; clients cannot write to pairing_codes or couples.

-- No 0/O or 1/I, to avoid typos when the code is read aloud or typed.
create function public.random_pairing_code() returns text
  language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  result text := '';
begin
  for i in 0..5 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create function public.create_pairing_code() returns table (code text, expires_at timestamptz)
  language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.couples c where me in (c.user_a_id, c.user_b_id)) then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;

  delete from public.pairing_codes p where p.user_id = me or p.expires_at < now();
  loop
    begin
      return query
        insert into public.pairing_codes (code, user_id, expires_at)
        values (public.random_pairing_code(), me, now() + interval '15 minutes')
        returning pairing_codes.code, pairing_codes.expires_at;
      return;
    exception when unique_violation then
      -- Extremely unlikely collision with another active code: try again.
    end;
  end loop;
end;
$$;

create function public.redeem_pairing_code(p_code text) returns uuid
  language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  owner uuid;
  new_couple uuid;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select p.user_id into owner
  from public.pairing_codes p
  where p.code = upper(btrim(p_code)) and p.expires_at > now()
  for update;

  if owner is null then
    raise exception 'invalid_code' using errcode = 'P0001';
  end if;
  if owner = me then
    raise exception 'own_code' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.couples c
    where me in (c.user_a_id, c.user_b_id) or owner in (c.user_a_id, c.user_b_id)
  ) then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;

  insert into public.couples (user_a_id, user_b_id) values (owner, me) returning id into new_couple;
  delete from public.pairing_codes p where p.user_id in (owner, me);
  return new_couple;
end;
$$;

revoke execute on function public.random_pairing_code() from public, anon, authenticated;
revoke execute on function public.create_pairing_code() from public, anon;
revoke execute on function public.redeem_pairing_code(text) from public, anon;
grant execute on function public.create_pairing_code() to authenticated;
grant execute on function public.redeem_pairing_code(text) to authenticated;
