import * as FileSystem from "expo-file-system/legacy";

const API_URL = "http://10.0.0.46:4000/voice/stt";

export type VoiceDecisionResponse = {
  ok: boolean;
  sessionId: string;          
  stage: string;
  message: string;
  audioBase64?: string;
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
