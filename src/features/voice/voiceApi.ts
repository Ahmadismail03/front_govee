import * as FileSystem from "expo-file-system/legacy";
import { getApiClient } from "../../core/api/axiosClient";

const API_URL = `${process.env.EXPO_PUBLIC_API_BASE_URL}/voice/stt`;

export type VoiceDecisionResponse = {
  ok: boolean;
  sessionId: string;          
  stage: string;
  message: string;
  audioBase64?: string;
  voiceOutputMode?: string;
};

export async function sendVoice(
  uri: string,
  sessionId: string           
): Promise<VoiceDecisionResponse> {

  const url =
    sessionId && sessionId.trim()
      ? `${API_URL}?sessionId=${encodeURIComponent(sessionId)}`
      : API_URL;

  const response = await FileSystem.uploadAsync(url, uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": "audio/wav",
    },
  });

  return JSON.parse(response.body) as VoiceDecisionResponse;
}

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
