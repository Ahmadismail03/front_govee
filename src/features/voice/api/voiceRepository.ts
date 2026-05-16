// voiceRepository.ts
import { getApiClient } from '../../../core/api/axiosClient';
import type { VoiceProcessResponse } from '../../../core/domain/voice';

export async function processVoiceMessage(
  text: string,
  sessionId?: string
): Promise<VoiceProcessResponse> {
  const client = getApiClient();

  try {
    console.log("VOICE API OUT", { text, sessionId });

    const { data } = await client.post<VoiceProcessResponse>(
      '/decision/next',
      {
        text,
        sessionId,
      }
    );

    console.log("VOICE API IN", data.message, data.stage);

    return data;

  } catch (e: any) {

    console.error("VOICE REQUEST FAILED");
    console.error("MESSAGE:", e?.message);
    console.error("CODE:", e?.code);
    console.error("STATUS:", e?.response?.status);
    console.error("DATA:", e?.response?.data);
    console.error("FULL:", JSON.stringify(e, null, 2));

    throw e;

    // احذفي fallback مؤقتًا للتشخيص
  }
}