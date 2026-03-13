// recordingOptions.ts
import { Audio } from "expo-av";

export const recordingOptions: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    // MPEG_4 + AAC produces a valid compressed file at half the size of the
    // previous DEFAULT format. Smaller file = faster upload + faster FFmpeg
    // decode on the backend, saving ~100–400ms per round trip.
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".wav",
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    bitRate: 128000,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};
