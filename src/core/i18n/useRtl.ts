import { useTranslation } from 'react-i18next';

/**
 * Reactive hook for UI direction.
 *
 * Subscribes to i18n language changes through useTranslation(), so every
 * component using this hook re-renders automatically when the user switches
 * language — even before the optional app reload takes effect.
 *
 * This is the single source of truth for RTL/LTR in all UI components.
 * Do NOT read I18nManager.isRTL inside components; use this hook instead.
 */
export function useRtl(): { isRtl: boolean } {
  const { i18n } = useTranslation();
  const isRtl = i18n.dir(i18n.resolvedLanguage || i18n.language) === 'rtl';
  return { isRtl };
}
