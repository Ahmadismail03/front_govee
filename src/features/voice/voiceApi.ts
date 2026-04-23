import { getApiClient } from "../../core/api/axiosClient";

export type VoiceDecisionResponse = {
  ok: boolean;
  sessionId: string;
  stage: string;
  message: string;
  audioBase64?: string;
  voiceOutputMode?: string;
};

/**
 * Update voice output mode (speaker/earpiece) on backend
 */
export async function updateVoiceMode(
  sessionId: string,
  mode: 'speaker' | 'earpiece'
): Promise<{ ok: boolean; mode: string }> {
  const client = getApiClient();
  const response = await client.patch('/voice/mode', {
    sessionId,
    mode,
  });
  return response.data;
}

/**
 * Mark a voice session as COMPLETED on backend
 */
export async function completeVoiceSession(
  sessionId: string
): Promise<{ ok: boolean }> {
  const client = getApiClient();
  const response = await client.patch('/voice/complete', { sessionId });
  return response.data;
}

/**
 * Create a new voice session in the DB immediately when screen opens.
 * Uses upsert on backend so safe to call multiple times.
 */
export async function createVoiceSession(
  sessionId: string
): Promise<{ ok: boolean; sessionId: string }> {
  const client = getApiClient();
  const response = await client.post('/voice/session', { sessionId });
  return response.data;
}
