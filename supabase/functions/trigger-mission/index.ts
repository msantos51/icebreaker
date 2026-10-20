// "Estamos aborrecidos": sends a mission to the caller's couple if the rules allow it.
// Responds only { sent: boolean }: the reason is never exposed, so a partner's "hoje não" stays
// private.

import { createClient } from '@supabase/supabase-js';

import { createExpoPushSender } from '../_shared/expo-push.ts';
import { createSupabaseRepository } from '../_shared/repository.ts';
import { sendManualMission } from '../_shared/send-mission.ts';

// Provided by the Supabase Edge Runtime.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(jwt);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const outcome = await sendManualMission(data.user.id, {
    repo: createSupabaseRepository(admin),
    push: createExpoPushSender(EXPO_ACCESS_TOKEN),
    now: () => new Date(),
    schedule: (task, delayMs) => {
      const delayed = new Promise<void>((resolve) => setTimeout(resolve, delayMs)).then(task);
      // Keeps the function alive for the follow-up after the response is sent.
      EdgeRuntime.waitUntil(delayed);
    },
  });

  // Reasons are logged for debugging but never returned to the client.
  console.log(JSON.stringify({ event: 'trigger-mission', ...outcome }));
  return json({ sent: outcome.status === 'sent' });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
