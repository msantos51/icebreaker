import { describe, expect, it } from 'vitest';

import { measurementAction } from './offphone';

const t = (hhmm: string) => new Date(`2026-12-01T${hhmm}:00Z`);
const pending = { runId: 'r1', sentAt: t('21:00').toISOString() };

describe('measurementAction', () => {
  it('reports once the phone was used again', () => {
    const events = [
      { type: 'off' as const, at: t('21:01') },
      { type: 'on' as const, at: t('21:41') },
    ];
    expect(measurementAction(pending, events, t('21:50'))).toEqual({
      action: 'report',
      minutes: 40,
    });
  });

  it('waits while the phone is still down', () => {
    expect(measurementAction(pending, [{ type: 'off', at: t('21:01') }], t('21:30'))).toEqual({
      action: 'wait',
    });
  });

  it('reports the cap after 120 minutes down', () => {
    expect(measurementAction(pending, [{ type: 'off', at: t('21:01') }], t('23:05'))).toEqual({
      action: 'report',
      minutes: 120,
    });
  });
});
