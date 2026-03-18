import { Audio } from "expo-av";
import { recordingOptions } from "./recordingOptions";

let recording: Audio.Recording | null = null;
// FIX 1: renamed to vadTimeout — this now holds a setTimeout handle, not setInterval.
// Using a single non-overlapping recursive timer eliminates async-tick races entirely.
let vadTimeout: NodeJS.Timeout | undefined = undefined;
let onSilenceDetected: ((uri: string) => void) | null = null;
let recordingStartTime: number | null = null;

let micPermissionGranted = false;
let recordingModeSet = false;

// ─── VAD configuration ────────────────────────────────────────────────────────

const SPEECH_THRESHOLD         = -35;   // dBFS absolute floor for speech
const SILENCE_THRESHOLD        = -42;   // dBFS absolute floor for silence
const SPEECH_RELATIVE_MARGIN   = 12;    // dB above ambient → speech
const SILENCE_RELATIVE_MARGIN  = 8;     // dB above ambient → silence

const NOISE_BASELINE_WINDOW      = 30;  // rolling sample window for ambient estimate
const NOISE_BASELINE_MIN_SAMPLES = 10;  // samples needed before trusting dynamic thresholds

// FIX 2: separate smoothing windows.
// Speech uses a longer window to reject brief transients (cough, click, etc).
// Silence uses a SHORT window so avgForSilence drops quickly once speech ends.
const SPEECH_SMOOTH_WINDOW  = 5;   // 5 × 100ms = 500ms
const SILENCE_SMOOTH_WINDOW = 3;   // 3 × 100ms = 300ms

// FIX 3: after speech is confirmed, ignore silence checks for this long.
// This gives silenceLevels time to fill with actual speech samples before
// we start comparing against the silence threshold.
const SPEECH_ACTIVATION_GRACE_MS = 300;  // ms

const SILENCE_DURATION       = 700;   // ms of sustained silence to trigger stop
const SPEECH_DURATION        = 200;   // ms of sustained loud audio to confirm speech
const MIN_RECORDING_DURATION = 1000;  // ms
const MAX_RECORDING_DURATION = 6000;  // ms
const MONITORING_INTERVAL    = 100;   // ms between ticks

// ─────────────────────────────────────────────────────────────────────────────

export async function startRecording(onSilenceCallback?: (uri: string) => void) {
  if (recording) {
    console.log("🧹 Cleaning up existing recording before starting new one");
    try {
      await stopRecording();
    } catch (error) {
      console.warn("Error cleaning up existing recording:", error);
    }
  }

  onSilenceDetected = onSilenceCallback || null;

  if (!micPermissionGranted) {
    const { status } = await Audio.requestPermissionsAsync();
    micPermissionGranted = status === "granted";
  }

  if (!recordingModeSet) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    recordingModeSet = true;
  }

  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(recordingOptions);
  recordingStartTime = Date.now();
  await recording.startAsync();

  console.log("🎙️ Recording started");
  startSilenceMonitoring();
}

export async function stopRecording(): Promise<string | null> {
  console.log("🛑 stopRecording called");
  if (!recording) {
    console.log("⚠️ No recording to stop");
    return null;
  }

  // FIX 1: use clearTimeout (matching the recursive setTimeout approach).
  if (vadTimeout !== undefined) {
    clearTimeout(vadTimeout);
    vadTimeout = undefined;
  }

  recordingModeSet = false;

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;
  recordingStartTime = null;

  console.log("📂 Audio saved:", uri);
  return uri;
}

