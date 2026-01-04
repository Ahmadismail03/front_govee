import axios, { type AxiosInstance } from 'axios';
import { getSecureItem, peekSecureItem } from '../storage/secureStorage';
import { StorageKeys } from '../storage/keys';
import { mockAdapter } from '../../mocks/mockAdapter';
import { getCurrentLanguage } from '../i18n/init';
import { getSessionToken } from '../auth/session';

let realClient: AxiosInstance | null = null;
let mockClient: AxiosInstance | null = null;

function getApiBaseUrl(): string {
  // Expo: define in app env as EXPO_PUBLIC_API_BASE_URL
  // Examples:
  // - Android emulator: http://10.0.2.2:4000
  // - iOS simulator: http://localhost:4000
  // - Physical device: http://<your-lan-ip>:4000
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
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

      if (backendMsg && typeof backendMsg === 'string') {
        error.message = backendMsg;
      } else if (status === 401) {
        error.message = 'Session expired. Please sign in again.';
      } else if (status === 409) {
        error.message = 'Request could not be completed due to a conflict. Please review your input and try again.';
      } else if (!error?.response) {
        error.message = 'Network error. Please check your connection and try again.';
      }

      // Convert noisy DB errors into a user-friendly message.
      if (
        status === 409 &&
        typeof error?.message === 'string' &&
        error.message.toLowerCase().includes('unique') &&
        error.message.toLowerCase().includes('email')
      ) {
        error.message = 'This email is already used by another account.';
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
    baseURL: 'https://mock.smartgov.local',
    timeout: 15000,
    adapter: mockAdapter,
  });

  attachRequestInterceptors(mockClient);
  attachResponseInterceptors(mockClient);
  return mockClient;
}
