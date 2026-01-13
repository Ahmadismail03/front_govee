import { Modal, StyleSheet, Text, TouchableOpacity, View, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { borderRadius, iconSizes, shadows, spacing, typography } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useVoiceStore } from '../store/useVoiceStore';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { useEffect, useMemo, useState } from 'react';
import { PermissionsAndroid, Platform } from "react-native";
import { startRecording, stopRecording } from '../useVoiceRecorder';
import { sendVoice } from '../voiceApi';
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import React from 'react';

type Props = {
  onNavigate?: (screen: string, params?: any) => void;
};

export async function playTts(base64Audio: string): Promise<void> {
  const uri = FileSystem.cacheDirectory + "tts.mp3";

  await FileSystem.writeAsStringAsync(uri, base64Audio, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();

  // Wait for playback to complete
  return new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(console.warn);
        resolve();
      }
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

  useEffect(() => {
    if (shouldResumeListening && isOpen) {
      (async () => {
        console.log("🎤 Auto resuming mic after TTS");
        await startRecording(handleSilenceDetected);
        useVoiceStore.getState().setRecordingState("listening");
        useVoiceStore.getState().setShouldResumeListening(false);
      })();
    }
  }, [shouldResumeListening, isOpen]);

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
  }, [recordingState, t]);

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
      case 'nationalId': return 'Enter your National ID';
      case 'phoneNumber': return 'Enter your Phone Number';
      case 'fullName': return 'Enter your Full Name';
      case 'otp': return 'Enter the verification code';
      default: return '';
    }
  };

  const getAuthStepPlaceholder = () => {
    switch (authStep) {
      case 'nationalId': return 'National ID';
      case 'phoneNumber': return 'Phone Number';
      case 'fullName': return 'Full Name';
      case 'otp': return 'Verification Code';
      default: return '';
    }
  };

  const handleSilenceDetected = async (uri: string) => {
    try {
      setRecordingState("processing");
      await processAudio(uri);
    } catch (err) {
      console.error("❌ Error processing audio after silence:", err);
      setRecordingState("error");
    }
  };

  const processAudio = async (uri: string) => {
    try {
      const currentSessionId = useVoiceStore.getState().sessionId;

      if (!currentSessionId) {
        console.warn("🎤 No sessionId, cannot send voice");
        setRecordingState("idle");
        return;
      }

      const decision = await sendVoice(uri, currentSessionId);

      if (decision.sessionId) {
        useVoiceStore.getState().setSessionId(decision.sessionId);
      }

      console.log("🗣 Assistant:", decision.message, "Stage:", decision.stage);

      // Check if authentication is required based on conversation stage
      if (decision.stage === 'IDENTITY' && authStatus !== 'authenticated') {
        console.log("🔐 Identity stage detected, starting inline auth flow");

        // Start inline auth flow
        setIsInAuthFlow(true);
        setAuthStep('nationalId');
        setAuthTriggeredByVoice(true); // Mark that auth was triggered by voice
        setRecordingState("idle");
        return;
      }
      if (decision.audioBase64) {
        setRecordingState("playing");
        await playTts(decision.audioBase64);
        useVoiceStore.getState().setShouldResumeListening(true);
      }
    } catch (err) {
      console.error("❌ Error processing audio:", err);
      setRecordingState("error");
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
              <Text style={styles.authTitle}>Identity Verification</Text>
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
                  {authLoading ? 'Processing...' : 'Submit'}
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