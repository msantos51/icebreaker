import { describe, expect, it } from 'vitest';

import {
  areTogether,
  continuousUsageMinutes,
  isFresh,
  isInsideWindow,
  offPhoneMinutes,
  type PresenceSignal,
  reportedUsageMinutes,
  type ScreenEvent,
} from './usage.ts';

const t = (hhmmss: string) => new Date(`2026-12-01T${hhmmss}Z`);
const on = (hhmmss: string): ScreenEvent => ({ type: 'on', at: t(hhmmss) });
const off = (hhmmss: string): ScreenEvent => ({ type: 'off', at: t(hhmmss) });
const SINCE = t('18:00:00');

describe('continuousUsageMinutes', () => {
  it('is 0 without events', () => {
    expect(continuousUsageMinutes([], t('21:00:00'), SINCE)).toBe(0);
  });

  it('counts the current session while the screen is on', () => {
    expect(continuousUsageMinutes([on('20:35:00')], t('21:00:00'), SINCE)).toBe(25);
  });

  it('is 0 once the screen has been off longer than the tolerance', () => {
    expect(continuousUsageMinutes([on('20:00:00'), off('20:50:00')], t('21:00:00'), SINCE)).toBe(0);
  });

  it('still counts right after a short lock', () => {
    expect(continuousUsageMinutes([on('20:30:00'), off('20:59:30')], t('21:00:00'), SINCE)).toBe(
      30,
    );
  });

  it('merges sessions separated by less than a minute', () => {
    const events = [
      on('20:30:00'),
      off('20:40:00'),
      on('20:40:40'),
      off('20:50:00'),
      on('20:50:20'),
    ];
    expect(continuousUsageMinutes(events, t('21:00:00'), SINCE)).toBe(30);
  });

  it('starts a new session after a longer pause', () => {
    const events = [on('20:00:00'), off('20:40:00'), on('20:45:00')];
    expect(continuousUsageMinutes(events, t('21:00:00'), SINCE)).toBe(15);
  });

  it('treats a leading "off" as a screen already on at the start of the period', () => {
    expect(continuousUsageMinutes([off('20:59:50')], t('21:00:00'), t('20:30:00'))).toBe(30);
  });

  it('does not depend on event order and ignores duplicate "on"', () => {
    const events = [on('20:50:00'), on('20:40:00'), on('20:45:00')];
    expect(continuousUsageMinutes(events, t('21:00:00'), SINCE)).toBe(20);
  });
});

describe('offPhoneMinutes', () => {
  const sent = t('21:00:00');

  it('counts from putting the phone down until it is used again', () => {
    const events = [off('21:01:00'), on('21:46:00'), off('21:50:00')];
    expect(offPhoneMinutes(events, sent, t('22:00:00'))).toEqual({ minutes: 45, final: true });
  });

  it('ignores short glances (e.g. the follow-up notification lighting the screen)', () => {
    const events = [
      off('21:00:30'),
      on('21:01:00'),
      off('21:01:10'),
      on('21:31:00'),
      off('21:40:00'),
    ];
    expect(offPhoneMinutes(events, sent, t('22:00:00'))).toEqual({ minutes: 30, final: true });
  });

  it('is not final while the phone is still down', () => {
    expect(offPhoneMinutes([off('21:01:00')], sent, t('21:21:00'))).toEqual({
      minutes: 20,
      final: false,
    });
  });

  it('is not final while a screen-on is shorter than a glance', () => {
    expect(offPhoneMinutes([off('21:01:00'), on('21:20:00')], sent, t('21:20:10'))).toEqual({
      minutes: 19,
      final: false,
    });
  });

  it('is capped at 120 minutes', () => {
    expect(offPhoneMinutes([off('21:01:00')], sent, t('23:30:00'))).toEqual({
      minutes: 120,
      final: true,
    });
    expect(offPhoneMinutes([off('21:01:00'), on('23:30:00')], sent, t('23:40:00'))).toEqual({
      minutes: 120,
      final: true,
    });
  });

  it('is 0 when the phone was not put down within 10 minutes', () => {
    expect(offPhoneMinutes([off('21:15:00')], sent, t('22:00:00'))).toEqual({
      minutes: 0,
      final: true,
    });
    expect(offPhoneMinutes([], sent, t('21:11:00'))).toEqual({ minutes: 0, final: true });
  });

  it('waits up to 10 minutes for the phone to be put down', () => {
    expect(offPhoneMinutes([], sent, t('21:05:00'))).toEqual({ minutes: 0, final: false });
  });

  it('ignores events before the mission', () => {
    const events = [off('20:30:00'), on('20:50:00'), off('21:02:00'), on('21:12:00')];
    expect(offPhoneMinutes(events, sent, t('21:30:00'))).toEqual({ minutes: 10, final: true });
  });
});

describe('isInsideWindow', () => {
  const window = { timezone: 'Europe/Lisbon', windowStart: '19:00', windowEnd: '23:30' };
  it('uses the couple local time', () => {
    expect(isInsideWindow(t('18:59:00'), window)).toBe(false);
    expect(isInsideWindow(t('19:00:00'), window)).toBe(true);
    expect(isInsideWindow(t('23:30:00'), window)).toBe(false);
  });
});

describe('presence', () => {
  const now = t('21:00:00');
  const signal = (overrides: Partial<PresenceSignal> = {}): PresenceSignal => ({
    publicIpHash: 'home',
    continuousUsageMin: 25,
    dnd: false,
    updatedAt: t('20:50:00'),
    ...overrides,
  });

  it('is fresh for 20 minutes', () => {
    expect(isFresh(signal({ updatedAt: t('20:40:00') }), now)).toBe(true);
    expect(isFresh(signal({ updatedAt: t('20:39:59') }), now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });

  it('considers both together when fresh and behind the same IP', () => {
    expect(areTogether(signal(), signal(), now)).toBe(true);
    expect(areTogether(signal(), signal({ publicIpHash: 'office' }), now)).toBe(false);
    expect(areTogether(signal(), signal({ updatedAt: t('20:00:00') }), now)).toBe(false);
    expect(areTogether(signal(), null, now)).toBe(false);
  });

  it('reports usage only while fresh, without extrapolating', () => {
    expect(reportedUsageMinutes(signal(), now)).toBe(25);
    expect(reportedUsageMinutes(signal({ updatedAt: t('20:00:00') }), now)).toBeNull();
    expect(reportedUsageMinutes(null, now)).toBeNull();
  });
});
