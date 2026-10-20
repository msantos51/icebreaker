import { describe, expect, it } from 'vitest';

import { normalizePairingCode, pairingError, timeLeft } from './pairing';

describe('normalizePairingCode', () => {
  it('uppercases and drops characters outside the alphabet', () => {
    expect(normalizePairingCode(' ab-c d2 3 ')).toBe('ABCD23');
    expect(normalizePairingCode('abcdefgh')).toBe('ABCDEF');
    expect(normalizePairingCode('o0i1')).toBe('');
  });
});

describe('pairingError', () => {
  it.each([
    ['invalid_code', 'invalidCode'],
    ['own_code', 'ownCode'],
    ['already_paired', 'alreadyPaired'],
    ['network down', 'generic'],
    [undefined, 'generic'],
  ] as const)('%s -> %s', (message, key) => {
    expect(pairingError(message)).toBe(key);
  });
});

describe('timeLeft', () => {
  const now = new Date('2026-12-01T20:00:00Z');
  it('formats minutes and seconds', () => {
    expect(timeLeft(new Date('2026-12-01T20:15:00Z'), now)).toBe('15:00');
    expect(timeLeft(new Date('2026-12-01T20:00:09Z'), now)).toBe('0:09');
  });

  it('returns null once expired', () => {
    expect(timeLeft(now, now)).toBeNull();
  });
});
