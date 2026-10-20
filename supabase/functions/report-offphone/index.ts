// Main metric: minutes this phone stayed down after a mission, computed on the phone from screen
// events. The run keeps the lower value of the two partners.

import { createClient } from '@supabase/supabase-js';

import { authenticate, json } from '../_shared/http.ts';
import { parseOffPhoneReport } from '../_shared/presence.ts';
import { reportOffPhoneMinutes } from '../_shared/repository.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const userId = await authenticate(request, SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  const report = parseOffPhoneReport(await request.json().catch(() => null));
  if (!report) return json({ error: 'bad_request' }, 400);

  const recorded = await reportOffPhoneMinutes(admin, { ...report, userId });
  return json({ ok: recorded });
});
