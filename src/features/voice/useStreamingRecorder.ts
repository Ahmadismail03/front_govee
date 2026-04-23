// useStreamingRecorder.ts
// Real-time streaming audio recorder for Arabic voice assistant.
//
// Audio lifecycle (per turn):
//   startStreaming() → WS opens → server sends 'ready' → mic starts → chunks flow
//   final transcript received → stopStreaming() called immediately
//   → mic stops, WS closed → onFinalTranscript() callback fires
//   → processMessage() + TTS → startStreaming() can begin a fresh turn
//
// Guard system:
//   isStreamingRef  — true from mic-start until stopStreaming() is called
//   isStoppingRef   — true from stopStreaming() until WS onclose fires
//   startStreaming() is blocked while EITHER ref is true
//   connectionIdRef — monotonic ID stamped on each WS open; prevents stale
//                     onclose/onerror handlers from corrupting a new connection

import { useRef, useState, useCallback } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import LiveAudioStream from "react-native-live-audio-stream";

// ─── Short Arabic phrases → stop immediately on final transcript ──────────────
const SHORT_PHRASE_SHORTCUTS = new Set([
  "نعم", "لا", "أيوه", "ايوه", "آه", "اه", "أه",
  "موافق", "صح", "غلط", "بدي", "ما بدي",
  "تمام", "ماشي", "حسناً", "حسنا", "شكراً", "شكرا",
]);

function isShortPhrase(text: string): boolean {
  const t = text.trim().replace(/[.،!؟]$/, "");
  return SHORT_PHRASE_SHORTCUTS.has(t);
}

// ─── Audio capture config ─────────────────────────────────────────────────────
const AUDIO_OPTIONS = {
  sampleRate: 16000,
  channels: 1,
  bitsPerSample: 16,
  audioSource: 6,       // Android: VOICE_RECOGNITION — cleaner than raw MIC
  bufferSize: 4096,     // ≈ 128 ms chunk at 16 kHz / 16-bit / mono
  wavFile: "streaming_stt_temp.wav", // required by the lib's type; not used
};

// ─── Hook types ───────────────────────────────────────────────────────────────

interface UseStreamingRecorderOptions {
  sessionId: string | null;
  wsBaseUrl: string;
  onFinalTranscript: (transcript: string) => void;
  onPartialTranscript?: (transcript: string) => void;
  onError?: (message: string) => void;
  onReady?: () => void;
}

