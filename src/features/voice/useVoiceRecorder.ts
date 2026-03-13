import { Audio } from "expo-av";
import { recordingOptions } from "./recordingOptions";

let recording: Audio.Recording | null = null;
let silenceTimer: NodeJS.Timeout | undefined = undefined;
let monitoringInterval: NodeJS.Timeout | undefined = undefined;
let onSilenceDetected: ((uri: string) => void) | null = null;
let recordingStartTime: number | null = null;

// Cache mic permission + audio mode so we only pay the setup cost once.
let micPermissionGranted = false;
let recordingModeSet = false;

// Voice Activity Detection configuration
const SPEECH_THRESHOLD = -35;
const SILENCE_THRESHOLD = -38;
// 600ms feels responsive while avoiding false triggers on breath pauses.
const SILENCE_DURATION = 600;
// 200ms minimum before confirming speech has started.
const SPEECH_DURATION = 200;

const MIN_RECORDING_DURATION = 1000; // ms
const MAX_RECORDING_DURATION = 6000; // ms
const MONITORING_INTERVAL = 100;    // ms

export async function startRecording(onSilenceCallback?: (uri: string) => void) {
  // Ensure any existing recording is properly cleaned up
  if (recording) {
    console.log("🧹 Cleaning up existing recording before starting new one");
    try {
      await stopRecording();
    } catch (error) {
      console.warn("Error cleaning up existing recording:", error);
    }
  }

  onSilenceDetected = onSilenceCallback || null;

  // Only request permission once; subsequent calls skip this ~50ms round trip.
  if (!micPermissionGranted) {
    const { status } = await Audio.requestPermissionsAsync();
    micPermissionGranted = status === "granted";
  }

  // Set recording audio mode only once; switching modes costs ~50–150ms on Android.
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

  // Clear timers immediately so no pending tick can interfere.
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = undefined;
  }
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = undefined;
  }

  // Allow the recording audio mode to be re-applied on the next startRecording
  // so that playTts can switch to playback mode without conflict.
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

  let speechStartTime: number | null = null;
  let silenceStartTime: number | null = null;
  let isRecordingActive = false;
  let recentLevels: number[] = [];
  const MAX_RECENT_LEVELS = 10;
  let meteringUnavailableStart: number | null = null;

  // Guard flag: once we decide to stop, prevent any subsequent interval tick
  // from firing onSilenceDetected a second time (async race fix).
  let isStopping = false;

  monitoringInterval = setInterval(async () => {
    // If we already initiated a stop, do nothing — the interval will be
    // cleared by stopRecording() before the next tick reaches here.
    if (isStopping) return;

    if (!recording || !recordingStartTime) {
      console.log("🧹 Clearing VAD monitoring (no recording)");
      clearInterval(monitoringInterval);
      monitoringInterval = undefined;
      return;
    }

    try {
      const status = await recording.getStatusAsync();
      const elapsed = Date.now() - recordingStartTime;

      // Safety: stop after maximum duration
      if (elapsed >= MAX_RECORDING_DURATION) {
        console.log("⏰ Safety stop after maximum duration");
        isStopping = true;
        clearInterval(monitoringInterval);
        monitoringInterval = undefined;
        const uri = await stopRecording();
        if (onSilenceDetected && uri) {
          onSilenceDetected(uri);
        }
        return;
      }

      if (status.isRecording) {
        let currentLevel = status.metering;

        // Fallback if metering is unavailable
        if (currentLevel === undefined) {
          if (meteringUnavailableStart === null) {
            meteringUnavailableStart = Date.now();
            console.log("⚠️ Audio metering not available, using fallback mode");
          }
          const meteringUnavailableElapsed = Date.now() - meteringUnavailableStart;
          if (meteringUnavailableElapsed >= 5000) {
            console.log("⏰ Fallback stop (no metering available after 5s)");
            isStopping = true;
            clearInterval(monitoringInterval);
            monitoringInterval = undefined;
            const uri = await stopRecording();
            if (onSilenceDetected && uri) {
              onSilenceDetected(uri);
            }
          }
          return;
        }

        meteringUnavailableStart = null;

        // Smoothed level over last N readings
        recentLevels.push(currentLevel);
        if (recentLevels.length > MAX_RECENT_LEVELS) {
          recentLevels.shift();
        }
        const avgLevel =
          recentLevels.reduce((sum, l) => sum + l, 0) / recentLevels.length;

        if (!isRecordingActive) {
          // Waiting for speech to begin
          if (avgLevel > SPEECH_THRESHOLD) {
            if (speechStartTime === null) {
              speechStartTime = Date.now();
              console.log(`🎤 Detected potential speech: ${avgLevel.toFixed(1)}dB`);
            } else if (Date.now() - speechStartTime >= SPEECH_DURATION) {
              isRecordingActive = true;
              speechStartTime = null;
              silenceStartTime = null;
              console.log(`🎙️ Speech confirmed, recording is now active`);
            }
          } else {
            if (speechStartTime !== null) {
              console.log(`🔇 Speech detection reset: ${avgLevel.toFixed(1)}dB`);
              speechStartTime = null;
            }
          }
        } else {
          // Speech was detected — now watching for silence
          if (avgLevel < SILENCE_THRESHOLD) {
            if (silenceStartTime === null) {
              silenceStartTime = Date.now();
              console.log(
                `🔇 Silence detected: ${avgLevel.toFixed(1)}dB (threshold: ${SILENCE_THRESHOLD}dB)`
              );
            } else if (Date.now() - silenceStartTime >= SILENCE_DURATION) {
              if (elapsed >= MIN_RECORDING_DURATION) {
                console.log(
                  `🔇 Silence confirmed, stopping recording after ${elapsed}ms`
                );
                // Set guard BEFORE clearing interval and stopping, so any
                // concurrent async tick that resumes after the await sees it.
                isStopping = true;
                clearInterval(monitoringInterval);
                monitoringInterval = undefined;
                const uri = await stopRecording();
                if (onSilenceDetected && uri) {
                  onSilenceDetected(uri);
                }
              } else {
                console.log(`⏳ Recording too short (${elapsed}ms), continuing...`);
                silenceStartTime = null;
              }
            }
          } else {
            if (silenceStartTime !== null) {
              console.log(
                `🎤 Speech resumed: ${avgLevel.toFixed(1)}dB, resetting silence timer`
              );
              silenceStartTime = null;
            }
          }
        }
      } else {
        console.log("⚠️ Recording stopped unexpectedly");
        clearInterval(monitoringInterval);
        monitoringInterval = undefined;
      }
    } catch (error) {
      console.warn("Error in VAD monitoring:", error);
      clearInterval(monitoringInterval);
      monitoringInterval = undefined;
    }
  }, MONITORING_INTERVAL);
}
