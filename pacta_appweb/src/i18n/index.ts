import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import Spanish translations
import esCommon from '../../public/locales/es/common.json';
import esLanding from '../../public/locales/es/landing.json';
import esLogin from '../../public/locales/es/login.json';
import esSetup from '../../public/locales/es/setup.json';
import esContracts from '../../public/locales/es/contracts.json';
import esClients from '../../public/locales/es/clients.json';
import esSuppliers from '../../public/locales/es/suppliers.json';
import esSupplements from '../../public/locales/es/supplements.json';
import esReports from '../../public/locales/es/reports.json';
import esSettings from '../../public/locales/es/settings.json';
import esDocuments from '../../public/locales/es/documents.json';
import esNotifications from '../../public/locales/es/notifications.json';
import esSigners from '../../public/locales/es/signers.json';
import esCompanies from '../../public/locales/es/companies.json';
import esPending from '../../public/locales/es/pending.json';
import esDashboard from '../../public/locales/es/dashboard.json';

// Import English translations
import enCommon from '../../public/locales/en/common.json';
import enLanding from '../../public/locales/en/landing.json';
import enLogin from '../../public/locales/en/login.json';
import enSetup from '../../public/locales/en/setup.json';
import enContracts from '../../public/locales/en/contracts.json';
import enClients from '../../public/locales/en/clients.json';
import enSuppliers from '../../public/locales/en/suppliers.json';
import enSupplements from '../../public/locales/en/supplements.json';
import enReports from '../../public/locales/en/reports.json';
import enSettings from '../../public/locales/en/settings.json';
import enDocuments from '../../public/locales/en/documents.json';
import enNotifications from '../../public/locales/en/notifications.json';
import enSigners from '../../public/locales/en/signers.json';
import enCompanies from '../../public/locales/en/companies.json';
import enPending from '../../public/locales/en/pending.json';
import enDashboard from '../../public/locales/en/dashboard.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        common: esCommon,
        landing: esLanding,
        login: esLogin,
        setup: esSetup,
        contracts: esContracts,
        clients: esClients,
        suppliers: esSuppliers,
        supplements: esSupplements,
        reports: esReports,
        settings: esSettings,
        documents: esDocuments,
        notifications: esNotifications,
        signers: esSigners,
        companies: esCompanies,
        pending: esPending,
        dashboard: esDashboard,
      },
      en: {
        common: enCommon,
        landing: enLanding,
        login: enLogin,
        setup: enSetup,
        contracts: enContracts,
        clients: enClients,
        suppliers: enSuppliers,
        supplements: enSupplements,
        reports: enReports,
        settings: enSettings,
        documents: enDocuments,
        notifications: enNotifications,
        signers: enSigners,
        companies: enCompanies,
        pending: enPending,
        dashboard: enDashboard,
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
