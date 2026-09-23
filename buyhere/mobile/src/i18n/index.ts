import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import type { Language } from '@/api/types';
import fr from './fr';
import ar from './ar';

/** Initialise i18next avec la langue enregistrée (français par défaut). */
export function initI18n(language: Language) {
  if (i18n.isInitialized) return i18n;
  i18n.use(initReactI18next).init({
    resources: { fr: { translation: fr }, ar: { translation: ar } },
    lng: language,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false }, // React échappe déjà
    returnNull: false,
  });
  return i18n;
}

/**
 * Change la langue. L'arabe nécessite une mise en page RTL : React Native ne
 * peut basculer RTL/LTR qu'au démarrage, donc l'app redémarre si besoin.
 * (Dans Expo Go, le RTL forcé n'est pas conservé — utiliser un development build.)
 */
export async function applyLanguage(language: Language) {
  await i18n.changeLanguage(language);
  const shouldBeRTL = language === 'ar';
  if (Platform.OS !== 'web' && I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    await reloadAppAsync();
  }
}

/** Au démarrage : réaligne la direction si la langue enregistrée ne correspond pas. */
export function ensureDirection(language: Language): boolean {
  const shouldBeRTL = language === 'ar';
  if (Platform.OS !== 'web' && I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    return true; // un redémarrage est nécessaire
  }
  return false;
}

export default i18n;
