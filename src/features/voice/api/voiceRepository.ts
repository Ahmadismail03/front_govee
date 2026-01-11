// voiceRepository.ts
import { getApiClient } from '../../../core/api/axiosClient';
import type { VoiceProcessResponse } from '../../../core/domain/voice';
import i18n from '../../../core/i18n/init';

export async function processVoiceMessage(
  text: string,
  sessionId?: string
): Promise<VoiceProcessResponse> {
  const client = getApiClient();

  try {
 console.log("VOICE API OUT", { text, sessionId });
const { data } = await client.post<VoiceProcessResponse>('/decision/next', {
  text,
  sessionId,
});
console.log("VOICE API IN", data);
return data;

  } catch (e: any) {
    // Frontend-resilient fallback (must match VoiceProcessResponse shape)
    return {
      ok: false,
      sessionId: sessionId ?? `voice_session_${Date.now()}`,
      stage: 'SERVICE',
      message: i18n.t('voice.assistantFallback'),
    };
  }

}
