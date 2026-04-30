import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { borderRadius, iconSizes, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useVoiceStore } from '../store/useVoiceStore';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Platform } from "react-native";
import { useStreamingRecorder } from '../useStreamingRecorder';
import { completeVoiceSession, createVoiceSession } from '../voiceApi';
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import React from 'react';
import { useRtl } from '../../../core/i18n/useRtl';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

// WebSocket base URL — set EXPO_PUBLIC_WS_BASE_URL in your .env
// e.g. ws://192.168.1.x:3000  or  ws://your-tunnel.ngrok.io
const WS_BASE_URL =
  process.env.EXPO_PUBLIC_WS_BASE_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/^http/, 'ws').replace(/\/api$/, '') ??
  'ws://localhost:3000';

type Props = {
  onNavigate?: (screen: string, params?: any) => void;
};

let currentSound: Audio.Sound | null = null;

export async function playTts(base64Audio: string, voiceMode: 'speaker' | 'earpiece' = 'earpiece'): Promise<void> {
  const playStartTime = Date.now();
  console.log(`🎵 [playTts] START - voiceMode=${voiceMode}, audioLength=${base64Audio?.length || 0} bytes`);

  if (!base64Audio || base64Audio.length < 10) {
    console.warn('⚠️ [playTts] Received empty or invalid base64Audio. Aborting playback.');
    return;
  }

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
  const SETTLE_MS = 150;
  const uri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;

  const [, { sound }] = await Promise.all([
    new Promise<void>((r) => setTimeout(r, SETTLE_MS)),
    FileSystem.writeAsStringAsync(uri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    }).then(() =>
      Audio.Sound.createAsync(
        { uri },
        { 
          progressUpdateIntervalMillis: 50,
          androidImplementation: 'MediaPlayer' 
        }
      )
    ),
  ]);

  currentSound = sound;

  const loadedStatus = await sound.getStatusAsync();
  const durationMs =
    loadedStatus.isLoaded && loadedStatus.durationMillis && loadedStatus.durationMillis > 0
      ? loadedStatus.durationMillis
      : 15_000;

  console.log(`🎵 [playTts] LOADED - duration=${durationMs}ms, isLoaded=${loadedStatus.isLoaded}`);

  return new Promise<void>((resolve) => {
    let done = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let playbackStarted = false;

    const finish = (reason: string) => {
      if (done) return;
      done = true;

      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

      sound.setOnPlaybackStatusUpdate(null);
      sound.unloadAsync().catch(console.warn);
      currentSound = null;
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => { });

      const elapsedMs = Date.now() - playStartTime;
      console.log(`🎵 [playTts] FINISHED via "${reason}" in ${elapsedMs}ms — resolving Promise`);
      resolve();
    };

   sound.setOnPlaybackStatusUpdate((status) => {
  if (done) return;
  if (!status.isLoaded) return;

 if (status.didJustFinish) {
    finish("didJustFinish");
    return;
  }
  if (
    status.durationMillis &&
    status.positionMillis &&
    status.positionMillis >= status.durationMillis * 0.98
  ) {
    finish("position>=98%");
  }
});

    safetyTimer = setTimeout(() => {
      console.warn(`⚠️ [playTts] Safety timer fired after ${durationMs + 300}ms — forcing finish`);
      finish('safety-timer');
    }, durationMs + 300);

    sound.playAsync()
      .then(() => {
        console.log('🎵 [playTts] Playback started successfully');
        playbackStarted = true;

        pollInterval = setInterval(async () => {
          if (done) return;
          try {
            const status = await sound.getStatusAsync();
            if (!status.isLoaded) { finish('poll:unloaded'); return; }
            if (status.didJustFinish) { finish('poll:didJustFinish'); return; }
            if (
              status.durationMillis && status.durationMillis > 0 &&
              status.positionMillis != null &&
              status.positionMillis >= status.durationMillis * 0.99
            ) {
              finish('poll:position>=90%');
              return;
            }
            if (status.didJustFinish) {
   finish('poll:didJustFinish');
}          } catch {
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
  const { isRtl } = useRtl();
  const colors = useThemeColors();
  const isOpen = useVoiceStore((s) => s.isOpen);
  const setIsOpen = useVoiceStore((s) => s.setIsOpen);
  const messages = useVoiceStore((s) => s.messages);
  const recordingState = useVoiceStore((s) => s.recordingState);
  const authStatus = useAuthStore((s) => s.authStatus);
  const setAuthTriggeredByVoice = useVoiceStore((s) => s.setAuthTriggeredByVoice);
  const setPendingReopenAfterAuth = useVoiceStore((s) => s.setPendingReopenAfterAuth);
  const setRecordingState = useVoiceStore((s) => s.setRecordingState);
  const error = useVoiceStore((s) => s.error);

  // Stable ref so handleFinalTranscript can call stopStreaming() even though
  // stopStreaming is declared later (returned from useStreamingRecorder).
  const stopStreamingRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isOpen) {
      setIsSessionReady(false);
      if (noSpeechTimerRef.current) {
        clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = null;
      }
      setNoSpeechToast(false);
      return;
    }

    const voice = useVoiceStore.getState();
    const sessionId = voice.sessionId ?? `vs_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    if (!voice.sessionId) {
      voice.setSessionId(sessionId);
      console.log("🆕 Voice session initialized", sessionId);
    }

    createVoiceSession(sessionId)
      .then(() => console.log("💾 Voice session persisted to DB", sessionId))
      .catch((err) => console.warn("⚠️ Failed to persist voice session:", err));

    setIsSessionReady(true);

    // ── Post-auth reopen ──────────────────────────────────────────────────────
    // When the sheet reopens after the user completed OTP verification:
    //  • mark the session as already started (the user already spoke once)
    //  • play the backend's deferred audio (stored before we left for auth)
    //  • then auto-resume the mic so the user can continue seamlessly
    // If no audio was cached, skip straight to auto-resuming the mic.
    if (voice.authTriggeredByVoice) {
      voice.setAuthTriggeredByVoice(false);
      setHasStartedSession(true); // UI: show active session, hide "Tap to speak"

      const audio = voice.pendingAudio;
      const audioMode = voice.pendingAudioMode ?? voice.voiceMode;

      // Clear immediately so a second open doesn't replay the same clip
      if (audio) voice.setPendingAudio(null);

      if (audio) {
        console.log('🎵 Playing deferred IDENTITY audio after auth');
        setRecordingState('playing');
        playTts(audio, audioMode)
          .then(() => {
            setRecordingState('idle');
            // Auto-start mic so the user can re-ask their request
            useVoiceStore.getState().setShouldResumeListening(true);
          })
          .catch((err) => {
            console.error('❌ Post-auth audio playback error:', err);
            setRecordingState('error');
          });
      } else {
        // No deferred audio — go straight to listening
        console.log('🎤 No deferred audio; auto-starting mic after auth');
        useVoiceStore.getState().setShouldResumeListening(true);
      }
    }
  }, [isOpen]);

  const shouldResumeListening = useVoiceStore((s) => s.shouldResumeListening);

  // ── Streaming recorder ────────────────────────────────────────────────────
  const handleFinalTranscript = useCallback(async (transcript: string) => {
    // NOTE: The streaming hook has already called _hardStop() before invoking
    // this callback. isStreamingRef.current is false by the time we run.
    const voiceState = useVoiceStore.getState();
    const currentSessionId = voiceState.sessionId;
    const currentVoiceMode = voiceState.voiceMode;

    if (!currentSessionId) {
      console.warn('🎤 No sessionId — ignoring transcript');
      setRecordingState('idle');
      return;
    }

    console.log(`🎙️ Final transcript: "${transcript}"`);
    setRecordingState('processing');
    useVoiceStore.getState().setLiveTranscript('');

    // Pre-switch audio session to playback mode
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: currentVoiceMode === 'earpiece',
    }).catch((e) => console.warn('⚠️ Pre-warm audio mode failed:', e));

    try {
      const decision = await useVoiceStore.getState().processMessage(transcript);

      if (decision.sessionId) {
        useVoiceStore.getState().setSessionId(decision.sessionId);
      }

      console.log('🗣 Assistant:', decision.message, 'Stage:', decision.stage);

      if (decision.stage === 'IDENTITY' && authStatus !== 'authenticated') {
        console.log('🔐 Identity stage — navigating to AuthStart');
        // stopStreaming already called by hook — no manual call needed
        setPendingReopenAfterAuth(true);
        setAuthTriggeredByVoice(true);
        setRecordingState('idle');
        setIsOpen(false);
        onNavigate?.('AuthStart', { redirect: { screen: 'VOICE_RETURN' } });
        return;
      }

      if (decision.audioBase64) {
        setRecordingState('playing');
        try {
          await playTts(decision.audioBase64, currentVoiceMode);
          setRecordingState('idle');
        } catch (err) {
          console.error('❌ playTts error:', err);
          // Reset hasStartedSession so the user can tap the mic button to retry.
          setHasStartedSession(false);
          setRecordingState('error');
        }
        // Small delay: give the WS onclose handler time to clear isStoppingRef
        // before startStreaming() is called in the shouldResumeListening effect.
        setTimeout(() => {
          useVoiceStore.getState().setShouldResumeListening(true);
        }, 150);
      } else {
        setRecordingState('idle');
      }
    } catch (err) {
      console.error('❌ Error processing transcript:', err);
      // Reset hasStartedSession so the user can tap the mic button to retry.
      setHasStartedSession(false);
      setRecordingState('error');
    }
  }, [authStatus, onNavigate]);

  const handlePartialTranscript = useCallback((transcript: string) => {
    useVoiceStore.getState().setLiveTranscript(transcript);
  }, []);

  const handleStreamError = useCallback((message: string) => {
    console.error('❌ Streaming error:', message);
    // Clear in-progress transcript and prevent a stale auto-resume from looping.
    useVoiceStore.getState().setLiveTranscript('');
    useVoiceStore.getState().setShouldResumeListening(false);
    // Show error and ungate the mic button immediately.
    // isMicDisabled now uses isStopping (from the hook) to block premature retries
    // while the WebSocket is still closing — no timing assumption needed.
    setHasStartedSession(false);
    setRecordingState('error');
  }, [setRecordingState]);

  // Handles the "no speech" case: shows a 2-second transient toast then
  // auto-restarts listening without requiring the user to tap.
  const handleNoSpeech = useCallback(() => {
    console.log('👂 No speech detected — showing toast, auto-retry in 2 s');
    useVoiceStore.getState().setLiveTranscript('');
    useVoiceStore.getState().setShouldResumeListening(false);
    // hasStartedSession stays true — recordingState='idle' + hasStartedSession=true
    // already makes isMicDisabled=true, so the user can't tap during the wait.
    setRecordingState('idle');
    setNoSpeechToast(true);
    if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
    noSpeechTimerRef.current = setTimeout(() => {
      noSpeechTimerRef.current = null;
      setNoSpeechToast(false);
      // Piggyback on the existing shouldResumeListening effect to restart the mic.
      useVoiceStore.getState().setShouldResumeListening(true);
    }, 2000);
  }, [setRecordingState]);

  const handleStreamReady = useCallback(() => {
    setRecordingState('listening');
  }, []);

  const sessionId = useVoiceStore((s) => s.sessionId);

  const { startStreaming, stopStreaming, partialTranscript, isStreaming, isStopping } = useStreamingRecorder({
    sessionId,
    wsBaseUrl: WS_BASE_URL,
    onFinalTranscript: handleFinalTranscript,
    onPartialTranscript: handlePartialTranscript,
    onError: handleStreamError,
    onNoSpeech: handleNoSpeech,
    onReady: handleStreamReady,
  });

  // Keep the ref in sync so handleFinalTranscript always calls the latest stopStreaming
  useEffect(() => {
    stopStreamingRef.current = stopStreaming;
  }, [stopStreaming]);

  // Live transcript from the hook drives the store (for display)
  useEffect(() => {
    useVoiceStore.getState().setLiveTranscript(partialTranscript);
  }, [partialTranscript]);

  // Safety net: if the WebSocket closes for any reason while the UI is still
  // showing 'listening', reset to idle. This covers edge cases where the
  // stream ends without a final transcript reaching handleFinalTranscript.
  useEffect(() => {
    if (!isStreaming && recordingState === 'listening') {
      console.log('🔒 Safety net: stream stopped but UI stuck at listening — resetting to idle');
      setRecordingState('idle');
      useVoiceStore.getState().setLiveTranscript('');
    }
  }, [isStreaming, recordingState]);

  // Auto-resume mic after TTS finishes
  useEffect(() => {
    if (shouldResumeListening && isOpen) {
      (async () => {
        console.log('🎤 Auto-resuming mic after TTS');
        useVoiceStore.getState().setShouldResumeListening(false);
        await startStreaming();
      })().catch((err) => {
        console.error('🎤 Error in auto-resume mic:', err);
        useVoiceStore.getState().setRecordingState('error');
      });
    }
  }, [shouldResumeListening, isOpen, startStreaming]);

  const [isSessionReady, setIsSessionReady] = useState(false);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [noSpeechToast, setNoSpeechToast] = useState(false);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const styles = useMemo(() => createStyles(colors), [colors]);

  React.useEffect(() => {
    console.log("🎤 VoiceAssistantSheet mounted, onNavigate:", typeof onNavigate);
  }, [onNavigate]);

  // ─── Animation refs ────────────────────────────────────────────────────────
  const pulseScale1 = useRef(new Animated.Value(1)).current;
  const pulseOpacity1 = useRef(new Animated.Value(0)).current;
  const pulseScale2 = useRef(new Animated.Value(1)).current;
  const pulseOpacity2 = useRef(new Animated.Value(0)).current;
  const processingRotation = useRef(new Animated.Value(0)).current;
  const responseCardOpacity = useRef(new Animated.Value(0)).current;
  const prevMessageRef = useRef('');

  // Dual expanding rings while listening
  useEffect(() => {
    if (recordingState !== 'listening') {
      pulseScale1.setValue(1);
      pulseOpacity1.setValue(0);
      pulseScale2.setValue(1);
      pulseOpacity2.setValue(0);
      return;
    }

    let isMounted = true;
    let loop2: Animated.CompositeAnimation | null = null;

    pulseScale1.setValue(1);
    pulseOpacity1.setValue(0.7);
    const loop1 = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale1, {
          toValue: 2.3,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity1, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    );
    loop1.start();

    const timerId = setTimeout(() => {
      if (!isMounted) return;
      pulseScale2.setValue(1);
      pulseOpacity2.setValue(0.5);
      loop2 = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseScale2, {
            toValue: 2.3,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity2, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ])
      );
      loop2.start();
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
      loop1.stop();
      if (loop2) loop2.stop();
      pulseScale1.setValue(1);
      pulseOpacity1.setValue(0);
      pulseScale2.setValue(1);
      pulseOpacity2.setValue(0);
    };
  }, [recordingState]);

  // Spinning icon while processing
  useEffect(() => {
    if (recordingState !== 'processing') {
      processingRotation.stopAnimation();
      processingRotation.setValue(0);
      return;
    }
    processingRotation.setValue(0);
    Animated.loop(
      Animated.timing(processingRotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    return () => {
      processingRotation.stopAnimation();
      processingRotation.setValue(0);
    };
  }, [recordingState]);

  // Fade-in response card when a new assistant message arrives
  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m?.role === 'assistant' && typeof m.text === 'string' && m.text.trim()) return m.text.trim();
    }
    return '';
  }, [messages]);

  useEffect(() => {
    if (lastAssistantMessage && lastAssistantMessage !== prevMessageRef.current) {
      prevMessageRef.current = lastAssistantMessage;
      responseCardOpacity.setValue(0);
      Animated.timing(responseCardOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [lastAssistantMessage]);

  // ─── State-derived values ─────────────────────────────────────────────────

  /** Accent color that drives the mic button and rings */
  const micStateColor = useMemo(() => {
    switch (recordingState) {
      case 'listening': return '#22C55E'; // vibrant green
      case 'processing': return '#F59E0B'; // amber
      case 'playing': return '#6366F1'; // indigo
      case 'error': return '#EF4444'; // red
      default: return colors.primary;
    }
  }, [recordingState, colors.primary]);

  /** Icon shown inside the mic button */
  const micStateIcon = useMemo<string>(() => {
    switch (recordingState) {
      case 'processing': return 'sync';
      case 'playing': return 'volume-up';
      case 'error': return 'error-outline';
      default: return 'mic';
    }
  }, [recordingState]);

  /** Short contextual text shown below the mic button */
  const stateSubtitle = useMemo(() => {
    if (error) return error;
    switch (recordingState) {
      case 'listening': return t('voice.listening');
      case 'processing': return t('voice.processing');
      case 'playing': return t('voice.playing');
      case 'error': return t('voice.error');
      default: return hasStartedSession ? '' : t('voice.tapToSpeak');
    }
  }, [recordingState, error, hasStartedSession, t]);

  const spinInterpolation = processingRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleClose = useCallback(async () => {
    console.log('🛑 [handleClose] Hard-stopping entire voice session');

    // ── 1. Stop any active TTS audio playback ─────────────────────────────────
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch { /* already stopped / unloaded */ }
      currentSound = null;
    }

    // ── 2. Force-stop the microphone (belt-and-suspenders on top of stopStreaming) ─
    try {
      const LiveAudioStream = require('react-native-live-audio-stream').default;
      LiveAudioStream.stop();
    } catch { /* mic was already idle */ }

    // ── 3. Close the STT WebSocket stream ────────────────────────────────────
    try { stopStreamingRef.current(); } catch { /* nothing was streaming */ }

    // ── 4. Cancel any pending auto-resume so the mic doesn't restart ─────────
    try { useVoiceStore.getState().setShouldResumeListening(false); } catch { /* ignore */ }

    // ── 5. Clear pending deferred audio ──────────────────────────────────────
    try { useVoiceStore.getState().setPendingAudio(null); } catch { /* ignore */ }

    // ── 6. Complete the session on the backend (best-effort, non-blocking) ───
    try {
      const sid = useVoiceStore.getState().sessionId;
      if (sid) {
        await completeVoiceSession(sid);
        console.log('✅ Voice session completed on close');
      }
    } catch (err) {
      console.warn('⚠️ completeVoiceSession on close failed (non-fatal):', err);
    }

    // ── 7. Release audio session back to default ──────────────────────────────
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
    } catch { /* ignore */ }

    // ── 8. Reset all voice state ──────────────────────────────────────────────
    try { useVoiceStore.getState().setLiveTranscript(''); } catch { /* ignore */ }
    try { useVoiceStore.getState().setSessionId(null); } catch { /* ignore */ }
    if (noSpeechTimerRef.current) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
    setNoSpeechToast(false);
    setRecordingState('idle');
    setIsSessionReady(false);
    setHasStartedSession(false);
    setIsOpen(false);

    console.log('✅ [handleClose] Voice session fully terminated');
  }, [stopStreamingRef, setRecordingState, setIsOpen]);

  const onMic = async () => {
    if (!isSessionReady) return;
    // Allow re-tap only when idle (first start) OR when in error state (retry).
    // Any other active state (listening / processing / playing) is already in
    // progress — ignore the tap.
    if (hasStartedSession && recordingState !== 'error') return;
    try {
      if (recordingState === 'idle' || recordingState === 'error') {
        setHasStartedSession(true);
        setRecordingState('idle'); // clear error UI before the new attempt
        // startStreaming connects WS → server sends 'ready' → mic starts
        await startStreaming();
        // recordingState transitions to 'listening' inside handleStreamReady
      }
    } catch (err) {
      console.error('❌ Voice error', err);
      setHasStartedSession(false); // release the lock so the user can retry again
      setRecordingState('error');
    }
  };

  const voiceMode = useVoiceStore((s) => s.voiceMode);
  const setVoiceMode = useVoiceStore((s) => s.setVoiceMode);

  const toggleVoiceMode = async () => {
    const sessionId = useVoiceStore.getState().sessionId;
    if (!sessionId) {
      console.warn("No sessionId available for voice mode update");
      return;
    }

    const newMode = voiceMode === 'earpiece' ? 'speaker' : 'earpiece';
    setVoiceMode(newMode);

    try {
      const { updateVoiceMode } = await import('../voiceApi');
      await updateVoiceMode(sessionId, newMode);
      console.log(`✅ Voice mode updated to ${newMode}`);
    } catch (err) {
      console.error("❌ Failed to update voice mode on backend:", err);
      setVoiceMode(voiceMode);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  // Disable the mic button when:
  //  • the session isn't ready yet (session ID not created)
  //  • a turn is actively in progress (listening / processing / playing)
  //  • the previous WebSocket is still closing (isStopping from hook)
  //    — startStreaming() guards on isStoppingRef so tapping while it's true
  //      silently no-ops; keep the button disabled until teardown is confirmed.
  const isMicDisabled =
    !isSessionReady ||
    (hasStartedSession && recordingState !== 'error') ||
    isStopping;
  const textDirStyle = useMemo(
    () =>
      isRtl
        ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
        : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const }),
    [isRtl]
  );
  const insets = useSafeAreaInsets();
  /** Modal + translucent status bar: pad the header so content clears the notch / status bar. */
  const headerPaddingTop = spacing.xl + spacing.md;

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <View style={styles.headerLeft}>
            <MaterialIcons
              name="support-agent"
              size={iconSizes.md}
              color={colors.headerText}
              style={styles.headerLeadingIcon}
            />
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('voice.title')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.headerIconBtn}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={iconSizes.lg} color={colors.headerText} />
          </TouchableOpacity>
        </View>

        {/* ── Body ── */}
        <View style={styles.body}>
          {!lastAssistantMessage && (
            <View style={styles.empty}>
              <RtlPhysicalRightBlock isRtl={isRtl}>
                <Text style={[styles.emptySub, textDirStyle]}>{t('voice.examplePrompts')}</Text>
                <View style={styles.examples}>
                  <Text style={[styles.example, textDirStyle]}>{t('voice.example1')}</Text>
                  <Text style={[styles.example, textDirStyle]}>{t('voice.example2')}</Text>
                  <Text style={[styles.example, textDirStyle]}>{t('voice.example3')}</Text>
                </View>
              </RtlPhysicalRightBlock>
            </View>
          )}
        </View>

        {/* ── Mic Zone ── */}
        <View style={styles.micZone}>
          {/* Icon + instruction shown only in pre-session idle — sits just above the mic */}
          {!hasStartedSession && recordingState === 'idle' && (
            <View style={styles.micPrompt}>
              <MaterialIcons name="record-voice-over" size={66} color={colors.primary} />
              <Text style={styles.micPromptText}>{t('voice.tapToSpeak')}</Text>
            </View>
          )}

          {/* Animated pulse rings (visible during listening) */}
          <View style={styles.micRingContainer}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  backgroundColor: micStateColor,
                  opacity: pulseOpacity1,
                  transform: [{ scale: pulseScale1 }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  backgroundColor: micStateColor,
                  opacity: pulseOpacity2,
                  transform: [{ scale: pulseScale2 }],
                },
              ]}
            />

            {/* Mic button */}
            <TouchableOpacity
              style={[
                styles.micBtn,
                { backgroundColor: micStateColor },
                isMicDisabled && !hasStartedSession && styles.micBtnNotReady,
              ]}
              onPress={onMic}
              disabled={isMicDisabled}
              accessibilityRole="button"
              accessibilityLabel={t('voice.micButton')}
            >
              {recordingState === 'processing' ? (
                <Animated.View style={{ transform: [{ rotate: spinInterpolation }] }}>
                  <MaterialIcons name="sync" size={34} color="#fff" />
                </Animated.View>
              ) : (
                <MaterialIcons name={micStateIcon as any} size={34} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Live partial transcript removed — no longer shown */}

          {/* Transient no-speech toast — auto-dismisses after 2 s */}
          {noSpeechToast && (
            <Text style={[styles.stateSubtitle, { color: '#da0e0e' }]}>
              {'لم أسمعك بوضوح، تكلم مرة أخرى'}
            </Text>
          )}

          {/* Status label shown only once the session is active */}
          {!noSpeechToast && (hasStartedSession || recordingState !== 'idle' || !!error) && (
            <Text style={[styles.stateSubtitle, { color: micStateColor }]}>
              {stateSubtitle}
            </Text>
          )}
        </View>

        {/* ── Bottom Controls ── */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={toggleVoiceMode}
            style={styles.audioModeBtn}
            accessibilityRole="button"
          >
            <Ionicons
              name={voiceMode === 'speaker' ? 'volume-high-outline' : 'ear-outline'}
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.audioModeLabel}>
              {voiceMode === 'speaker'
                ? t('voice.audioMode.speaker')
                : t('voice.audioMode.earpiece')}
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  const MIC_SIZE = 80;
  const RING_CONTAINER_SIZE = MIC_SIZE * 2.5; // room for rings to expand

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    headerLeft: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerLeadingIcon: {
      flexShrink: 0,
    },
    headerIconBtn: {
      padding: spacing.xs,
      flexShrink: 0,
    },
    headerTitle: {
      flexShrink: 1,
      color: colors.headerText,
      fontSize: typography.lg,
      fontWeight: typography.bold,
    },

    // ── Body ─────────────────────────────────────────────────────────────────
    body: {
      flex: 1,
    },
    empty: {
      flex: 1,
      alignSelf: 'stretch',
      alignItems: 'stretch',
      justifyContent: 'center',      // pull examples down, flush above mic zone
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.sm,               // tighter gap between label and card
    },
    // Icon + instruction block inside micZone (pre-session idle)
    micPrompt: {
      alignItems: 'center',
      gap: spacing.sm,       // tighter spacing between icon and label
      paddingBottom: 0,      // flush against the mic — no extra gap
    },
    micPromptText: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.primary,           // red — strong call-to-action
      textAlign: 'center',
    },
    emptySub: {
      fontSize: typography.xl,
      color: colors.textSecondary,
      alignSelf: 'stretch',  // stretch to full width so textAlign works
      marginBottom: spacing.lg,
    },
    examples: {
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRightWidth: 4,
      borderRightColor: colors.primary,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadows.sm,
    },

    example: {
      alignSelf: 'stretch',
      fontSize: typography.lg,
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
      lineHeight: 24,
    },

    // ── Mic Zone ────────────────────────────────────────────────────────────
    micZone: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 0,
      paddingBottom: spacing.xl,
      gap: 0,                    // icon → text → mic: one tight block
    },
    micRingContainer: {
      width: RING_CONTAINER_SIZE,
      height: RING_CONTAINER_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
        marginTop: -20,
    },
    pulseRing: {
      position: 'absolute',
      width: MIC_SIZE,
      height: MIC_SIZE,
      borderRadius: MIC_SIZE / 2,
    },
    micBtn: {
      width: MIC_SIZE,
      height: MIC_SIZE,
      borderRadius: MIC_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      // Subtle shadow to lift the button off the background
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    micBtnNotReady: {
      opacity: 0.45,
    },
    stateSubtitle: {
      fontSize: typography.sm,
      fontWeight: typography.semibold,
      textAlign: 'center',
      letterSpacing: 0.3,
      minHeight: 20, // keep consistent height even when empty
    },

    // ── Bottom Controls ─────────────────────────────────────────────────────
    controls: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    audioModeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    audioModeLabel: {
      fontSize: typography.sm,
      color: colors.textSecondary,
    },

    // ── Auth Flow ────────────────────────────────────────────────────────────
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