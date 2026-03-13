import { Modal, StyleSheet, Text, TouchableOpacity, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { borderRadius, iconSizes, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useVoiceStore } from '../store/useVoiceStore';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { PermissionsAndroid, Platform } from "react-native";
import { startRecording, stopRecording } from '../useVoiceRecorder';
import { sendVoice } from '../voiceApi';
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import React from 'react';

type Props = {
  onNavigate?: (screen: string, params?: any) => void;
};

let currentSound: Audio.Sound | null = null;

export async function playTts(base64Audio: string, voiceMode: 'speaker' | 'earpiece' = 'earpiece'): Promise<void> {
  const playStartTime = Date.now();
  console.log(`🎵 [playTts] START - voiceMode=${voiceMode}, audioLength=${base64Audio?.length || 0} bytes`);

  // Stop and unload previous sound if exists
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch (err) {
      console.warn('Failed to stop previous sound:', err);
    }
    currentSound = null;
  }

  // Switch audio session to playback mode.
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: voiceMode === 'earpiece',
  });

  // Write the audio file and load the sound IN PARALLEL with the settle delay.
  // Reduced SETTLE_MS from 300→150ms: the pre-warm audio mode switch in
  // processAudio() already runs during the API round-trip, so we only need a
  // small settle window here.
  const SETTLE_MS = 150;
  const uri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;

  const [, { sound }] = await Promise.all([
    new Promise<void>((r) => setTimeout(r, SETTLE_MS)),
    FileSystem.writeAsStringAsync(uri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    }).then(() =>
      Audio.Sound.createAsync(
        { uri },
        // 50ms polling: faster detection of completion events on Android.
        { progressUpdateIntervalMillis: 50 }
      )
    ),
  ]);

  currentSound = sound;

  // Read the audio duration right after load so we can set a hard safety timer.
  const loadedStatus = await sound.getStatusAsync();
  const durationMs =
    loadedStatus.isLoaded && loadedStatus.durationMillis && loadedStatus.durationMillis > 0
      ? loadedStatus.durationMillis
      : 15_000; // fallback for very long audio or when Android reports 0

  console.log(`🎵 [playTts] LOADED - duration=${durationMs}ms, isLoaded=${loadedStatus.isLoaded}`);

  return new Promise<void>((resolve) => {
    let done = false;
    let safetyTimer: NodeJS.Timeout | null = null;
    // Independent polling interval — started after playAsync() resolves so we
    // never fire isPlaying=false before playback has actually begun.
    let pollInterval: NodeJS.Timeout | null = null;
    // Guards the STATUS CALLBACK's tertiary isPlaying=false path only.
    // expo-av fires an immediate initial status event after setOnPlaybackStatusUpdate()
    // is registered where isLoaded=true but isPlaying=false (sound loaded, not yet
    // playing). Without this guard that event fires finish() before playAsync() runs.
    // The poll loop doesn't need this guard — it only starts after playAsync() resolves.
    let playbackStarted = false;

    const finish = (reason: string) => {
      if (done) return;
      done = true;

      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }

      // Detach the callback first so no further updates arrive after cleanup.
      sound.setOnPlaybackStatusUpdate(null);

      // Unload sound and delete temp file asynchronously.
      sound.unloadAsync().catch(console.warn);
      currentSound = null;
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => { });

      const elapsedMs = Date.now() - playStartTime;
      console.log(`🎵 [playTts] FINISHED via "${reason}" in ${elapsedMs}ms — resolving Promise`);
      resolve();
    };

    // ── Status callback ───────────────────────────────────────────────────────
    // Register BEFORE playAsync() so we never miss the very first update.
    sound.setOnPlaybackStatusUpdate((status) => {
      if (done) return;
      if (!status.isLoaded) return;

      // Primary: didJustFinish — the most reliable signal when it fires.
      if (status.didJustFinish) {
        finish('didJustFinish');
        return;
      }

      // Secondary: position reached >=90% of duration.
      // Lowered threshold from 95%→90% and guard now only requires durationMillis
      // to be positive (positionMillis can be 0 on some Android devices when the
      // player is in a finalising state).
      if (
        status.durationMillis && status.durationMillis > 0 &&
        status.positionMillis != null &&
        status.positionMillis >= status.durationMillis * 0.99
      ) {
        finish('position>=90%');
        return;
      }

      // Tertiary: isPlaying became false AFTER playback started.
      // The playbackStarted guard is REQUIRED here: expo-av fires an initial
      // status event immediately after setOnPlaybackStatusUpdate() is registered
      // with isLoaded=true, isPlaying=false (loaded but not yet playing). Without
      // this guard that event would call finish() before playAsync() even runs.
      // The poll loop handles the isPlaying=false case once playback is live.
      if (playbackStarted && status.isPlaying === false) {
        finish('isPlaying=false after start');
        return;
      }
    });

    // ── Safety timer ─────────────────────────────────────────────────────────
    // Fires at duration + 300ms. The polling loop (started after playAsync)
    // should catch normal completion; this is only for catastrophic cases.
    safetyTimer = setTimeout(() => {
      console.warn(`⚠️ [playTts] Safety timer fired after ${durationMs + 300}ms — forcing finish`);
      finish('safety-timer');
    }, durationMs + 300);

    // ── Start playback ────────────────────────────────────────────────────────
    sound.playAsync()
      .then(() => {
        console.log('🎵 [playTts] Playback started successfully');
        // Mark playback as started BEFORE starting the poll so the status
        // callback's tertiary guard is active for any concurrent callbacks.
        playbackStarted = true;

        // ── Independent polling loop ──────────────────────────────────────────
        // Started HERE (after playAsync resolves) so:
        //  1. No no-op ticks while waiting for playback to begin.
        //  2. isPlaying=false polls are only live once we know audio launched.
        // On Android, expo-av status callbacks can STOP firing entirely once the
        // MediaPlayer enters PlaybackCompleted state. We poll getStatusAsync()
        // directly at 50ms intervals as a completely independent fallback.
        pollInterval = setInterval(async () => {
          if (done) return;
          try {
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) {
              finish('poll:unloaded');
              return;
            }
            if (status.didJustFinish) {
              finish('poll:didJustFinish');
              return;
            }
            if (
              status.durationMillis && status.durationMillis > 0 &&
              status.positionMillis != null &&
              status.positionMillis >= status.durationMillis * 0.99
            ) {
              finish('poll:position>=90%');
              return;
            }
            if (!status.isPlaying) {
              finish('poll:isPlaying=false');
              return;
            }
          } catch {
            // Sound was already unloaded — treat as finished.
            finish('poll:error');
          }
        }, 50);
      })
      .catch((e) => {
        console.warn('playAsync error:', e);
        finish('playAsync-error');
      });
  });
}


