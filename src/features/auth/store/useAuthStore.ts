import { create } from 'zustand';
import { StorageKeys } from '../../../core/storage/keys';
import {
  getSecureItem,
  removeSecureItem,
  setSecureItem,
} from '../../../core/storage/secureStorage';
import type { User } from '../../../core/domain/user';
import { useVoiceStore } from '../../voice/store/useVoiceStore';
import * as authRepo from '../api/authRepository';
import { setSessionToken } from '../../../core/auth/session';
import { useProfileStore } from '../../profile/store/useProfileStore';
import { processVoiceMessage } from '../../voice/api/voiceRepository';
import { getApiBaseUrl } from '../../../core/api/axiosClient';
import { startRecording } from '../../voice/useVoiceRecorder';
import { playTts } from '../../voice/components/VoiceAssistantSheet';

export type AuthStatus = 'hydrating' | 'anonymous' | 'authenticated';

type AuthState = {
  authStatus: AuthStatus;
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  hasBootstrapped: boolean;
  collectedAuthData: {
    nationalId?: string;
    phoneNumber?: string;
    fullName?: string;
    otp?: string;
  } | null;
  setToken: (token: string | null) => void;
  setAuthStatus: (status: AuthStatus) => void;
  bootstrap: () => Promise<void>;
  requestLoginOtp: (nationalId: string, phoneNumber: string) => Promise<authRepo.RequestOtpResponse>;
  requestSignupOtp: (nationalId: string, phoneNumber: string, fullName: string) => Promise<authRepo.RequestOtpResponse>;
  verifyOtp: (phoneNumber: string, otp: string) => Promise<authRepo.VerifyOtpResponse>;
  signOut: () => Promise<void>;
  setCollectedAuthData: (data: any) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  authStatus: 'hydrating',
  token: null,
  user: null,
  isLoading: false,
  error: null,
  hasBootstrapped: false,
  collectedAuthData: null,

  setToken: (token) => {
    setSessionToken(token);
    set({ token });
  },

  setAuthStatus: (authStatus) => set({ authStatus }),

  bootstrap: async () => {
    try {
      set({ authStatus: 'hydrating', error: null });
      const token = await getSecureItem(StorageKeys.authToken);
      const userRaw = await getSecureItem(StorageKeys.authUser);
      let user: User | null = null;
      if (userRaw) {
        try {
          user = JSON.parse(userRaw) as User;
        } catch {
          user = null;
        }
      }
      setSessionToken(token ?? null);
      set({
        token: token ?? null,
        user,
        authStatus: token ? 'authenticated' : 'anonymous',
        hasBootstrapped: true,
      });
    } catch (e: any) {
      set({
        token: null,
        authStatus: 'anonymous',
        user: null,
        hasBootstrapped: true,
        error: e?.message ?? 'Storage unavailable',
      });
      setSessionToken(null);
    }
  },

  requestLoginOtp: async (nationalId, phoneNumber) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authRepo.requestLoginOtp(nationalId, phoneNumber);
      // Store collected auth data
      set({ collectedAuthData: { nationalId, phoneNumber } });
      set({ isLoading: false });
      return res;
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? 'Request failed' });
      throw e;
    }
  },

  requestSignupOtp: async (nationalId, phoneNumber, fullName) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authRepo.requestSignupOtp(nationalId, phoneNumber, fullName);
      // Store collected auth data
      set({ collectedAuthData: { nationalId, phoneNumber, fullName } });
      set({ isLoading: false });
      return res;
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? 'Request failed' });
      throw e;
    }
  },

  verifyOtp: async (phoneNumber, otp) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authRepo.verifyOtp(phoneNumber, otp);
      await setSecureItem(StorageKeys.authToken, res.token);
      await setSecureItem(StorageKeys.authUser, JSON.stringify(res.user));
      setSessionToken(res.token);
      
      // Update collected auth data with OTP
      const currentData = get().collectedAuthData;
      if (currentData) {
        const updated = { ...currentData, otp };
        set({ collectedAuthData: updated });

        const voiceStore = useVoiceStore.getState();
        if (voiceStore.authTriggeredByVoice) {
          voiceStore.setPendingAuthData(updated);
        }
      }
      set({
        token: res.token,
        user: res.user,
        authStatus: 'authenticated',
        hasBootstrapped: true,
        isLoading: false,
      });

      const voiceStore = useVoiceStore.getState();

      console.log("AUTH SUCCESS → SYNC WITH DECISION", {
        sessionId: voiceStore.sessionId,
        hasToken: !!res.token,
      });
      const API_BASE = getApiBaseUrl();
      if (voiceStore.sessionId && res.token) {
        const url = `${API_BASE}/decision/auth/sync`;

        console.log("[AUTH→DECISION] preparing sync", {
          url,
          sessionId: voiceStore.sessionId,
          tokenLength: res.token.length,
        });

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: voiceStore.sessionId,
            authToken: res.token,
          }),
        });

        console.log("[AUTH→DECISION] response status", response.status);

        const rawText = await response.text();
        console.log(" [AUTH→DECISION] response body", rawText);

        let decision: any;
        try {
          decision = JSON.parse(rawText);
        } catch (e) {
          console.error("❌ Failed to parse decision response", e);
          throw new Error("Invalid decision response from /auth/sync");
        }

        // DEBUG 
        console.log("[AUTH→DECISION] parsed", {
          stage: decision?.stage,
          message: decision?.message,
          sessionId: decision?.sessionId,
        });

        if (decision.audioBase64) {
          const voice = useVoiceStore.getState();

          voice.setRecordingState("playing");
          await playTts(decision.audioBase64);
          voice.setRecordingState("idle");
          voice.setShouldResumeListening(true);
        }
      }

      // Keep profile name in sync with backend user.
      const name = (res.user as any)?.fullName;
      if (typeof name === 'string' && name.trim()) {
        await useProfileStore.getState().setFullName(name.trim());
      }

      return res;
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? 'Verification failed' });
      throw e;
    }
  },

  signOut: async () => {
    await removeSecureItem(StorageKeys.authToken);
    await removeSecureItem(StorageKeys.authUser);
    setSessionToken(null);
    set({ token: null, user: null, authStatus: 'anonymous', hasBootstrapped: true, collectedAuthData: null });
  },

  setCollectedAuthData: (data) => set({ collectedAuthData: data }),
}));

export function isVerified(): boolean {
  return useAuthStore.getState().authStatus === 'authenticated';
}