function startSilenceMonitoring() {
  console.log("🎯 Starting Voice Activity Detection...");

  let speechStartTime:      number | null = null;
  let silenceStartTime:     number | null = null;
  let speechActivatedAt:    number | null = null;  // FIX 3: grace period anchor
  let isRecordingActive     = false;

  // FIX 2: two independent smoothing buffers
  let speechLevels:  number[] = [];
  let silenceLevels: number[] = [];

  // Ambient noise baseline (built only from quiet pre-speech samples)
  const noiseLevels: number[] = [];
  let ambientNoiseBaseline: number | null = null;

  let meteringUnavailableStart: number | null = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function pushSmoothed(buf: number[], value: number, maxLen: number): number {
    buf.push(value);
    if (buf.length > maxLen) buf.shift();
    return buf.reduce((s, v) => s + v, 0) / buf.length;
  }

  function updateAmbientNoise(level: number) {
    // Absolute guard: ignore obvious speech / transients so they don't skew baseline.
    if (level > SILENCE_THRESHOLD + 10) return;
    noiseLevels.push(level);
    if (noiseLevels.length > NOISE_BASELINE_WINDOW) noiseLevels.shift();
    ambientNoiseBaseline =
      noiseLevels.reduce((s, v) => s + v, 0) / noiseLevels.length;
  }

  function getThresholds(): { speechThr: number; silenceThr: number } {
    if (ambientNoiseBaseline !== null && noiseLevels.length >= NOISE_BASELINE_MIN_SAMPLES) {
      return {
        speechThr:  Math.max(SPEECH_THRESHOLD,  ambientNoiseBaseline + SPEECH_RELATIVE_MARGIN),
        silenceThr: Math.max(SILENCE_THRESHOLD, ambientNoiseBaseline + SILENCE_RELATIVE_MARGIN),
      };
    }
    return { speechThr: SPEECH_THRESHOLD, silenceThr: SILENCE_THRESHOLD };
  }

  // ── Core tick ─────────────────────────────────────────────────────────────
  //
  // FIX 1: This is a self-scheduling async function rather than a setInterval
  // callback.  The next tick is only scheduled AFTER the current tick's await
  // resolves, so there is never more than one tick in-flight at any time.
  // This eliminates all async-overlap race conditions on silenceStartTime.

  async function tick() {
    if (!recording || !recordingStartTime) {
      console.log("🧹 VAD: no active recording, stopping monitor");
      return;
    }

    try {
      const status  = await recording.getStatusAsync();
      const elapsed = Date.now() - recordingStartTime;

      // ── Safety: max duration ─────────────────────────────────────────────
      if (elapsed >= MAX_RECORDING_DURATION) {
        console.log("⏰ Safety stop after maximum duration");
        const uri = await stopRecording();
        if (onSilenceDetected && uri) onSilenceDetected(uri);
        return;   // do NOT reschedule
      }

      if (!status.isRecording) {
        console.log("⚠️ Recording stopped unexpectedly");
        return;   // do NOT reschedule
      }

      const currentLevel = status.metering;

      // ── Metering unavailable fallback ────────────────────────────────────
      if (currentLevel === undefined) {
        if (meteringUnavailableStart === null) {
          meteringUnavailableStart = Date.now();
          console.log("⚠️ Metering unavailable, fallback mode active");
        } else if (Date.now() - meteringUnavailableStart >= 5000) {
          console.log("⏰ Fallback stop (no metering for 5s)");
          const uri = await stopRecording();
          if (onSilenceDetected && uri) onSilenceDetected(uri);
          return;   // do NOT reschedule
        }
        // reschedule and wait for metering to become available
        vadTimeout = setTimeout(tick, MONITORING_INTERVAL);
        return;
      }

      meteringUnavailableStart = null;

      // ── Compute two independent smoothed averages (FIX 2) ────────────────
      const avgForSpeech  = pushSmoothed(speechLevels,  currentLevel, SPEECH_SMOOTH_WINDOW);
      const avgForSilence = pushSmoothed(silenceLevels, currentLevel, SILENCE_SMOOTH_WINDOW);

      const { speechThr, silenceThr } = getThresholds();

      if (!isRecordingActive) {
        // ── Pre-speech: accumulate baseline, watch for speech onset ─────
        updateAmbientNoise(currentLevel);

        if (avgForSpeech > speechThr) {
          if (speechStartTime === null) {
            speechStartTime = Date.now();
            console.log(
              `🎤 Potential speech: ${avgForSpeech.toFixed(1)}dB ` +
              `(thr: ${speechThr.toFixed(1)}dB, baseline n=${noiseLevels.length})`
            );
          } else if (Date.now() - speechStartTime >= SPEECH_DURATION) {
            isRecordingActive  = true;
            speechActivatedAt  = Date.now();
            speechStartTime    = null;
            silenceStartTime   = null;

            // FIX 3: flush silenceLevels so pre-speech quiet samples can't
            // cause an immediate false silence trigger.
            silenceLevels = [];

            console.log("🎙️ Speech confirmed — recording active");
          }
        } else {
          if (speechStartTime !== null) {
            console.log(`🔇 Speech reset: ${avgForSpeech.toFixed(1)}dB`);
            speechStartTime = null;
          }
        }

      } else {
        // ── Active speech: watch for silence ────────────────────────────

        // FIX 3: skip silence checks during grace period so the buffer fills
        // with real speech levels before we start comparing.
        const inGracePeriod =
          speechActivatedAt !== null &&
          Date.now() - speechActivatedAt < SPEECH_ACTIVATION_GRACE_MS;

        if (!inGracePeriod) {
          if (avgForSilence < silenceThr) {
            if (silenceStartTime === null) {
              silenceStartTime = Date.now();
              console.log(
                `🔇 Silence start: ${avgForSilence.toFixed(1)}dB ` +
                `(thr: ${silenceThr.toFixed(1)}dB, ` +
                `baseline: ${ambientNoiseBaseline?.toFixed(1) ?? "n/a"}dB)`
              );
            } else if (Date.now() - silenceStartTime >= SILENCE_DURATION) {
              if (elapsed >= MIN_RECORDING_DURATION) {
                console.log(`✅ Silence confirmed after ${elapsed}ms — stopping`);
                const uri = await stopRecording();
                if (onSilenceDetected && uri) onSilenceDetected(uri);
                return;   // do NOT reschedule
              } else {
                console.log(`⏳ Too short (${elapsed}ms) — continuing`);
                silenceStartTime = null;
              }
            }
          } else {
            // Sound above silence threshold — update baseline on quieter moments
            if (avgForSilence <= speechThr) {
              updateAmbientNoise(currentLevel);
            }
            if (silenceStartTime !== null) {
              console.log(
                `🎤 Speech resumed: ${avgForSilence.toFixed(1)}dB — silence timer reset`
              );
              silenceStartTime = null;
            }
          }
        }
      }
    } catch (error) {
      console.warn("VAD tick error:", error);
      // Don't crash the whole monitor on a transient error — just reschedule.
    }

    // Schedule the next tick only now that this one is fully resolved.
    vadTimeout = setTimeout(tick, MONITORING_INTERVAL);
  }

  // Kick off the first tick.
  vadTimeout = setTimeout(tick, MONITORING_INTERVAL);
}