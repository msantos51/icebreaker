export const OTP_LENGTH = 6;

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(input));
}

/** Keeps only digits, so pasted codes like "123 456" work. */
export function normalizeOtp(input: string): string {
  return input.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

export function isCompleteOtp(input: string): boolean {
  return normalizeOtp(input).length === OTP_LENGTH;
}
