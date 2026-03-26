import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Alert, DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';
import { LocaleConfig } from 'react-native-calendars';
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

  // Set up React Native Calendars localization
  LocaleConfig.locales['ar'] = {
    monthNames: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    monthNamesShort: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    dayNames: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    dayNamesShort: ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'],
    today: 'اليوم',
  };
  LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', '+May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today',
  };

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

  LocaleConfig.defaultLocale = language;

  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  const wantRtl = shouldUseRtl(language);

  if (I18nManager.isRTL !== wantRtl) {
    I18nManager.forceRTL(wantRtl);
    try {
      await setSecureItem(StorageKeys.language, language);
    } catch { /* ignore */ }

    // In Expo Go, forceRTL() does NOT persist through JS-only reloads —
    // I18nManager.isRTL stays false even after the call. Reloading in that
    // case creates an infinite reload loop. We only reload when the native
    // layer actually accepted the change (production / dev-client).
    // For Expo Go the root View's `direction` style prop handles RTL layout.
    if (I18nManager.isRTL === wantRtl) {
      setTimeout(reloadApp, 300);
    }
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
  LocaleConfig.defaultLocale = language;

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
