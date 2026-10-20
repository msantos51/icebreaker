// Test harness: applies the real migrations to an in-memory Postgres (PGlite) with a minimal stub
// of what Supabase provides (auth schema, auth.uid(), the anon/authenticated/service_role roles).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PGlite, type PGliteInterface, type Transaction } from '@electric-sql/pglite';

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function migrate(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

let shared: Promise<PGlite> | undefined;

/**
 * Fully migrated database with all data removed. Migrations run once per test file; later calls
 * only truncate the tables, which is much faster than migrating again.
 */
export async function createDb(): Promise<PGliteInterface> {
  shared ??= migrate();
  const db = await shared;
  const { rows } = await db.query<{ name: string }>(
    `select format('%I.%I', schemaname, tablename) as name from pg_tables
     where schemaname in ('public', 'auth')`,
  );
  await db.exec(`truncate ${rows.map((r) => r.name).join(', ')} cascade`);
  return db;
}

export async function createUser(db: PGliteInterface): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (id) values (gen_random_uuid()) returning id',
  );
  return rows[0]!.id;
}

/** Runs `fn` as an authenticated client with the given user id, like a request through PostgREST. */
export async function asUser<T>(
  db: PGliteInterface,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await tx.exec('set local role authenticated');
    return fn(tx);
  });
}
