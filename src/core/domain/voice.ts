// core/domain/voice.ts

/**
 * Possible actions that the voice assistant can trigger on the app
 */
export type VoiceAction =
  | {
    type: 'navigate';
    screen: string;
    params?: unknown;
  }
  | undefined;

/**
 * Request sent to the voice backend
 */
export type VoiceProcessRequest = {
  message: string;
  sessionId?: string;
};

/**
 * Conversation stages returned by the backend
 * (must stay in sync with /decision/next)
 */
export type VoiceStage =
  | 'IDENTITY'
  | 'SERVICE'
  | 'DATE'
  | 'TIME'
  | 'CONFIRM';

/**
 * Response returned from the voice backend
 */
export type VoiceProcessResponse = {
  ok: boolean;
  sessionId: string;
  stage: VoiceStage;
  message: string;
  action?: Exclude<VoiceAction, undefined>;
};

/**
 * Message shown in the chat UI
 */
export type VoiceMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
};

/**
 * Recording / playback state of the voice UI
 */
export type VoiceRecordingState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'playing'
  | 'error';
