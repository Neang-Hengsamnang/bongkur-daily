import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import km from './km.json';

const stored = localStorage.getItem('sdps_lang');

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, km: { translation: km } },
  lng: stored || 'km',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('sdps_lang', lng);
  document.documentElement.lang = lng;
});

export default i18n;