import axios, { type AxiosInstance } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getSecureItem, peekSecureItem } from '../storage/secureStorage';
import { StorageKeys } from '../storage/keys';
import { mockAdapter } from '../../mocks/mockAdapter';
import i18n, { getCurrentLanguage } from '../i18n/init';
import { getSessionToken } from '../auth/session';
import { handleTokenExpiration } from '../auth/authUtils';

let realClient: AxiosInstance | null = null;
let mockClient: AxiosInstance | null = null;

function getExpoHostIp(): string | null {
  const hostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  const debuggerHost = (Constants as any)?.manifest2?.extra?.expoGo?.debuggerHost as string | undefined;
  const candidate = hostUri ?? debuggerHost;
  if (!candidate) return null;
  const host = candidate.split(':')[0]?.trim();
  if (!host) return null;
  return host;
}

export function getApiBaseUrl(): string {
  // Priority 1: Use .env file if set and valid for current platform
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envBaseUrl) {
    // 10.0.2.2 only works on Android emulator, never iOS/physical devices.
    const isAndroidEmulatorOnlyHost = envBaseUrl.includes('10.0.2.2');
    if (!(Platform.OS === 'ios' && isAndroidEmulatorOnlyHost)) {
      return envBaseUrl;
    }
  }

  // Priority 2: If running in Expo Go, derive host machine IP dynamically.
  const expoHostIp = getExpoHostIp();
  if (expoHostIp) {
    return `http://${expoHostIp}:4000`;
  }

  // Priority 3: Auto-detect for emulators/simulators
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }
  if (Platform.OS === 'ios') {
    return 'http://localhost:4000';
  }

  // Priority 4: Last fallback for physical devices
  return 'http://192.168.1.2:4000';
}

function attachRequestInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use(async (config) => {
    const token =
      getSessionToken() ??
      peekSecureItem(StorageKeys.authToken) ??
      (await getSecureItem(StorageKeys.authToken));
    (config.headers as any) = config.headers ?? {};
    (config.headers as any)['x-locale'] = getCurrentLanguage();
    if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

function attachResponseInterceptors(client: AxiosInstance): void {
  client.interceptors.response.use(
    (res) => res,
    (error) => {
      const status = error?.response?.status;
      const backendMsg = error?.response?.data?.message;
      const method = String(error?.config?.method ?? '').toLowerCase();
      const url = String(error?.config?.url ?? '');
      const lng = getCurrentLanguage();
      const isArabicUi = lng === 'ar';

      const isArabicText = (value: unknown): boolean =>
        typeof value === 'string' && /[\u0600-\u06FF]/.test(value);

      const t = i18n.t.bind(i18n);

      // Handle token expiration (401) - logout and terminate voice sessions
      if (status === 401) {
        handleTokenExpiration();
        error.message = t('common.sessionExpired');
        return Promise.reject(error);
      }

      // Endpoint-specific conflicts we can localize reliably.
      if (status === 409 && method === 'post' && /\/appointments\/?$/.test(url)) {
        error.message = t('booking.errors.duplicateUpcomingAppointment');
        return Promise.reject(error);
      }

      if (status === 409 && /\/me\/reminder-settings\/?$/.test(url)) {
        error.message = t('preferences.reminderEmailAlreadyUsed');
        return Promise.reject(error);
      }

      // Prefer backend message only when it matches the current UI language direction.
      if (backendMsg && typeof backendMsg === 'string') {
        const backendLooksArabic = isArabicText(backendMsg);
        const languageMatches = isArabicUi ? backendLooksArabic : !backendLooksArabic;
        if (languageMatches) {
          error.message = backendMsg;
          return Promise.reject(error);
        }
      }

      // Generic fallbacks (always localized)
      if (status === 409) {
        error.message = t('common.conflictError');
      } else if (!error?.response) {
        error.message = t('common.networkError');
      } else {
        error.message = t('common.genericError');
      }
      return Promise.reject(error);
    }
  );
}

export function getApiClient(): AxiosInstance {
  if (realClient) return realClient;

  realClient = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 15000,
  });

  attachRequestInterceptors(realClient);
  attachResponseInterceptors(realClient);
  return realClient;
}

export function getMockApiClient(): AxiosInstance {
  if (mockClient) return mockClient;

  mockClient = axios.create({
    baseURL: 'https://mock.SpeakGov.local',
    timeout: 15000,
    adapter: mockAdapter,
  });

  attachRequestInterceptors(mockClient);
  attachResponseInterceptors(mockClient);
  return mockClient;
}
