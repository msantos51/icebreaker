import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createDb, createUser } from './db';

let db: PGliteInterface;
let alice: string;
let bob: string;

beforeEach(async () => {
  db = await createDb();
  alice = await createUser(db);
  bob = await createUser(db);
  await db.query('insert into public.couples (user_a_id, user_b_id) values ($1, $2)', [alice, bob]);
});

const setWindow = (start: string, end: string) =>
  asUser(db, bob, (tx) =>
    tx.query('update public.couples set window_start = $1, window_end = $2', [start, end]),
  );

describe('couple window', () => {
  it.each([
    ['20:00', '23:00'],
    ['22:00', '02:00'],
    ['22:00', '05:00'],
    ['05:00', '09:00'],
  ])('accepts %s-%s', async (start, end) => {
    await setWindow(start, end);
    const { rows } = await db.query<{ window_start: string }>(
      'select window_start from public.couples',
    );
    expect(rows[0]!.window_start).toBe(`${start}:00`);
  });

  it.each([
    ['22:00', '06:00'],
    ['04:00', '09:00'],
    ['04:30', '02:00'],
  ])('rejects %s-%s, which includes 05:00', async (start, end) => {
    await expect(setWindow(start, end)).rejects.toThrow(/couples_window_day_boundary/);
  });

  it('rejects an empty window', async () => {
    await expect(setWindow('20:00', '20:00')).rejects.toThrow(/check constraint/);
  });
});