interface UseStreamingRecorderResult {
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  isStreaming: boolean;
  partialTranscript: string;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useStreamingRecorder({
  sessionId,
  wsBaseUrl,
  onFinalTranscript,
  onPartialTranscript,
  onError,
  onReady,
}: UseStreamingRecorderOptions): UseStreamingRecorderResult {

  // ── Refs (stable across renders, readable synchronously) ──────────────────
  const wsRef            = useRef<WebSocket | null>(null);
  const isStreamingRef   = useRef(false); // true while mic + WS are both active
  const isStoppingRef    = useRef(false); // true while stopStreaming teardown is in flight
  const connectionIdRef  = useRef(0);     // incremented on every new connection

  // ── React state (for UI re-renders only) ──────────────────────────────────
  const [isStreaming,     setIsStreaming]     = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");

  // ── Mic permission ─────────────────────────────────────────────────────────
  async function requestMicPermission(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "إذن الميكروفون",
        message: "يحتاج التطبيق إلى الوصول إلى الميكروفون للتعرف على الكلام",
        buttonPositive: "موافق",
        buttonNegative: "رفض",
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  // ── Internal hard-stop (safe to call from any context including WS handlers)
  // Does NOT guard on isStreamingRef so it can clean up partial starts too.
  function _hardStop(reason: string) {
    console.log(`🎙️ [hardStop] reason="${reason}"`);

    // Update guards FIRST so no re-entrant start can slip through
    isStreamingRef.current = false;
    isStoppingRef.current  = true;  // will be cleared in onclose

    setIsStreaming(false);
    setPartialTranscript("");

    // Stop mic capture
    try { LiveAudioStream.stop(); } catch { /* ignore */ }

    // Close WS gracefully
    const ws = wsRef.current;
    wsRef.current = null; // detach immediately so new connections don't collide
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "STOP" }));
        ws.close(1000, reason);
      } catch { /* ignore */ }
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      try { ws.close(); } catch { /* ignore */ }
    }
  }

  // ── Public stopStreaming ───────────────────────────────────────────────────
  const stopStreaming = useCallback(() => {
    if (!isStreamingRef.current && !isStoppingRef.current) {
      // Nothing is running — nothing to stop
      return;
    }
    _hardStop("explicit stop");
  }, []);

  // ── Public startStreaming ──────────────────────────────────────────────────
  const startStreaming = useCallback(async () => {
    // ── Guards ──────────────────────────────────────────────────────────────
    if (isStreamingRef.current) {
      console.warn("⚠️ startStreaming: already streaming — ignored");
      return;
    }
    if (isStoppingRef.current) {
      console.warn("⚠️ startStreaming: previous stream still stopping — ignored");
      return;
    }

    if (!sessionId) {
      console.warn("🎙️ startStreaming: no sessionId");
      onError?.("لا يوجد جلسة صوتية");
      return;
    }

    const hasPerm = await requestMicPermission();
    if (!hasPerm) {
      console.warn("🎙️ Microphone permission denied");
      onError?.("تم رفض إذن الميكروفون");
      return;
    }

    // Stamp this connection with a unique ID so stale handlers can self-discard
    const myConnectionId = ++connectionIdRef.current;

    // ── Shared state for the VAD / timeout handshake ─────────────────────────
    // Must live here (not inside onmessage) so every WS message callback
    // shares the SAME closure variables — not fresh copies per message.
    let finalReceived = false;
    let endAudioTimeoutId: number | null = null;

    const wsUrl = `${wsBaseUrl}/voice/stream?sessionId=${encodeURIComponent(sessionId)}`;
    console.log(`🔌 Connecting WebSocket (conn #${myConnectionId}): ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    wsRef.current  = ws;
    ws.binaryType  = "arraybuffer";

    // ── onopen: just log — wait for 'ready' message from server ─────────────
    ws.onopen = () => {
      if (myConnectionId !== connectionIdRef.current) return; // stale
      console.log(`✅ WebSocket open (conn #${myConnectionId})`);
    };

    // ── onmessage ─────────────────────────────────────────────────────────────
    ws.onmessage = (event) => {
      if (myConnectionId !== connectionIdRef.current) return; // stale connection
      if (typeof event.data !== "string") return;

      try {
        const msg = JSON.parse(event.data) as {
          type: "ready" | "partial" | "final" | "error";
          transcript?: string;
          message?: string;
        };

        switch (msg.type) {

          case "ready":
            // Mark as streaming BEFORE calling onReady so that when onReady
            // triggers setRecordingState('listening'), isStreaming is already
            // true — preventing the safety-net effect from immediately resetting
            // the UI back to 'idle'.
            isStreamingRef.current = true;
            setIsStreaming(true);
            console.log(`🎙️ STT ready (conn #${myConnectionId}) — starting mic`);
            onReady?.();

            // ── RMS-based frontend VAD ──────────────────────────────────────
            // After speech is detected (RMS > SPEECH_THRESHOLD), count
            // consecutive silent chunks. If silence persists for SILENCE_CHUNKS
            // windows (≈ 640 ms), stop the mic and send END_AUDIO to the server.
            //
            // IMPORTANT: we do NOT close the WebSocket here. Keeping it open
            // lets the server call recognizeStream.end(), which causes Google
            // to emit the final transcript. The normal 'final' handler then
            // calls _hardStop + onFinalTranscript → UI transitions correctly.
            const SPEECH_THRESHOLD  = 350; // 16-bit RMS ≈ ~1% of full scale
            const SILENCE_CHUNKS    = 5;   // 5 × 128 ms ≈ 640 ms silence
            const MIN_SPEECH_CHUNKS = 3;   // require 3 speech chunks before VAD arms
            let speechChunkCount = 0;
            let silenceChunkCount = 0;
            let vadFired = false;          // prevent re-entry after mic is stopped

            LiveAudioStream.init(AUDIO_OPTIONS);
            LiveAudioStream.on("data", (base64Chunk: string) => {
              if (vadFired) return;
              if (myConnectionId !== connectionIdRef.current) return;
              if (!isStreamingRef.current) return;
              const currentWs = wsRef.current;
              if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;

              // Decode base64 → Int16 PCM samples
              const binaryStr = atob(base64Chunk);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }

              // ── RMS amplitude ─────────────────────────────────────────────
              const samples = new Int16Array(bytes.buffer);
              let sumSq = 0;
              for (let i = 0; i < samples.length; i++) sumSq += samples[i] * samples[i];
              const rms = Math.sqrt(sumSq / samples.length);

              if (rms >= SPEECH_THRESHOLD) {
                speechChunkCount++;
                silenceChunkCount = 0;
              } else if (speechChunkCount >= MIN_SPEECH_CHUNKS) {
                silenceChunkCount++;
                if (silenceChunkCount >= SILENCE_CHUNKS) {
                  vadFired = true;
                  console.log(
                    `🔇 VAD silence (${silenceChunkCount} chunks after ${speechChunkCount} speech)` +
                    ` — stopping mic, sending END_AUDIO`
                  );
                  // Stop mic so no more chunks are captured
                  try { LiveAudioStream.stop(); } catch { /* ignore */ }
                  // Tell server: mic is done, please finalize the recognition
                  // (server calls recognizeStream.end() → Google emits final)
                  try { currentWs.send(JSON.stringify({ type: "END_AUDIO" })); } catch { /* ignore */ }

                  // ── Safety timeout: if no FINAL arrives within 5 s, unblock UI ──
                  endAudioTimeoutId = setTimeout(() => {
                    if (finalReceived) return; // already handled
                    if (myConnectionId !== connectionIdRef.current) return; // stale
                    console.warn(`⏱️ END_AUDIO timeout — no FINAL received (conn #${myConnectionId}), resetting`);
                    _hardStop("end_audio timeout — no final");
                    onError?.("لم أسمعك بوضوح، تكلم مرة ثانية");
                  }, 5000) as unknown as number;

                  return; // don't send this chunk
                }
              }

              currentWs.send(bytes.buffer);
            });
            LiveAudioStream.start();
            console.log(`🎙️ Mic capture started (conn #${myConnectionId})`);
            break;

          case "partial":
            if (msg.transcript) {
              setPartialTranscript(msg.transcript);
              onPartialTranscript?.(msg.transcript);
            }
            break;

          case "final":
            if (msg.transcript) {
              const t = msg.transcript;
              finalReceived = true;
              if (endAudioTimeoutId !== null) {
                clearTimeout(endAudioTimeoutId as number);
                endAudioTimeoutId = null;
              }
              console.log(`✅ Final transcript (conn #${myConnectionId}): "${t}"`);
              setPartialTranscript("");
              // Always stop streaming on any final transcript.
              // onFinalTranscript callback will re-start if needed (after TTS).
              _hardStop("final transcript received");
              onFinalTranscript(t);
              // Extra short-phrase log (stoppage already triggered above)
              if (isShortPhrase(t)) {
                console.log(`⚡ Short phrase "${t}" — stream closed immediately`);
              }
            }
            break;

          case "error":
            console.error(`❌ STT backend error (conn #${myConnectionId}):`, msg.message);
            _hardStop("backend error");
            onError?.(msg.message ?? "خطأ في التعرف على الكلام");
            break;
        }
      } catch {
        // Ignore JSON parse errors
      }
    };

    // ── onerror ───────────────────────────────────────────────────────────────
    ws.onerror = () => {
      if (myConnectionId !== connectionIdRef.current) return; // stale
      console.error(`❌ WebSocket error (conn #${myConnectionId})`);
      _hardStop("WebSocket error");
      onError?.("فشل الاتصال بالخادم");
    };

    // ── onclose ───────────────────────────────────────────────────────────────
    ws.onclose = (event) => {
      // Always clear isStoppingRef so the next startStreaming() is unblocked,
      // but only touch isStreamingRef if this is still the active connection.
      const isCurrent = myConnectionId === connectionIdRef.current;

      console.log(
        `🔌 WS closed (conn #${myConnectionId}${isCurrent ? ", current" : ", STALE"}) ` +
        `code=${event.code}`
      );

      if (isCurrent) {
        // Unexpected close (server dropped, network lost, etc.)
        if (isStreamingRef.current) {
          isStreamingRef.current = false;
          setIsStreaming(false);
          setPartialTranscript("");
          try { LiveAudioStream.stop(); } catch { /* ignore */ }
          onError?.("انقطع الاتصال بالخادم");
        }
      }

      // Always release the stopping lock so next startStreaming() can proceed
      if (isCurrent || isStoppingRef.current) {
        isStoppingRef.current = false;
        console.log(`🔓 isStoppingRef cleared (conn #${myConnectionId})`);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, wsBaseUrl, onFinalTranscript, onPartialTranscript, onError, onReady]);

  return { startStreaming, stopStreaming, isStreaming, partialTranscript };
}
