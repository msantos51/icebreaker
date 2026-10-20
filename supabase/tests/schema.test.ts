import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createDb, createUser } from './db';

let db: PGliteInterface;
let alice: string;
let bob: string;
let carol: string;
let coupleId: string;

beforeEach(async () => {
  db = await createDb();
  alice = await createUser(db);
  bob = await createUser(db);
  carol = await createUser(db);
  const { rows } = await db.query<{ id: string }>(
    'insert into public.couples (user_a_id, user_b_id) values ($1, $2) returning id',
    [alice, bob],
  );
  coupleId = rows[0]!.id;
});

async function insertMission(id = 'm1') {
  await db.query(
    `insert into public.missions (id, type, level, message_a, message_b, follow_up)
     values ($1, 'coop', 1, 'a', 'b', 'f')`,
    [id],
  );
}

describe('profiles', () => {
  it('creates a profile for every new auth user', async () => {
    const { rows } = await db.query('select id from public.profiles');
    expect(rows).toHaveLength(3);
  });

  it('is only visible to its owner, never to the partner', async () => {
    const rows = await asUser(db, alice, async (tx) => {
      const { rows } = await tx.query<{ id: string }>('select id from public.profiles');
      return rows;
    });
    expect(rows).toEqual([{ id: alice }]);
  });

  it('keeps "hoje não" private from the partner', async () => {
    await asUser(db, alice, (tx) =>
      tx.query(`update public.profiles set snoozed_until = now() + interval '3 hours'`),
    );
    const seenByBob = await asUser(db, bob, async (tx) => {
      const { rows } = await tx.query('select snoozed_until from public.profiles where id = $1', [
        alice,
      ]);
      return rows;
    });
    expect(seenByBob).toEqual([]);
  });

  it('cannot update another user profile', async () => {
    await asUser(db, alice, (tx) =>
      tx.query(`update public.profiles set display_name = 'x' where id = $1`, [bob]),
    );
    const { rows } = await db.query('select display_name from public.profiles where id = $1', [
      bob,
    ]);
    expect(rows).toEqual([{ display_name: null }]);
  });
});

describe('couples', () => {
  it('is visible to both members and nobody else', async () => {
    const count = async (user: string) =>
      asUser(db, user, async (tx) => (await tx.query('select id from public.couples')).rows.length);
    expect(await count(alice)).toBe(1);
    expect(await count(bob)).toBe(1);
    expect(await count(carol)).toBe(0);
  });

  it('uses the spec defaults', async () => {
    const { rows } = await db.query(
      `select level_a, level_b, window_start, window_end, usage_threshold_min,
              silence_period_min, max_missions_per_night, timezone
       from public.couples`,
    );
    expect(rows[0]).toEqual({
      level_a: 1,
      level_b: 1,
      window_start: '19:00:00',
      window_end: '23:30:00',
      usage_threshold_min: 20,
      silence_period_min: 60,
      max_missions_per_night: 2,
      timezone: 'Europe/Lisbon',
    });
  });

  it('does not allow a user to be in two couples', async () => {
    await expect(
      db.query('insert into public.couples (user_a_id, user_b_id) values ($1, $2)', [carol, bob]),
    ).rejects.toThrow(/already in a couple/);
  });

  it('cannot be created directly by clients', async () => {
    await db.query('delete from public.couples');
    await expect(
      asUser(db, alice, (tx) =>
        tx.query('insert into public.couples (user_a_id, user_b_id) values ($1, $2)', [alice, bob]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('lets each partner change only their own level', async () => {
    await asUser(db, alice, (tx) => tx.query('update public.couples set level_a = 2'));
    await expect(
      asUser(db, alice, (tx) => tx.query('update public.couples set level_b = 3')),
    ).rejects.toThrow(/own level/);
    const { rows } = await db.query('select level_a, level_b from public.couples');
    expect(rows[0]).toEqual({ level_a: 2, level_b: 1 });
  });

  it('does not allow members to be swapped', async () => {
    await expect(
      asUser(db, alice, (tx) => tx.query('update public.couples set user_b_id = $1', [carol])),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('unpairing deletes the couple history', async () => {
    await insertMission();
    await db.query(
      `insert into public.mission_runs (couple_id, mission_id, source, role_a_user_id)
       values ($1, 'm1', 'manual', $2)`,
      [coupleId, alice],
    );
    await asUser(db, bob, (tx) => tx.query('delete from public.couples'));
    const { rows } = await db.query('select count(*)::int as n from public.mission_runs');
    expect(rows[0]).toEqual({ n: 0 });
  });

  it('cannot be deleted by an outsider', async () => {
    await asUser(db, carol, (tx) => tx.query('delete from public.couples'));
    const { rows } = await db.query('select count(*)::int as n from public.couples');
    expect(rows[0]).toEqual({ n: 1 });
  });
});

describe('missions and mission_runs', () => {
  it('are not readable by clients', async () => {
    await insertMission();
    await expect(
      asUser(db, alice, (tx) => tx.query('select * from public.missions')),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, alice, (tx) => tx.query('select * from public.mission_runs')),
    ).rejects.toThrow(/permission denied/);
  });

  it('rejects messages longer than 200 characters', async () => {
    await expect(
      db.query(
        `insert into public.missions (id, type, level, message_a, message_b, follow_up)
         values ('long', 'coop', 1, $1, 'b', 'f')`,
        ['x'.repeat(201)],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe('push_tokens', () => {
  it('can only be managed by their owner', async () => {
    await asUser(db, alice, (tx) =>
      tx.query(
        `insert into public.push_tokens (token, user_id, platform) values ('t1', $1, 'ios')`,
        [alice],
      ),
    );
    await expect(
      asUser(db, alice, (tx) =>
        tx.query(
          `insert into public.push_tokens (token, user_id, platform) values ('t2', $1, 'ios')`,
          [bob],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const seenByBob = await asUser(
      db,
      bob,
      async (tx) => (await tx.query('select token from public.push_tokens')).rows,
    );
    expect(seenByBob).toEqual([]);
  });
});
