import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

import { asUser, createDb, createUser } from './db';

let db: PGliteInterface;
let alice: string;
let bob: string;
let carol: string;

beforeEach(async () => {
  db = await createDb();
  alice = await createUser(db);
  bob = await createUser(db);
  carol = await createUser(db);
});

async function createCode(user: string): Promise<{ code: string; expires_at: Date }> {
  return asUser(db, user, async (tx) => {
    const { rows } = await tx.query<{ code: string; expires_at: Date }>(
      'select * from public.create_pairing_code()',
    );
    return rows[0]!;
  });
}

async function redeem(user: string, code: string): Promise<string> {
  return asUser(db, user, async (tx) => {
    const { rows } = await tx.query<{ id: string }>('select public.redeem_pairing_code($1) as id', [
      code,
    ]);
    return rows[0]!.id;
  });
}

async function couples() {
  const { rows } = await db.query('select user_a_id, user_b_id from public.couples');
  return rows;
}

describe('create_pairing_code', () => {
  it('creates a 6-character code valid for 15 minutes', async () => {
    const before = Date.now();
    const { code, expires_at } = await createCode(alice);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const minutes = (expires_at.getTime() - before) / 60_000;
    expect(minutes).toBeGreaterThan(14.9);
    expect(minutes).toBeLessThan(15.1);
  });

  it('replaces the previous code of the same user', async () => {
    const first = await createCode(alice);
    const second = await createCode(alice);
    const { rows } = await db.query('select code from public.pairing_codes');
    expect(rows).toEqual([{ code: second.code }]);
    expect(second.code).not.toBe(first.code);
  });

  it('is refused when the user is already paired', async () => {
    await redeem(bob, (await createCode(alice)).code);
    await expect(createCode(alice)).rejects.toThrow(/already_paired/);
  });

  it('requires authentication', async () => {
    await expect(db.query('select * from public.create_pairing_code()')).rejects.toThrow(
      /not_authenticated/,
    );
  });
});

describe('redeem_pairing_code', () => {
  it('pairs the two users and removes the code', async () => {
    const { code } = await createCode(alice);
    const coupleId = await redeem(bob, code);
    expect(coupleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await couples()).toEqual([{ user_a_id: alice, user_b_id: bob }]);
    const { rows } = await db.query('select * from public.pairing_codes');
    expect(rows).toEqual([]);
  });

  it('accepts lowercase codes with spaces', async () => {
    const { code } = await createCode(alice);
    await redeem(bob, `  ${code.toLowerCase()} `);
    expect(await couples()).toHaveLength(1);
  });

  it('rejects unknown codes', async () => {
    await expect(redeem(bob, 'ZZZZZZ')).rejects.toThrow(/invalid_code/);
  });

  it('rejects expired codes', async () => {
    const { code } = await createCode(alice);
    await db.query(`update public.pairing_codes set expires_at = now() - interval '1 second'`);
    await expect(redeem(bob, code)).rejects.toThrow(/invalid_code/);
  });

  it('rejects the user own code', async () => {
    const { code } = await createCode(alice);
    await expect(redeem(alice, code)).rejects.toThrow(/own_code/);
  });

  it('rejects when either user is already paired', async () => {
    const aliceCode = (await createCode(alice)).code;
    const carolCode = (await createCode(carol)).code;
    await redeem(bob, aliceCode);
    await expect(redeem(bob, carolCode)).rejects.toThrow(/already_paired/);
    expect(await couples()).toHaveLength(1);
  });

  it('cannot be reused once redeemed', async () => {
    const { code } = await createCode(alice);
    await redeem(bob, code);
    await expect(redeem(carol, code)).rejects.toThrow(/invalid_code/);
  });
});

describe('pairing codes privacy', () => {
  it('a user cannot read other users codes', async () => {
    await createCode(alice);
    const seenByBob = await asUser(
      db,
      bob,
      async (tx) => (await tx.query('select * from public.pairing_codes')).rows,
    );
    expect(seenByBob).toEqual([]);
  });

  it('the code generator is not callable by clients', async () => {
    await expect(
      asUser(db, alice, (tx) => tx.query('select public.random_pairing_code()')),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('unpairing', () => {
  it('lets the users pair again afterwards', async () => {
    await redeem(bob, (await createCode(alice)).code);
    await asUser(db, alice, (tx) => tx.query('delete from public.couples'));
    await redeem(carol, (await createCode(alice)).code);
    expect(await couples()).toEqual([{ user_a_id: alice, user_b_id: carol }]);
  });
});
