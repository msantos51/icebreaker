import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createDb, createUser } from './db';

let db: PGliteInterface;
let alice: string;
let bob: string;
let coupleId: string;

beforeEach(async () => {
  db = await createDb();
  alice = await createUser(db);
  bob = await createUser(db);
  const { rows } = await db.query<{ id: string }>(
    'insert into public.couples (user_a_id, user_b_id) values ($1, $2) returning id',
    [alice, bob],
  );
  coupleId = rows[0]!.id;
  await db.query(
    `insert into public.missions (id, type, level, message_a, message_b, follow_up)
     values ('m1', 'coop', 1, 'a', 'b', 'f')`,
  );
});

const register = (user: string, token: string) =>
  asUser(db, user, (tx) => tx.query(`select public.register_push_token($1, 'android')`, [token]));

describe('register_push_token', () => {
  it('stores the token for the signed-in user', async () => {
    await register(alice, 'ExponentPushToken[a]');
    const { rows } = await db.query('select token, user_id, platform from public.push_tokens');
    expect(rows).toEqual([{ token: 'ExponentPushToken[a]', user_id: alice, platform: 'android' }]);
  });

  it('moves a device to the account that signed in last', async () => {
    await register(alice, 'shared-device');
    await register(bob, 'shared-device');
    const { rows } = await db.query('select user_id from public.push_tokens');
    expect(rows).toEqual([{ user_id: bob }]);
  });
});

describe('start_mission_run', () => {
  const start = () =>
    db.transaction(async (tx) => {
      await tx.exec('set local role service_role');
      const { rows } = await tx.query<{ id: string | null }>(
        `select public.start_mission_run($1, 'm1', $2, 'manual') as id`,
        [coupleId, alice],
      );
      return rows[0]!.id;
    });

  it('records the run', async () => {
    expect(await start()).toMatch(/^[0-9a-f-]{36}$/);
    const { rows } = await db.query(
      'select mission_id, source, role_a_user_id from public.mission_runs',
    );
    expect(rows).toEqual([{ mission_id: 'm1', source: 'manual', role_a_user_id: alice }]);
  });

  it('refuses a second run within the silence period (both pressed at once)', async () => {
    expect(await start()).not.toBeNull();
    expect(await start()).toBeNull();
    const { rows } = await db.query('select count(*)::int as n from public.mission_runs');
    expect(rows[0]).toEqual({ n: 1 });
  });

  it('is not callable by clients', async () => {
    await expect(
      asUser(db, alice, (tx) =>
        tx.query(`select public.start_mission_run($1, 'm1', $2, 'manual')`, [coupleId, alice]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
