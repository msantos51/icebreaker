import { describe, expect, it } from 'vitest';

import { cleanName, isValidName } from './profile';

describe('names', () => {
  it('trims and collapses spaces', () => {
    expect(cleanName('  Maria   João ')).toBe('Maria João');
  });

  it('must have between 1 and 40 characters', () => {
    expect(isValidName('   ')).toBe(false);
    expect(isValidName('Kiko')).toBe(true);
    expect(isValidName('x'.repeat(41))).toBe(false);
  });
});
