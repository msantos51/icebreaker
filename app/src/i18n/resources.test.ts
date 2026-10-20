import { describe, expect, it } from 'vitest';

import { resolveLanguage, resources } from './resources';

function leaves(value: unknown, path = ''): [string, unknown][] {
  if (typeof value !== 'object' || value === null) return [[path, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, path ? `${path}.${key}` : key),
  );
}

describe('resolveLanguage', () => {
  it('falls back to pt-PT when nothing matches', () => {
    expect(resolveLanguage([])).toBe('pt-PT');
    expect(resolveLanguage(['ja-JP'])).toBe('pt-PT');
  });

  it('matches by language code', () => {
    expect(resolveLanguage(['pt-BR'])).toBe('pt-PT');
    expect(resolveLanguage(['ja-JP', 'pt'])).toBe('pt-PT');
  });
});

describe('translations', () => {
  it.each(Object.entries(resources))('%s has no empty strings', (_lang, { translation }) => {
    for (const [key, value] of leaves(translation)) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim(), key).not.toBe('');
    }
  });
});
