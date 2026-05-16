import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, TextInput } from 'react-native';
import { useRtl } from '../../../core/i18n/useRtl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { Button } from '../../../shared/ui/Button';
import { useAuthStore } from '../store/useAuthStore';
import { spacing, typography, borderRadius, shadows } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { trustThisDeviceForNationalId } from '../utils/trustedDevice';
import { useLockCountdown } from '../../../shared/utils/lockCountdown';
import { showRtlAlert } from '../../../shared/ui/RtlAlert';
type Props = NativeStackScreenProps<RootStackParamList, 'AuthOtp'>;

export function AuthOtpScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const { isRtl } = useRtl();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [rememberDevice, setRememberDevice] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const { isLocked } = useLockCountdown(lockedUntil);

  // Auto-clear lock state once the countdown expires so the user can retry.
  useEffect(() => {
    if (!isLocked && lockedUntil) {
      setLockedUntil(null);
    }
  }, [isLocked, lockedUntil]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isRtl ? '' : t('auth.otpTitle') });
  }, [navigation, t, isRtl]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Single digit
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const onVerify = async () => {
    try {
      const phoneNumber = route.params?.phoneNumber?.replace(/\s+/g, '').trim();
      if (!phoneNumber) {
        showRtlAlert(t('auth.errorTitle'), t('auth.invalidRequest'));
        return;
      }

      // OTP boxes are forced LTR — no reversal needed.
      const otpString = otp.join('');
      if (!otpString || otpString.trim().length !== 6 || !/^\d{6}$/.test(otpString)) {
        showRtlAlert(t('auth.errorTitle'), t('auth.otpError'));
        return;
      }

      await verifyOtp(phoneNumber, otpString);

      // Run device trust in the background — don't block navigation on it
      if (rememberDevice && route.params?.nationalId) {
        trustThisDeviceForNationalId(route.params.nationalId).catch(console.warn);
      }

      const redirect = route.params?.redirect;
      if (redirect?.screen === 'VOICE_RETURN') {
        // popToTop() pops ALL modals (AuthOtp, any lingering AuthStart) back to
        // the root MainTabs screen without remounting it — avoids the "app reload"
        // that navigation.replace('MainTabs') causes by creating a second instance.
        navigation.popToTop();
      } else if (redirect) {
        navigation.replace(redirect.screen as any, redirect.params as any);
      } else {
        navigation.replace('MainTabs');
      }
    } catch (e: any) {
      const code = e?.response?.data?.code;
      const backendMessage = e?.response?.data?.message;

      if (code === 'OTP_LOCKED') {
        // Store expiry for button-disable countdown.
        const details = e?.response?.data?.details as { lockedUntil?: string; remainingSeconds?: number } | undefined;
        if (details?.lockedUntil) {
          setLockedUntil(details.lockedUntil);
        } else if (details?.remainingSeconds) {
          setLockedUntil(new Date(Date.now() + details.remainingSeconds * 1000).toISOString());
        } else {
          setLockedUntil(new Date(Date.now() + 15 * 60 * 1000).toISOString());
        }
        // Show as popup — same pattern as all other OTP errors.
        showRtlAlert(
          t('auth.errorTitle'),
          backendMessage ?? 'تم تجاوز عدد المحاولات المسموح بها. حاول مرة أخرى لاحقاً.',
          [{ text: t('common.ok'), style: 'cancel' }]
        );
      } else {
        setLockedUntil(null);
        const message = backendMessage ?? e?.message ?? t('auth.otpError');
        showRtlAlert(
          t('auth.errorTitle'),
          message,
          [{ text: t('common.ok'), style: 'cancel' }]
        );
      }
    }
  };

  const maskedPhone = useMemo(() => {
    const phone = route.params?.phoneNumber ?? '';
    const digits = phone.replace(/\s+/g, '');
    if (digits.length < 4) return phone;
    const last2 = digits.slice(-2);
    const first2 = digits.slice(0, 2);
    return `${first2}•••••${last2}`;
  }, [route.params?.phoneNumber]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexGrow: 1,
          justifyContent: 'flex-start',
        },
        logoContainer: {
          alignItems: 'center',
          marginBottom: spacing.xxl,
          paddingTop: spacing.xl,
        },
        logo: {
          width: 200,
          height: 200,
          marginBottom: spacing.xl,
        },
        title: {
          fontSize: typography.xxl,
          fontWeight: typography.bold,
          color: themeColors.text,
          textAlign: 'center',
          marginBottom: spacing.sm,
        },
        subtitle: {
          fontSize: typography.base,
          color: themeColors.textSecondary,
          textAlign: 'center',
          marginBottom: spacing.xxl,
        },
        codeSent: {
          fontSize: typography.sm,
          color: themeColors.textSecondary,
          textAlign: 'center',
          marginTop: spacing.xs,
        },
        otpContainer: {
          marginBottom: spacing.xl,
        },
        otpLabel: {
          fontSize: typography.sm,
          fontWeight: typography.semibold,
          color: themeColors.text,
          textAlign: 'center',
          marginBottom: spacing.lg,
          letterSpacing: 0.5,
        },
        otpBoxesContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
          direction: 'ltr' as const,
        },
        otpBox: {
          width: 48,
          height: 56,
          borderWidth: 2,
          borderColor: themeColors.border,
          borderRadius: borderRadius.md,
          backgroundColor: themeColors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          ...shadows.sm,
        },
        otpBoxFocused: {
          borderColor: themeColors.primary,
          backgroundColor: themeColors.primaryLight,
          ...shadows.md,
        },
        otpBoxFilled: {
          borderColor: themeColors.primary,
          backgroundColor: themeColors.cardBackground,
        },
        otpErrorText: {
          fontSize: typography.sm,
          fontWeight: '600',
          color: themeColors.error ?? '#EF4444',
          textAlign: 'center',
          marginTop: spacing.sm,
        },
        otpInput: {
          fontSize: typography.xxl,
          fontWeight: typography.bold,
          color: themeColors.text,
          textAlign: 'center',
          writingDirection: 'ltr' as const,
          width: '100%',
          height: '100%',
        },

        supportLink: {
          marginTop: spacing.lg,
          alignItems: 'center',
        },
        supportText: {
          fontSize: typography.sm,
          color: themeColors.primary,
          textDecorationLine: 'underline',
        },
        rememberRow: {
          marginTop: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
        rememberText: {
          fontSize: typography.sm,
          color: themeColors.textSecondary,
        },
      }),
    [themeColors]
  );

  return (
    <Screen keyboardAvoiding>
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image source={require('../../../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('auth.otpTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.otpSubtitle')}</Text>
          <Text style={styles.codeSent}>{t('auth.codeSentTo', { phone: maskedPhone })}</Text>
        </View>

        <View style={styles.otpContainer}>
          <Text style={styles.otpLabel}>{t('auth.otp')}</Text>
          
          <View style={styles.otpBoxesContainer}>
            {otp.map((digit, index) => (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  digit && styles.otpBoxFilled,
                ]}
              >
                <TextInput
                  ref={(ref) => { inputRefs.current[index] = ref; }}
                  style={styles.otpInput}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={index === 0}
                  accessibilityLabel={`${t('auth.otp')} digit ${index + 1}`}
                />
              </View>
            ))}
          </View>


        </View>

        <Button
          title={t('auth.verify')}
          onPress={onVerify}
          disabled={otp.some(d => !d) || isLocked}
          loading={isLoading}
        />

        <TouchableOpacity
          style={styles.rememberRow}
          onPress={() => setRememberDevice((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberDevice }}
        >
          <Ionicons
            name={rememberDevice ? 'checkbox' : 'square-outline'}
            size={22}
            color={rememberDevice ? themeColors.primary : themeColors.textSecondary}
          />
          <Text style={styles.rememberText}>{t('auth.rememberThisDevice')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.supportLink}
          onPress={() => navigation.navigate('ContactUs')}
          accessibilityRole="button"
        >
          <Text style={styles.supportText}>{t('auth.needHelp')}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
