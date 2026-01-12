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
import { getApiBaseUrl, getApiClient } from '../../../core/api/axiosClient';
import { startRecording } from '../../voice/useVoiceRecorder';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
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
  validateToken: () => Promise<boolean>;
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

      // If we have a token, validate it with the backend
      if (token) {
        try {
          // Make a lightweight API call to validate the token
          // Using a simple endpoint that requires authentication
          const client = getApiClient();
          setSessionToken(token); // Temporarily set token for validation request
          await client.get('/me/notifications'); // Lightweight auth check

          // Token is valid
          setSessionToken(token);
          set({
            token: token,
            user,
            authStatus: 'authenticated',
            hasBootstrapped: true,
          });

          // Create sessionId for voice system if authentication is restored
          const voiceStore = useVoiceStore.getState();
          if (!voiceStore.sessionId) {
            const sessionId = makeId('voice_session');
            voiceStore.setSessionId(sessionId);
            console.log("BOOTSTRAP → CREATED SESSION FOR RESTORED AUTH", { sessionId });
          }
        } catch (validationError: any) {
          // Token is invalid/expired - clear it
          console.log('Token validation failed on bootstrap:', validationError?.message);
          await removeSecureItem(StorageKeys.authToken);
          await removeSecureItem(StorageKeys.authUser);
          setSessionToken(null);
          set({
            token: null,
            user: null,
            authStatus: 'anonymous',
            hasBootstrapped: true,
          });
        }
      } else {
        // No token stored
        setSessionToken(null);
        set({
          token: null,
          user: null,
          authStatus: 'anonymous',
          hasBootstrapped: true,
        });
      }
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

      // Create sessionId if it doesn't exist (for app-based authentication)
      let sessionId = voiceStore.sessionId;
      if (!sessionId) {
        sessionId = makeId('voice_session');
        voiceStore.setSessionId(sessionId);
        console.log("AUTH SUCCESS → CREATED NEW SESSION", { sessionId });
      }

      console.log("AUTH SUCCESS → SYNC WITH DECISION", {
        sessionId,
        hasToken: !!res.token,
      });
      const API_BASE = getApiBaseUrl();
      if (sessionId && res.token) {
        const url = `${API_BASE}/decision/auth/sync`;

        console.log("[AUTH→DECISION] preparing sync", {
          url,
          sessionId,
          tokenLength: res.token.length,
        });

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
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

          // Only play audio if voice interface is actually open
          if (voice.isOpen) {
            voice.setRecordingState("playing");
            await playTts(decision.audioBase64);
            voice.setRecordingState("idle");
            voice.setShouldResumeListening(true);
          } else {
            console.log("[AUTH→DECISION] Skipping audio playback - voice interface not open");
          }
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

    // Terminate any active voice session
    const voiceStore = useVoiceStore.getState();
    if (voiceStore.sessionId) {
      voiceStore.clear();
    }

    set({ token: null, user: null, authStatus: 'anonymous', hasBootstrapped: true, collectedAuthData: null });
  },

  // Validate token with backend (can be called before voice interactions)
  validateToken: async (): Promise<boolean> => {
    const token = get().token;
    if (!token) return false;

    try {
      const client = getApiClient();
      await client.get('/me/notifications'); // Lightweight auth check
      return true;
    } catch (error) {
      // Token is invalid - trigger logout
      await get().signOut();
      return false;
    }
  },

  setCollectedAuthData: (data) => set({ collectedAuthData: data }),
}));

export function isVerified(): boolean {
  return useAuthStore.getState().authStatus === 'authenticated';
}
