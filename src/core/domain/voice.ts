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
  /** HTTP URL to stream/download MP3 audio instead of base64 in JSON */
  audioUrl?: string;
  /** Base64-encoded MP3 audio (legacy, for backward compatibility) */
  audioBase64?: string;
  /** Whether the audio should play through speaker or earpiece */
  voiceOutputMode?: 'speaker' | 'earpiece';
  /** Terminal voice flow that must end the session after playback finishes */
  terminalIntent?: 'THANKS';
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
