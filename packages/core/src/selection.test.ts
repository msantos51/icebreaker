import { describe, expect, it } from 'vitest';

import type { Mission, MissionType } from './missions.ts';
import { assignRoles, pickMission, type PreviousRun, renderMessage } from './selection.ts';

function mission(id: string, type: MissionType = 'coop', level: Mission['level'] = 1): Mission {
  return { id, type, level, tags: [], message_a: 'a', message_b: 'b', follow_up: 'f' };
}

const sent = (missionId: string, iso: string): PreviousRun => ({
  missionId,
  sentAt: new Date(iso),
});

const first = () => 0;
const last = () => 0.999;

describe('pickMission', () => {
  it('returns null when nothing matches the level', () => {
    expect(pickMission([mission('x', 'coop', 2)], 1, [])).toBeNull();
    expect(pickMission([], 3, [])).toBeNull();
  });

  it('never picks a mission above the couple level', () => {
    const catalogue = [mission('light', 'coop', 1), mission('spicy', 'coop', 2)];
    for (const random of [first, last]) {
      expect(pickMission(catalogue, 1, [], random)?.id).toBe('light');
    }
    expect(pickMission(catalogue, 2, [], last)?.id).toBe('spicy');
  });

  it('prefers missions that were never sent', () => {
    const catalogue = [mission('a'), mission('b'), mission('c')];
    const history = [sent('a', '2026-12-01T20:00:00Z'), sent('c', '2026-12-02T20:00:00Z')];
    expect(pickMission(catalogue, 1, history, first)?.id).toBe('b');
    expect(pickMission(catalogue, 1, history, last)?.id).toBe('b');
  });

  it('once all were sent, picks the one sent longest ago', () => {
    const catalogue = [mission('a'), mission('b'), mission('c')];
    const history = [
      sent('a', '2026-12-03T20:00:00Z'),
      sent('b', '2026-12-01T20:00:00Z'),
      sent('c', '2026-12-02T20:00:00Z'),
      sent('b', '2026-12-04T20:00:00Z'), // b was sent again later
    ];
    expect(pickMission(catalogue, 1, history, first)?.id).toBe('c');
  });

  it('avoids repeating the type of the last mission when possible', () => {
    const catalogue = [mission('j1', 'actor_audience'), mission('j2', 'actor_audience')];
    catalogue.push(mission('q1', 'coop'));
    const history = [sent('j1', '2026-12-01T20:00:00Z')];
    for (const random of [first, last]) {
      expect(pickMission(catalogue, 1, history, random)?.id).toBe('q1');
    }
  });

  it('repeats the type when it is the only option left', () => {
    const catalogue = [mission('j1', 'actor_audience'), mission('j2', 'actor_audience')];
    const history = [sent('j1', '2026-12-01T20:00:00Z')];
    expect(pickMission(catalogue, 1, history)?.id).toBe('j2');
  });

  it('chooses randomly among equally good candidates', () => {
    const catalogue = [mission('a'), mission('b'), mission('c')];
    expect(pickMission(catalogue, 1, [], first)?.id).toBe('a');
    expect(pickMission(catalogue, 1, [], () => 0.5)?.id).toBe('b');
    expect(pickMission(catalogue, 1, [], last)?.id).toBe('c');
  });

  it('ignores history of missions no longer in the catalogue', () => {
    const catalogue = [mission('a')];
    expect(pickMission(catalogue, 1, [sent('gone', '2026-12-01T20:00:00Z')])?.id).toBe('a');
  });
});

describe('assignRoles', () => {
  it('assigns each role to one partner, randomly', () => {
    expect(assignRoles(['ana', 'rui'], () => 0.1)).toEqual({ roleA: 'ana', roleB: 'rui' });
    expect(assignRoles(['ana', 'rui'], () => 0.9)).toEqual({ roleA: 'rui', roleB: 'ana' });
  });
});

describe('renderMessage', () => {
  it('replaces every {parceiro} with the nickname', () => {
    expect(renderMessage('Conta a {parceiro} uma piada. {parceiro} vai rir.', ' Kiko ')).toBe(
      'Conta a Kiko uma piada. Kiko vai rir.',
    );
  });

  it('leaves messages without placeholders unchanged', () => {
    expect(renderMessage('Telemóveis em baixo.', 'Kiko')).toBe('Telemóveis em baixo.');
  });
});
