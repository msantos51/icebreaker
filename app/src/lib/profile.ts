export const NAME_MAX_LENGTH = 40;

export function cleanName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function isValidName(input: string): boolean {
  const name = cleanName(input);
  return name.length > 0 && name.length <= NAME_MAX_LENGTH;
}
