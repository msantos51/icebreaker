import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { FALLBACK_LANGUAGE, resolveLanguage, resources } from './resources';

const i18n = createInstance({
  resources,
  lng: resolveLanguage(getLocales().map((locale) => locale.languageTag)),
  fallbackLng: FALLBACK_LANGUAGE,
  initAsync: false,
  interpolation: { escapeValue: false },
});

i18n.use(initReactI18next).init();

export default i18n;