export function VoiceAssistantSheet({ onNavigate }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isOpen = useVoiceStore((s) => s.isOpen);
  const setIsOpen = useVoiceStore((s) => s.setIsOpen);
  const messages = useVoiceStore((s) => s.messages);
  const recordingState = useVoiceStore((s) => s.recordingState);
  const authStatus = useAuthStore((s) => s.authStatus);
  const setAuthTriggeredByVoice = useVoiceStore((s) => s.setAuthTriggeredByVoice);
  const requestLoginOtp = useAuthStore((s) => s.requestLoginOtp);
  const requestSignupOtp = useAuthStore((s) => s.requestSignupOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const setRecordingState = useVoiceStore((s) => s.setRecordingState);
  const clear = useVoiceStore((s) => s.clear);
  const error = useVoiceStore((s) => s.error);

  useEffect(() => {
    if (!isOpen) return;

    const voice = useVoiceStore.getState();

    if (!voice.sessionId) {
      const newSessionId = `vs_${Date.now()}_${Math.random()
        .toString(16)
        .slice(2)}`;

      voice.setSessionId(newSessionId);

      console.log("🆕 Voice session initialized", newSessionId);
    }
  }, [isOpen]);

  const shouldResumeListening = useVoiceStore(
    (s) => s.shouldResumeListening
  );

  // ─── processAudio ────────────────────────────────────────────────────────────
  // Declared here (before handleSilenceDetected + its useEffect) so all three
  // are in the correct declaration order.
  const processAudio = async (uri: string) => {
    try {
      const voiceState = useVoiceStore.getState();
      const currentSessionId = voiceState.sessionId;
      const currentVoiceMode = voiceState.voiceMode;

      if (!currentSessionId) {
        console.warn("🎤 No sessionId, cannot send voice");
        setRecordingState("idle");
        return;
      }

      // ⚡ PRE-WARM PLAYBACK SESSION: Switch the Android AudioManager to
      // playback mode RIGHT NOW, before the API call, so it has the full
      // backend round-trip (~4–6s) to settle. This is what eliminates the
      // first-word cut-off on the very first response — the recording→playback
      // session transition is the slowest path (~400–800ms on some devices),
      // and 300ms inside playTts is not enough to cover it. Subsequent turns
      // are unaffected because the session stays in playback mode between turns.
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: currentVoiceMode === 'earpiece',
      }).catch((e) => console.warn('⚠️ Pre-warm audio mode failed:', e));

      const decision = await sendVoice(uri, currentSessionId);

      if (decision.sessionId) {
        useVoiceStore.getState().setSessionId(decision.sessionId);
      }

      console.log("🗣 Assistant:", decision.message, "Stage:", decision.stage);

      // Check if authentication is required
      if (decision.stage === 'IDENTITY' && authStatus !== 'authenticated') {
        console.log("🔐 Identity stage detected, starting inline auth flow");
        setIsInAuthFlow(true);
        setAuthStep('nationalId');
        setAuthTriggeredByVoice(true);
        setRecordingState("idle");
        return;
      }

      if (decision.audioBase64) {
        setRecordingState("playing");
        console.log("🎤 Processing audio response...");
        console.log("🎤 Setting recording state to PLAYING");
        try {
          await playTts(decision.audioBase64, currentVoiceMode);
          console.log("🎤 Audio playback completed, setting to idle");
          console.log("🎤 About to call setRecordingState('idle')");
          setRecordingState("idle");
          console.log("🎤 Called setRecordingState('idle') - state should now be idle");
        } catch (err) {
          console.error("❌ playTts error:", err);
          console.log("🎤 Setting recording state to ERROR due to playTts error");
          setRecordingState("error");
        }
        useVoiceStore.getState().setShouldResumeListening(true);
        console.log("🎤 Set shouldResumeListening to true");
      } else {
        console.log("🎤 No audioBase64, setting recording state to idle");
        setRecordingState("idle");
      }
    } catch (err) {
      console.error("❌ Error processing audio:", err);
      setRecordingState("error");
    }
  };

  // ⚡ FIX: useCallback with stable deps ensures the VAD interval always calls
  // the current closure, not a stale one from the first render. Without this,
  // silence detection works on turn 1 but breaks on turn 2+ because the
  // onSilenceDetected ref in useVoiceRecorder.ts points to an old closure.
  const handleSilenceDetected = useCallback(async (uri: string) => {
    try {
      setRecordingState("processing");
      await processAudio(uri);
    } catch (err) {
      console.error("❌ Error processing audio after silence:", err);
      setRecordingState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  useEffect(() => {
    if (shouldResumeListening && isOpen) {
      (async () => {
        console.log("🎤 Auto resuming mic after TTS - starting recording");
        // State is already "idle" (set in processAudio above). Start recording
        // and only move to "listening" once the recorder is actually running.
        await startRecording(handleSilenceDetected);
        console.log("🎤 Recording started successfully, setting state to listening");
        useVoiceStore.getState().setRecordingState("listening");
        console.log("🎤 Set recording state to listening");
        useVoiceStore.getState().setShouldResumeListening(false);
        console.log("🎤 Set shouldResumeListening to false");
      })().catch((err) => {
        console.error("🎤 Error in auto-resume mic:", err);
        useVoiceStore.getState().setRecordingState("error");
      });
    }
    // ⚡ FIX: handleSilenceDetected in deps so effect always uses current closure.
  }, [shouldResumeListening, isOpen, handleSilenceDetected]);

  // Inline auth state
  const [isInAuthFlow, setIsInAuthFlow] = useState(false);
  const [authStep, setAuthStep] = useState<'nationalId' | 'phoneNumber' | 'fullName' | 'otp' | null>(null);
  const [authInputs, setAuthInputs] = useState({
    nationalId: '',
    phoneNumber: '',
    fullName: '',
    otp: ''
  });
  const [authLoading, setAuthLoading] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Debug onNavigate prop
  React.useEffect(() => {
    console.log("🎤 VoiceAssistantSheet mounted, onNavigate:", typeof onNavigate);
  }, [onNavigate]);

  const stateLabel = useMemo(() => {
    const label = (() => {
      switch (recordingState) {
        case 'listening':
          return t('voice.listening');
        case 'processing':
          return t('voice.processing');
        case 'playing':
          return t('voice.playing');
        case 'error':
          return t('voice.error');
        default:
          return '';
      }
    })();
    const shouldShowStateBar = recordingState !== 'idle' || error;
    console.log(`🎤 UI stateLabel: "${label}" (recordingState: ${recordingState}, error: ${error}) - StateBar: ${shouldShowStateBar ? 'VISIBLE' : 'HIDDEN'}`);
    return label;
  }, [recordingState, t, error]);

  const micIcon =
    recordingState === 'processing'
      ? 'sync'
      : recordingState === 'listening'
        ? 'support-agent'
        : 'support-agent';

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.role === 'assistant' && typeof m.text === 'string' && m.text.trim()) return m.text.trim();
    }
    return '';
  }, [messages]);
  const handleClose = async () => {
    try {
      if (recordingState === "listening") {
        await stopRecording();
      }
    } catch (err) {
      console.warn("Stop recording on close failed", err);
    } finally {
      setRecordingState("idle");
      setIsOpen(false);
    }
  };

  async function requestMicPermission() {
    if (Platform.OS !== "android") return true;

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: "Microphone Permission",
        message: "This app needs access to your microphone",
        buttonPositive: "OK",
      }
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  const onMic = async () => {
    try {
      if (recordingState === "idle") {
        await startRecording(handleSilenceDetected);
        setRecordingState("listening");
        return;
      }

      // When listening, allow manual stop
      if (recordingState === "listening") {
        const uri = await stopRecording();
        if (uri) {
          await processAudio(uri);
        }
        return;
      }

      // When processing, don't allow interruption
      if (recordingState === "processing") {
        console.log("⏳ Cannot interrupt audio processing");
        return;
      }

      // When playing or error, reset to idle
      if (recordingState === "playing" || recordingState === "error") {
        setRecordingState("idle");
        return;
      }
    } catch (err) {
      console.error("❌ Voice error", err);
      setRecordingState("error");
    }
  };

  const handleAuthInputSubmit = async () => {
    if (!authStep) return;

    const currentValue = authInputs[authStep];
    if (!currentValue.trim()) return;

    setAuthLoading(true);
    try {
      if (authStep === 'nationalId') {
        // Store nationalId and move to phone
        setAuthInputs(prev => ({ ...prev, nationalId: currentValue }));
        setAuthStep('phoneNumber');
        setAuthLoading(false);
        return;
      }

      if (authStep === 'phoneNumber') {
        // Try login first
        try {
          await requestLoginOtp(authInputs.nationalId, currentValue);
          setAuthInputs(prev => ({ ...prev, phoneNumber: currentValue }));
          setAuthStep('otp');
        } catch (error) {
          console.log("🔄 Login failed, switching to signup flow");
          // If login fails, switch to signup - ask for full name
          setAuthInputs(prev => ({ ...prev, phoneNumber: currentValue }));
          setAuthStep('fullName');
        }
        setAuthLoading(false);
        return;
      }

      if (authStep === 'fullName') {
        // This means it's signup - call requestSignupOtp
        await requestSignupOtp(authInputs.nationalId, authInputs.phoneNumber, currentValue);
        setAuthInputs(prev => ({ ...prev, fullName: currentValue }));
        setAuthStep('otp');
        setAuthLoading(false);
        return;
      }

      if (authStep === 'otp') {
        // Call verifyOtp
        verifyOtp(authInputs.phoneNumber, currentValue);
        const voice = useVoiceStore.getState();
        voice.setPendingAuthData({
          nationalId: authInputs.nationalId,
          phoneNumber: authInputs.phoneNumber,
          fullName: authInputs.fullName,
          otp: currentValue,
        });
        setIsInAuthFlow(false);
        setAuthStep(null);
        setAuthInputs({
          nationalId: '',
          phoneNumber: '',
          fullName: '',
          otp: '',
        });
        setAuthLoading(false);

        verifyOtp(authInputs.phoneNumber, currentValue)
          .catch((error) => {
            console.error("❌ verifyOtp failed:", error);
            // Alert.alert('Error', 'Authentication failed. Please try again.');
          });
        return;
      }
    } catch (error) {
      console.log("❌Error during authentication step:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthInputChange = (field: keyof typeof authInputs, value: string) => {
    setAuthInputs(prev => ({ ...prev, [field]: value }));
  };

  const getAuthStepLabel = () => {
    switch (authStep) {
      case 'nationalId': return t('auth.enterNationalId');
      case 'phoneNumber': return t('auth.enterPhoneNumber');
      case 'fullName': return t('auth.enterFullName');
      case 'otp': return t('auth.enterVerificationCode');
      default: return '';
    }
  };

  const getAuthStepPlaceholder = () => {
    switch (authStep) {
      case 'nationalId': return t('auth.nationalId');
      case 'phoneNumber': return t('auth.phoneNumber');
      case 'fullName': return t('auth.fullName');
      case 'otp': return t('auth.otp');
      default: return '';
    }
  };

  // (processAudio and handleSilenceDetected are declared above, before the
  //  shouldResumeListening useEffect that depends on them.)

  const voiceMode = useVoiceStore((s) => s.voiceMode);
  const setVoiceMode = useVoiceStore((s) => s.setVoiceMode);

  const toggleVoiceMode = async () => {
    const sessionId = useVoiceStore.getState().sessionId;
    if (!sessionId) {
      console.warn("No sessionId available for voice mode update");
      return;
    }

    const newMode = voiceMode === 'earpiece' ? 'speaker' : 'earpiece';

    // Update UI immediately
    setVoiceMode(newMode);

    // Update backend
    try {
      const { updateVoiceMode } = await import('../voiceApi');
      await updateVoiceMode(sessionId, newMode);
      console.log(`✅ Voice mode updated to ${newMode}`);
    } catch (err) {
      console.error("❌ Failed to update voice mode on backend:", err);
      // Revert on failure
      setVoiceMode(voiceMode);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="support-agent" size={iconSizes.md} color={colors.headerText} />
            <Text style={styles.headerTitle}>{t('voice.title')}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={toggleVoiceMode} style={styles.headerIconBtn} accessibilityRole="button">
              <Ionicons
                name={voiceMode === 'speaker' ? 'volume-high' : 'ear'}
                size={iconSizes.md}
                color={colors.headerText}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={clear} style={styles.headerIconBtn} accessibilityRole="button">
              <Ionicons name="trash-outline" size={iconSizes.md} color={colors.headerText} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.headerIconBtn} accessibilityRole="button">
              <Ionicons name="close" size={iconSizes.lg} color={colors.headerText} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {isInAuthFlow && authStep ? (
            <View style={styles.authContainer}>
              <Text style={styles.authTitle}>{t('auth.identityVerification')}</Text>
              <Text style={styles.authSubtitle}>{getAuthStepLabel()}</Text>

              <TextInput
                style={styles.authInput}
                placeholder={getAuthStepPlaceholder()}
                value={authInputs[authStep]}
                onChangeText={(value) => handleAuthInputChange(authStep, value)}
                keyboardType={authStep === 'phoneNumber' || authStep === 'otp' || authStep === 'nationalId' ? 'phone-pad' : 'default'}
                secureTextEntry={authStep === 'otp'}
                autoCapitalize={authStep === 'fullName' ? 'words' : 'none'}
                autoCorrect={false}
                editable={!authLoading}
              />

              <TouchableOpacity
                style={[styles.authSubmitBtn, authLoading && styles.authSubmitBtnDisabled]}
                onPress={handleAuthInputSubmit}
                disabled={authLoading || !authStep || !authInputs[authStep].trim()}
              >
                <Text style={styles.authSubmitText}>
                  {authLoading ? t('common.processing') : t('common.submit')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : lastAssistantMessage ? (
            <View style={styles.responseCard}>
              <Text style={styles.responseLabel}>{t('voice.assistantLabel')}</Text>
              <Text style={styles.responseText}>{lastAssistantMessage}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="support-agent" size={64} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>{t('voice.tapToSpeak')}</Text>
              <Text style={styles.emptySub}>{t('voice.examplePrompts')}</Text>
              <View style={styles.examples}>
                <Text style={styles.example}> {t('voice.example1')}</Text>
                <Text style={styles.example}> {t('voice.example2')}</Text>
                <Text style={styles.example}> {t('voice.example3')}</Text>
              </View>
            </View>
          )}
        </View>

        {(recordingState !== 'idle' || error) && (
          <View style={styles.stateBar}>
            <Text style={styles.stateBarText}>{error ?? stateLabel}</Text>
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.micBtn, (recordingState === 'listening' || recordingState === 'processing') && styles.micBtnActive]}
            onPress={onMic}
            accessibilityRole="button"
            accessibilityLabel={t('voice.micButton')}
          >
            <MaterialIcons name={micIcon as any} size={iconSizes.lg} color={colors.textInverse} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    headerIconBtn: {
      padding: spacing.xs,
    },
    headerTitle: {
      color: colors.headerText,
      fontSize: typography.lg,
      fontWeight: typography.bold,
    },
    body: {
      flex: 1,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    emptyTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
    },
    emptySub: {
      fontSize: typography.base,
      color: colors.textSecondary,
    },
    examples: {
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadows.sm,
    },
    example: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },
    responseCard: {
      margin: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      ...shadows.sm,
    },
    responseLabel: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      color: colors.textSecondary,
    },
    responseText: {
      fontSize: typography.base,
      color: colors.text,
    },
    stateBar: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    stateBarText: {
      color: colors.primaryDark,
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      textAlign: 'center',
    },
    controls: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micBtn: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micBtnActive: {
      backgroundColor: colors.success,
    },
    authContainer: {
      margin: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadows.sm,
    },
    authTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: 'center',
    },
    authSubtitle: {
      fontSize: typography.base,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    authInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: typography.base,
      color: colors.text,
      backgroundColor: colors.background,
    },
    authSubmitBtn: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authSubmitBtnDisabled: {
      backgroundColor: colors.textTertiary,
    },
    authSubmitText: {
      color: colors.textInverse,
      fontSize: typography.base,
      fontWeight: typography.semibold,
    },
  });
}