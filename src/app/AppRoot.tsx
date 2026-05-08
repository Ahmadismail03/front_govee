import { Buffer } from "buffer";
(global as any).Buffer = Buffer;
import { enableScreens } from 'react-native-screens';
import * as SplashScreen from 'expo-splash-screen';
import { initI18n } from '../core/i18n/init';
import { RootNavigator } from '../navigation/RootNavigator';
import { LaunchScreen } from '../shared/ui/LaunchScreen';
import { useAuthStore } from '../features/auth/store/useAuthStore';
import { ErrorView } from '../shared/ui/ErrorView';
import { useThemeStore } from '../core/theme/useThemeStore';
import { useLanguageChangeStore } from '../core/i18n/store/useLanguageChangeStore';
import { useEffect, useState } from "react";
import { hasCompletedOnboarding } from '../features/onboarding/storage/onboardingStorage';

enableScreens();
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if splash is already controlled elsewhere.
});

export function AppRoot() {
  const [booted, setBooted] = useState(false);
  const [showLaunch, setShowLaunch] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const isLanguageChanging = useLanguageChangeStore((s) => s.isChanging);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (mounted) {
          setBooted(false);
          setBootError(null);
        }

        await initI18n();
        await useAuthStore.getState().bootstrap();
        await useThemeStore.getState().bootstrap();
        const completed = await hasCompletedOnboarding();
        if (mounted) setOnboardingDone(completed);
      } catch (e: any) {
        if (mounted) setBootError(e?.message ?? 'Failed to start app');
      } finally {
        if (mounted) setBooted(true);
      }
    })().catch((e: any) => {
      if (mounted) {
        setBootError(e?.message ?? 'Failed to start app');
        setBooted(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [attempt]);

  const appReady = booted && (onboardingDone !== null || bootError !== null);

  useEffect(() => {
    if (!appReady) return;
    SplashScreen.hideAsync().catch(() => {
      // Ignore hide errors in dev/reload races.
    });
  }, [appReady]);

  if (!appReady) return null;

  // Show launch screen after app bootstrap, while language is changing.
  if (showLaunch || isLanguageChanging) {
    return <LaunchScreen onFinish={() => {
      setShowLaunch(false);
      useLanguageChangeStore.getState().setIsChanging(false);
    }} />;
  }

  if (bootError) return <ErrorView message={bootError} onRetry={() => setAttempt((x) => x + 1)} />;
  return <RootNavigator initialRouteName={onboardingDone ? 'MainTabs' : 'Onboarding'} />;
}
