import type { Mission } from '@icebreaker/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { CoupleRow, MissionRepository, PresenceRow, ProfileRow } from './send-mission.ts';

/** How many past runs are considered when choosing the next mission. */
const HISTORY_LIMIT = 500;

/** MissionRepository backed by Supabase with the service role (bypasses RLS: server-side only). */
export function createSupabaseRepository(db: SupabaseClient): MissionRepository {
  return {
    async getCoupleForUser(userId) {
      const { data, error } = await db
        .from('couples')
        .select('*')
        .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
        .maybeSingle<CoupleRow>();
      if (error) throw error;
      return data;
    },

    async getProfiles(userIds) {
      const { data, error } = await db
        .from('profiles')
        .select('id, display_name, partner_nickname, snoozed_until')
        .in('id', userIds)
        .returns<ProfileRow[]>();
      if (error) throw error;
      return data;
    },

    async getRunHistory(coupleId) {
      const { data, error } = await db
        .from('mission_runs')
        .select('mission_id, sent_at')
        .eq('couple_id', coupleId)
        .order('sent_at', { ascending: false })
        .limit(HISTORY_LIMIT)
        .returns<{ mission_id: string; sent_at: string }[]>();
      if (error) throw error;
      return data.map((r) => ({ missionId: r.mission_id, sentAt: new Date(r.sent_at) }));
    },

    async getActiveMissions() {
      const { data, error } = await db
        .from('missions')
        .select('id, type, level, tags, message_a, message_b, follow_up')
        .eq('active', true)
        .returns<Mission[]>();
      if (error) throw error;
      return data;
    },

    async getPushTokens(userIds) {
      const { data, error } = await db
        .from('push_tokens')
        .select('user_id, token')
        .in('user_id', userIds)
        .returns<{ user_id: string; token: string }[]>();
      if (error) throw error;
      return data.map((r) => ({ userId: r.user_id, token: r.token }));
    },

    async getPresence(userIds) {
      const { data, error } = await db
        .from('presence')
        .select('user_id, public_ip_hash, continuous_usage_min, dnd, updated_at')
        .in('user_id', userIds)
        .returns<
          {
            user_id: string;
            public_ip_hash: string;
            continuous_usage_min: number;
            dnd: boolean;
            updated_at: string;
          }[]
        >();
      if (error) throw error;
      return data.map((r): PresenceRow => ({
        userId: r.user_id,
        publicIpHash: r.public_ip_hash,
        continuousUsageMin: r.continuous_usage_min,
        dnd: r.dnd,
        updatedAt: new Date(r.updated_at),
      }));
    },

    async startRun({ coupleId, missionId, roleAUserId, source }) {
      const { data, error } = await db.rpc('start_mission_run', {
        p_couple_id: coupleId,
        p_mission_id: missionId,
        p_role_a_user_id: roleAUserId,
        p_source: source,
      });
      if (error) throw error;
      return (data as string | null) ?? null;
    },

    async deletePushTokens(tokens) {
      const { error } = await db.from('push_tokens').delete().in('token', tokens);
      if (error) throw error;
    },
  };
}

/** Stores the latest aggregated signals from one phone (service role only). */
export async function upsertPresence(
  db: SupabaseClient,
  presence: { userId: string; publicIpHash: string; continuousUsageMin: number; dnd: boolean },
): Promise<void> {
  const { error } = await db.from('presence').upsert({
    user_id: presence.userId,
    public_ip_hash: presence.publicIpHash,
    continuous_usage_min: presence.continuousUsageMin,
    dnd: presence.dnd,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
