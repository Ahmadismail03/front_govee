import { Audio } from "expo-av";
import { recordingOptions } from "./recordingOptions";

let recording: Audio.Recording | null = null;
let silenceTimer: NodeJS.Timeout | undefined = undefined;
let monitoringInterval: NodeJS.Timeout | undefined = undefined;
let onSilenceDetected: ((uri: string) => void) | null = null;
let recordingStartTime: number | null = null;

// Voice Activity Detection configuration
const SPEECH_THRESHOLD = -35
const SILENCE_THRESHOLD = -38
const SILENCE_DURATION = 1000

const SPEECH_DURATION = 300; // ms - minimum speech duration to start recording

const MIN_RECORDING_DURATION = 1000; // ms - minimum recording time
const MAX_RECORDING_DURATION = 6000;  
const MONITORING_INTERVAL = 100; // ms - how often to check audio levels

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

  await Audio.requestPermissionsAsync();

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  recording = new Audio.Recording();
  await recording.prepareToRecordAsync(recordingOptions);
  recordingStartTime = Date.now();
  await recording.startAsync();

  console.log("🎙️ Recording started");

  // Start monitoring for silence
  startSilenceMonitoring();
}

export async function stopRecording(): Promise<string | null> {
  console.log("🛑 stopRecording called");
  if (!recording) {
    console.log("⚠️ No recording to stop");
    return null;
  }

  // Clear timers
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    silenceTimer = undefined;
  }
  if (monitoringInterval) {
    console.log("🧹 Clearing monitoring interval");
    clearInterval(monitoringInterval);
    monitoringInterval = undefined;
  }

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;
  recordingStartTime = null;

  console.log("📂 WAV saved:", uri);
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

  monitoringInterval = setInterval(async () => {
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
        const uri = await stopRecording();
        if (onSilenceDetected && uri) {
          onSilenceDetected(uri);
        }
        return;
      }

      if (status.isRecording) {
        let currentLevel = status.metering;

        // If metering is not available, use a fallback approach
        if (currentLevel === undefined) {
          if (meteringUnavailableStart === null) {
            meteringUnavailableStart = Date.now();
            console.log("⚠️ Audio metering not available, using fallback mode");
          }

          // In fallback mode, record for a reasonable time then stop
          const meteringUnavailableElapsed = Date.now() - meteringUnavailableStart;
          if (meteringUnavailableElapsed >= 5000) { // 5 seconds fallback
            console.log("⏰ Fallback stop (no metering available after 5 seconds)");
            const uri = await stopRecording();
            if (onSilenceDetected && uri) {
              onSilenceDetected(uri);
            }
          }
          return;
        }

        // Reset metering unavailable flag if we got a reading
        meteringUnavailableStart = null;

        // Update recent levels for smoothing
        recentLevels.push(currentLevel);
        if (recentLevels.length > MAX_RECENT_LEVELS) {
          recentLevels.shift();
        }

        // Calculate average level for stability
        const avgLevel = recentLevels.reduce((sum, level) => sum + level, 0) / recentLevels.length;

        if (!isRecordingActive) {
          // Waiting for speech to start
          if (avgLevel > SPEECH_THRESHOLD) {
            if (speechStartTime === null) {
              speechStartTime = Date.now();
              console.log(`🎤 Detected potential speech: ${avgLevel.toFixed(1)}dB`);
            } else if (Date.now() - speechStartTime >= SPEECH_DURATION) {
              // Speech has been detected for minimum duration
              isRecordingActive = true;
              speechStartTime = null;
              silenceStartTime = null;
              console.log(`🎙️ Speech confirmed, recording is now active`);
            }
          } else {
            // Reset speech detection if level drops
            if (speechStartTime !== null) {
              console.log(`🔇 Speech detection reset: ${avgLevel.toFixed(1)}dB`);
              speechStartTime = null;
            }
          }
        } else {
          // Recording is active, monitor for silence
          if (avgLevel < SILENCE_THRESHOLD) {
            // Audio level is below silence threshold
            if (silenceStartTime === null) {
              silenceStartTime = Date.now();
              console.log(`🔇 Silence detected: ${avgLevel.toFixed(1)}dB (threshold: ${SILENCE_THRESHOLD}dB)`);
            } else if (Date.now() - silenceStartTime >= SILENCE_DURATION) {
              // Silence has persisted long enough
              if (elapsed >= MIN_RECORDING_DURATION) {
                console.log(`🔇 Silence confirmed, stopping recording after ${elapsed}ms`);
                const uri = await stopRecording();
                if (onSilenceDetected && uri) {
                  onSilenceDetected(uri);
                }
              } else {
                // Recording too short, keep going
                console.log(`⏳ Recording too short (${elapsed}ms), continuing...`);
                silenceStartTime = null;
              }
            }
          } else {
            // Speech detected, reset silence timer
            if (silenceStartTime !== null) {
              console.log(`🎤 Speech resumed: ${avgLevel.toFixed(1)}dB, resetting silence timer`);
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
