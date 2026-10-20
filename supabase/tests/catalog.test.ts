import { readFileSync } from 'node:fs';

import { MISSION_TYPES, validateCatalog } from '@icebreaker/core';
import { describe, expect, it } from 'vitest';

import { buildSeedSql, loadCatalog, SEED_PATH } from '../scripts/seed';
import { createDb } from './db';

const missions = loadCatalog();

describe('mission catalogue', () => {
  it('is valid', () => {
    expect(validateCatalog(missions)).toEqual([]);
  });

  it('covers every mission type at level 1', () => {
    const types = new Set(missions.filter((m) => m.level === 1).map((m) => m.type));
    expect([...types].sort()).toEqual([...MISSION_TYPES].sort());
  });

  it('has light missions by default (most are level 1)', () => {
    const light = missions.filter((m) => m.level === 1).length;
    expect(light / missions.length).toBeGreaterThan(0.75);
  });

  it('matches the generated seed.sql (run `npm run seed:build -w @icebreaker/supabase`)', () => {
    expect(readFileSync(SEED_PATH, 'utf8')).toBe(buildSeedSql(missions));
  });

  it('seeds the database, and re-seeding is idempotent', async () => {
    const db = await createDb();
    const seed = readFileSync(SEED_PATH, 'utf8');
    await db.exec(seed);
    await db.exec(seed);
    const { rows } = await db.query<{ n: number }>(
      'select count(*)::int as n from public.missions where active',
    );
    expect(rows[0]!.n).toBe(missions.length);
  });

  it('deactivates missions removed from the catalogue', async () => {
    const db = await createDb();
    await db.exec(buildSeedSql(missions));
    await db.exec(buildSeedSql(missions.slice(1)));
    const { rows } = await db.query('select active from public.missions where id = $1', [
      missions[0]!.id,
    ]);
    expect(rows).toEqual([{ active: false }]);
  });
});
