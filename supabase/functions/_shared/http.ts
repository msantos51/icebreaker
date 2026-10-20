import { createClient } from '@supabase/supabase-js';

/** Returns the signed-in user's id from the request's JWT, or null. */
export async function authenticate(
  request: Request,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  const jwt = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.getUser(jwt);
  return error || !data.user ? null : data.user.id;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Keeps the function alive for `task` after `delayMs`, even after the response is sent. */
export function scheduleWithEdgeRuntime(task: () => Promise<void>, delayMs: number): void {
  const delayed = new Promise<void>((resolve) => setTimeout(resolve, delayMs)).then(task);
  EdgeRuntime.waitUntil(delayed);
}

// Provided by the Supabase Edge Runtime.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
