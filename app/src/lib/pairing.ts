export const PAIRING_CODE_LENGTH = 6;

/** Same alphabet as the database: no 0/O or 1/I. */
const ALPHABET = /[^A-HJ-NP-Z2-9]/g;

export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(ALPHABET, '').slice(0, PAIRING_CODE_LENGTH);
}

export type PairingError = 'invalidCode' | 'ownCode' | 'alreadyPaired' | 'generic';

/** Maps the error raised by the pairing functions to a translation key under `pairing.errors`. */
export function pairingError(message: string | undefined): PairingError {
  if (message?.includes('invalid_code')) return 'invalidCode';
  if (message?.includes('own_code')) return 'ownCode';
  if (message?.includes('already_paired')) return 'alreadyPaired';
  return 'generic';
}

/** "mm:ss" left until the code expires, or null once expired. */
export function timeLeft(expiresAt: Date, now: Date): string | null {
  const seconds = Math.ceil((expiresAt.getTime() - now.getTime()) / 1000);
  if (seconds <= 0) return null;
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
