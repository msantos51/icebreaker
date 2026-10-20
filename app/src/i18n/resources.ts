import ptPT from './locales/pt-PT';

export const FALLBACK_LANGUAGE = 'pt-PT';

export const resources = {
  'pt-PT': { translation: ptPT },
} as const;

export type SupportedLanguage = keyof typeof resources;

const supported = Object.keys(resources) as SupportedLanguage[];

/**
 * Picks the first supported language from the device's preferred locales.
 * Matches the full tag first ("pt-PT"), then the language code ("pt" -> "pt-PT").
 */
export function resolveLanguage(deviceTags: readonly string[]): SupportedLanguage {
  for (const tag of deviceTags) {
    const exact = supported.find((lang) => lang.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const code = tag.split('-')[0]?.toLowerCase();
    const byCode = supported.find((lang) => lang.split('-')[0]?.toLowerCase() === code);
    if (byCode) return byCode;
  }
  return FALLBACK_LANGUAGE;
}
