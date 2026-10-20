import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { rememberCoupleWindow } from './background';
import { useSession } from './session';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  display_name: string | null;
  partner_nickname: string | null;
  snoozed_until: string | null;
}

export interface Couple {
  id: string;
  user_a_id: string;
  user_b_id: string;
  level_a: number;
  level_b: number;
  timezone: string;
  window_start: string;
  window_end: string;
  usage_threshold_min: number;
  silence_period_min: number;
  max_missions_per_night: number;
}

interface AccountState {
  profile: Profile | null;
  couple: Couple | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountState>({
  profile: null,
  couple: null,
  loading: true,
  refresh: async () => {},
});

/** The signed-in user's own profile and couple (RLS only ever returns their own rows). */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id;
  const [state, setState] = useState<Omit<AccountState, 'refresh'>>({
    profile: null,
    couple: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (userId) setState(await load(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    load(userId).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <AccountContext.Provider value={{ ...state, refresh }}>{children}</AccountContext.Provider>
  );
}

async function load(userId: string): Promise<Omit<AccountState, 'refresh'>> {
  const [profile, couple] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>(),
    supabase.from('couples').select('*').maybeSingle<Couple>(),
  ]);
  const c = couple.data;
  await rememberCoupleWindow(
    c ? { timezone: c.timezone, windowStart: c.window_start, windowEnd: c.window_end } : null,
  ).catch(() => {});
  return { profile: profile.data, couple: c, loading: false };
}

export function useAccount(): AccountState {
  return useContext(AccountContext);
}

export function isProfileComplete(profile: Profile | null): boolean {
  return !!profile?.display_name && !!profile.partner_nickname;
}
