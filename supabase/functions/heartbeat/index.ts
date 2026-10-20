// Heartbeat from an Android phone, sent by a background task inside the couple's window.
// Stores only aggregated signals (hashed IP, continuous usage minutes, DND) and then evaluates the
// automatic trigger for the couple. The response never says whether a mission was sent by this
// heartbeat; it only returns the couple's latest mission (both partners received it) so the phone
// can measure how long it stayed down afterwards.

import { createClient } from '@supabase/supabase-js';

import { createExpoPushSender } from '../_shared/expo-push.ts';
import { authenticate, json, scheduleWithEdgeRuntime } from '../_shared/http.ts';
import { clientIp, hashIp, parseHeartbeat, runToMeasure } from '../_shared/presence.ts';
import { createSupabaseRepository, getLatestRun, upsertPresence } from '../_shared/repository.ts';
import { sendAutoMission } from '../_shared/send-mission.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
/** Secret for hashing IPs (`supabase secrets set PRESENCE_IP_SECRET=...`). */
const PRESENCE_IP_SECRET = Deno.env.get('PRESENCE_IP_SECRET')!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const userId = await authenticate(request, SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const input = parseHeartbeat(await request.json().catch(() => null));
  const ip = clientIp(request.headers);
  if (!input || !ip) return json({ error: 'bad_request' }, 400);

  await upsertPresence(admin, {
    userId,
    publicIpHash: await hashIp(ip, PRESENCE_IP_SECRET),
    continuousUsageMin: input.continuousUsageMin,
    dnd: input.dnd,
  });

  const repo = createSupabaseRepository(admin);
  const outcome = await sendAutoMission(userId, {
    repo,
    push: createExpoPushSender(EXPO_ACCESS_TOKEN),
    now: () => new Date(),
    schedule: scheduleWithEdgeRuntime,
  });
  console.log(JSON.stringify({ event: 'heartbeat', ...outcome }));

  const couple = await repo.getCoupleForUser(userId);
  const run = couple ? runToMeasure(await getLatestRun(admin, couple.id), new Date()) : null;
  return json({ ok: true, measure: run && { runId: run.id, sentAt: run.sentAt.toISOString() } });
});
