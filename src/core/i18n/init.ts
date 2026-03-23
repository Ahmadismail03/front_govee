import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Alert, DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { StorageKeys } from '../storage/keys';
import { getSecureItem, setSecureItem } from '../storage/secureStorage';
import { ar } from './resources/ar';
import { en } from './resources/en';
import { useLanguageChangeStore } from './store/useLanguageChangeStore';

export type SupportedLanguage = 'en' | 'ar';

const resources = {
  en: { translation: en },
  ar: { translation: ar },
} as const;

function shouldUseRtl(language: SupportedLanguage): boolean {
  // Arabic uses RTL, English uses LTR
  return language === 'ar';
}

function ensureI18nInitialized(): void {
  if (i18n.isInitialized) return;

  // Initialize synchronously (fire-and-forget) so `useTranslation()` always has an instance.
  // Language + RTL direction is finalized in `initI18n()`.
  i18n.use(initReactI18next);
  void i18n.init({
    compatibilityJSON: 'v4',
    resources: resources as any,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

ensureI18nInitialized();

/**
 * Reload the app using whatever mechanism is available.
 * Works in Expo Go (DevSettings), dev-client, and production (Updates).
 */
function reloadApp(): void {
  // Try expo-updates first (works in dev-client and production)
  Updates.reloadAsync()
    .then(() => { /* reloaded */ })
    .catch(() => {
      // Expo Go or standalone without updates: fall back to DevSettings
      if (typeof DevSettings?.reload === 'function') {
        DevSettings.reload();
      } else {
        Alert.alert(
          'Restart Required',
          'Please close and reopen the app to apply the language change.',
          [{ text: 'OK' }]
        );
      }
    });
}

export async function initI18n(): Promise<void> {
  ensureI18nInitialized();

  // Always allow RTL so the layout engine can switch direction
  I18nManager.allowRTL(true);

  const saved = (await getSecureItem(StorageKeys.language)) as SupportedLanguage | null;
  // Default to Arabic for this Palestinian government app
  const language: SupportedLanguage = saved ?? 'ar';

  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  const wantRtl = shouldUseRtl(language);

  if (I18nManager.isRTL !== wantRtl) {
    // Direction mismatch — apply and reload so the native layout engine picks it up
    I18nManager.forceRTL(wantRtl);
    try {
      await setSecureItem(StorageKeys.language, language);
    } catch { /* ignore */ }
    // Slight delay so the save completes before the reload
    setTimeout(reloadApp, 300);
  }
}

export async function setAppLanguage(
  language: SupportedLanguage
): Promise<{ requiresRestart: boolean }> {
  ensureI18nInitialized();

  const wantRtl = shouldUseRtl(language);
  const requiresRestart = I18nManager.isRTL !== wantRtl;

  // Show the launch screen during transition
  useLanguageChangeStore.getState().setIsChanging(true);

  // Persist and switch translation strings immediately
  await setSecureItem(StorageKeys.language, language);
  await i18n.changeLanguage(language);

  // Apply RTL/LTR — MUST happen before reload
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(wantRtl);

  // Reload with fallback so it works in Expo Go, dev-client, and production
  setTimeout(reloadApp, 500);

  return { requiresRestart };
}

export function getCurrentLanguage(): SupportedLanguage {
  ensureI18nInitialized();
  const lng = i18n.language as SupportedLanguage | undefined;
  return lng === 'ar' ? 'ar' : 'en';
}

// Single source of truth for UI direction based on the
// currently active i18n language. Use this instead of
// reading I18nManager.isRTL directly inside components.
export function isRtlUi(): boolean {
  ensureI18nInitialized();
  const dir = i18n.dir(i18n.resolvedLanguage || i18n.language);
  return dir === 'rtl';
}

export default i18n;
