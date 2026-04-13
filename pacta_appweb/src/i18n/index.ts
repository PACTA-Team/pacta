import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: {},
        landing: {},
        login: {},
        setup: {},
        contracts: {},
        clients: {},
        suppliers: {},
        supplements: {},
        reports: {},
        settings: {},
        documents: {},
        notifications: {},
        signers: {},
        companies: {},
        pending: {},
        dashboard: {},
      },
      es: {
        common: {},
        landing: {},
        login: {},
        setup: {},
        contracts: {},
        clients: {},
        suppliers: {},
        supplements: {},
        reports: {},
        settings: {},
        documents: {},
        notifications: {},
        signers: {},
        companies: {},
        pending: {},
        dashboard: {},
      },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    ns: ['common', 'landing', 'login', 'setup', 'contracts', 'clients', 'suppliers', 'supplements', 'reports', 'settings', 'documents', 'notifications', 'signers', 'companies', 'pending', 'dashboard'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'pacta-language',
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
