import { create } from 'zustand';
import type {
  VoiceMessage,
  VoiceProcessResponse,
  VoiceRecordingState,
} from '../../../core/domain/voice';
import i18n from '../../../core/i18n/init';
import { processVoiceMessage } from '../api/voiceRepository';
import { useAuthStore } from '../../auth/store/useAuthStore';

type PendingAuthData = {
  nationalId?: string;
  phoneNumber?: string;
  fullName?: string;
};

type VoiceState = {
  isOpen: boolean;
  sessionId: string | null;
  voiceMode: 'speaker' | 'earpiece';
  messages: VoiceMessage[];
  recordingState: VoiceRecordingState;
  error: string | null;
  setSessionId: (sessionId: string | null) => void;
  setVoiceMode: (mode: 'speaker' | 'earpiece') => void;

  authTriggeredByVoice: boolean;
  pendingAuthData: PendingAuthData | null;

  addAssistantMessage: (text: string) => void;

  shouldResumeListening: boolean;
  setShouldResumeListening: (v: boolean) => void;

  pendingReopenAfterAuth: boolean;
  setPendingReopenAfterAuth: (v: boolean) => void;

  setIsOpen: (open: boolean) => void;
  setRecordingState: (state: VoiceRecordingState) => void;
  clear: () => void;
  processMessage: (message: string) => Promise<VoiceProcessResponse>;
  setAuthTriggeredByVoice: (triggered: boolean) => void;
  setPendingAuthData: (data: PendingAuthData | null) => void;
};


function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Decide which auth field should be sent based on backend message text
 */
function pickAuthValue(
  message: string,
  data: PendingAuthData,
): string | null {
  const m = message;

  if (m.includes('رقم هويتك') && data.nationalId) {
    return data.nationalId;
  }

  if (m.includes('رقم تلفونك') && data.phoneNumber) {
    return data.phoneNumber;
  }

  if (m.includes('اسمك') && data.fullName) {
    return data.fullName;
  }

  return null;
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  isOpen: false,
  sessionId: null,
  voiceMode: 'speaker',
  messages: [],
  recordingState: 'idle',
  error: null,

  shouldResumeListening: false,
  setShouldResumeListening: (v) =>
    set({ shouldResumeListening: v }),
  setSessionId: (sessionId) => set({ sessionId }),
  setVoiceMode: (mode) => set({ voiceMode: mode }),

  pendingReopenAfterAuth: false,
  setPendingReopenAfterAuth: (v) => set({ pendingReopenAfterAuth: v }),

  authTriggeredByVoice: false,
  pendingAuthData: null,

  setIsOpen: (open) => set({ isOpen: open, error: null }),
  setRecordingState: (state) => set({ recordingState: state }),

  clear: () =>
    set({
      sessionId: null,
      voiceMode: 'speaker',
      messages: [],
      recordingState: 'idle',
      error: null,
      authTriggeredByVoice: false,
      pendingAuthData: null,
      pendingReopenAfterAuth: false,
      shouldResumeListening: false,
    }),

  setAuthTriggeredByVoice: (triggered) =>
    set({ authTriggeredByVoice: triggered }),

  setPendingAuthData: (data) => set({ pendingAuthData: data }),
  addAssistantMessage: (text: string) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: makeId('ast'),
          role: 'assistant',
          text,
          createdAt: Date.now(),
        },
      ],
    })),

  processMessage: async (message: string) => {
    // Check token validity before processing voice message
    const authStore = useAuthStore.getState();
    if (authStore.authStatus === 'authenticated' && authStore.token) {
      // Validate token before voice interaction
      const isTokenValid = await authStore.validateToken();
      if (!isTokenValid) {
        console.log('Token validation failed before voice interaction');
        // Token was invalid and user has been logged out
        // Voice request will proceed without token, backend should handle IDENTITY stage
      }
    }

    const trimmed = String(message ?? '').trim();
    const userMsg: VoiceMessage | null = trimmed
      ? {
        id: makeId('usr'),
        role: 'user',
        text: trimmed,
        createdAt: Date.now(),
      }
      : null;

    if (userMsg) {
      set((s) => ({
        messages: [...s.messages, userMsg],
        recordingState: 'processing',
        error: null,
      }));
    }

    try {
      const res = await processVoiceMessage(
        trimmed,
        get().sessionId ?? undefined,
      );

      const assistantMsg: VoiceMessage = {
        id: makeId('ast'),
        role: 'assistant',
        text: res.message,
        createdAt: Date.now(),
      };

      set((s) => ({
        sessionId: res.sessionId,
        messages: [...s.messages, assistantMsg],
        recordingState: 'idle',
        error: null,
      }));

      /**
       * 🔥 AUTO-REPLY LOGIC (CORE FIX)
       */
      const { pendingAuthData, authTriggeredByVoice } = get();

      if (
        authTriggeredByVoice &&
        pendingAuthData &&
        res.stage === 'IDENTITY'
      ) {
        const value = pickAuthValue(
          res.message,
          pendingAuthData,
        );

        if (value) {
          console.log('🤖 Auto-replying to voice with:', value);

          // remove used field to avoid duplicates
          set({
            pendingAuthData: {
              ...pendingAuthData,
              ...(value === pendingAuthData.nationalId
                ? { nationalId: undefined }
                : {}),
              ...(value === pendingAuthData.phoneNumber
                ? { phoneNumber: undefined }
                : {}),
              ...(value === pendingAuthData.fullName
                ? { fullName: undefined }
                : {}),
            },
          });

          // send next message automatically
          await get().processMessage(value);
        }
      }

      // if we reached SERVICE stage → auth flow is done
      if (res.stage === 'SERVICE') {
        set({
          authTriggeredByVoice: false,
          pendingAuthData: null,
        });
      }

      return res;
    } catch (e: any) {
      set({
        recordingState: 'error',
        error:
          typeof e?.message === 'string' && e.message.trim()
            ? e.message
            : i18n.t('voice.genericError'),
      });

      return {
        ok: false,
        sessionId: get().sessionId ?? `voice_session_${Date.now()}`,
        stage: 'SERVICE',
        message: i18n.t('voice.assistantFallback'),
      };

    }
  },
}));
