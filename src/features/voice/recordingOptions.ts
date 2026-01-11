// recordingOptions.ts
import { Audio } from "expo-av";

export const recordingOptions: Audio.RecordingOptions = {
  isMeteringEnabled: true, 
  android: {
    extension: ".wav",
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: ".wav",
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
    bitRate: 256000,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};
