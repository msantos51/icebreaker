import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createDb, createUser } from './db';

let db: PGliteInterface;
let alice: string;
let bob: string;
let carol: string;
let runId: string;

beforeEach(async () => {
  db = await createDb();
  alice = await createUser(db);
  bob = await createUser(db);
  carol = await createUser(db);
  const { rows } = await db.query<{ id: string }>(
    'insert into public.couples (user_a_id, user_b_id) values ($1, $2) returning id',
    [alice, bob],
  );
  await db.query(
    `insert into public.missions (id, type, level, message_a, message_b, follow_up)
     values ('m1', 'coop', 1, 'a', 'b', 'f')`,
  );
  const run = await db.query<{ id: string }>(
    `insert into public.mission_runs (couple_id, mission_id, source, role_a_user_id)
     values ($1, 'm1', 'auto', $2) returning id`,
    [rows[0]!.id, bob],
  );
  runId = run.rows[0]!.id;
});

const asService = <T>(sql: string, params: unknown[]) =>
  db.transaction(async (tx) => {
    await tx.exec('set local role service_role');
    return (await tx.query<T>(sql, params)).rows;
  });

const report = (user: string, minutes: number) =>
  asService<{ ok: boolean }>('select public.report_offphone_minutes($1, $2, $3) as ok', [
    runId,
    user,
    minutes,
  ]);

const run = async () =>
  (
    await db.query(
      `select offphone_minutes_role_a as a, offphone_minutes_role_b as b,
              offphone_minutes_after as after
       from public.mission_runs`,
    )
  ).rows[0];

describe('presence', () => {
  it('is not readable or writable by clients, not even for the own row', async () => {
    await db.query(
      `insert into public.presence (user_id, public_ip_hash, continuous_usage_min) values ($1, 'h', 25)`,
      [alice],
    );
    await expect(
      asUser(db, alice, (tx) => tx.query('select * from public.presence')),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, alice, (tx) =>
        tx.query(`update public.presence set continuous_usage_min = 99 where user_id = $1`, [
          alice,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('is deleted with the user', async () => {
    await db.query(
      `insert into public.presence (user_id, public_ip_hash, continuous_usage_min) values ($1, 'h', 25)`,
      [alice],
    );
    await db.query('delete from auth.users where id = $1', [alice]);
    const { rows } = await db.query('select * from public.presence');
    expect(rows).toEqual([]);
  });
});

describe('report_offphone_minutes', () => {
  it('stores each partner by role and keeps the lower of the two', async () => {
    expect(await report(alice, 40)).toEqual([{ ok: true }]);
    expect(await run()).toEqual({ a: null, b: 40, after: null });
    expect(await report(bob, 25)).toEqual([{ ok: true }]);
    expect(await run()).toEqual({ a: 25, b: 40, after: 25 });
  });

  it('ignores users outside the couple', async () => {
    expect(await report(carol, 10)).toEqual([{ ok: false }]);
    expect(await run()).toEqual({ a: null, b: null, after: null });
  });

  it('rejects values above 120 minutes', async () => {
    await expect(report(alice, 121)).rejects.toThrow(/check constraint/);
  });

  it('is not callable by clients', async () => {
    await expect(
      asUser(db, alice, (tx) =>
        tx.query('select public.report_offphone_minutes($1, $2, 10::smallint)', [runId, alice]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
