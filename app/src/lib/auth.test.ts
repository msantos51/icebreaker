import { describe, expect, it } from 'vitest';

import { isCompleteOtp, isValidEmail, normalizeEmail, normalizeOtp } from './auth';

describe('email', () => {
  it('normalizes case and spaces', () => {
    expect(normalizeEmail('  Ana@Exemplo.PT ')).toBe('ana@exemplo.pt');
  });

  it.each([
    ['ana@exemplo.pt', true],
    [' ana@exemplo.pt ', true],
    ['ana@exemplo', false],
    ['ana exemplo.pt', false],
    ['', false],
  ])('isValidEmail(%j) = %s', (input, expected) => {
    expect(isValidEmail(input)).toBe(expected);
  });
});

describe('otp', () => {
  it('keeps only the first 6 digits', () => {
    expect(normalizeOtp('123 456')).toBe('123456');
    expect(normalizeOtp('1234567')).toBe('123456');
  });

  it('knows when the code is complete', () => {
    expect(isCompleteOtp('12345')).toBe(false);
    expect(isCompleteOtp('12-34-56')).toBe(true);
  });
});
