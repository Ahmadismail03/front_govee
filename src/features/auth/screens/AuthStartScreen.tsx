import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { TextField } from '../../../shared/ui/TextField';
import { Button } from '../../../shared/ui/Button';
import { useAuthStore } from '../store/useAuthStore';
import { spacing, typography, borderRadius, shadows } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';

type Props = NativeStackScreenProps<RootStackParamList, 'AuthStart'>;

export function AuthStartScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const { isRtl } = useRtl();
  const [nationalId, setNationalId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [needsSignup, setNeedsSignup] = useState(false);
  const isLoading = useAuthStore((s) => s.isLoading);
  const requestLoginOtp = useAuthStore((s) => s.requestLoginOtp);
  const requestSignupOtp = useAuthStore((s) => s.requestSignupOtp);

  // Native stack header: make sure the route id isn't shown (e.g. "AuthStart").
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTitle: () => null,
      // Remove app logo from the red header for AuthStart.
      headerLeft: () => null,
    });
  }, [navigation]);

  // Reset the signup flow whenever the user edits nationalId or phone after
  // the server already confirmed "new user" — prevents stale state.
  React.useEffect(() => {
    if (needsSignup) {
      setNeedsSignup(false);
      setFullName('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nationalId, phoneNumber]);

  const onSubmit = async () => {
    try {
      const nid = nationalId.trim();
      const phone = phoneNumber.replace(/\s+/g, '').trim();
      
      // Validation
      if (!nid || !phone) {
        Alert.alert(t('auth.errorTitle'), t('auth.fillRequiredFields'));
        return;
      }

      if (nid.length < 9) {
        Alert.alert(t('auth.errorTitle'), 'رقم الهوية يجب أن يكون 9 أرقام على الأقل');
        return;
      }

      if (phone.length < 10) {
        Alert.alert(t('auth.errorTitle'), 'رقم الهاتف يجب أن يكون 10 أرقام على الأقل');
        return;
      }

      const redirect = route.params?.redirect;

      if (!needsSignup) {
        try {
          const res = await requestLoginOtp(nid, phone);
          navigation.replace('AuthOtp', {
            nationalId: nid,
            phoneNumber: phone,
            devOtp: res.otp,
            expiresAt: res.expiresAt,
            redirect,
          });
          return;
        } catch (e: any) {
          const status = (e as any)?.response?.status;
          if (status === 404) {
            setNeedsSignup(true);
            return;
          }
          throw e;
        }
      }

      const name = fullName.trim();
      if (!name) {
        Alert.alert(t('auth.errorTitle'), t('auth.fillRequiredFields'));
        return;
      }

      if (name.length < 4) {
        Alert.alert(t('auth.errorTitle'), 'الاسم يجب أن يكون 4 أحرف على الأقل');
        return;
      }

      const res = await requestSignupOtp(nid, phone, name);
      navigation.replace('AuthOtp', {
        nationalId: nid,
        phoneNumber: phone,
        devOtp: res.otp,
        expiresAt: res.expiresAt,
        redirect,
      });
    } catch (e: any) {
      const backendMessage = e?.response?.data?.message;
      const message =
        backendMessage === 'Validation failed'
          ? t('auth.fillRequiredFields')
          : backendMessage ?? e?.message ?? t('auth.errorMessage');

      Alert.alert(
        t('auth.errorTitle'),
        message,
        [{ text: t('common.ok'), style: 'cancel' }]
      );
    }
  };

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          // flex:1 inside ScrollView pins height to the viewport and blocks scrolling
          // when the keyboard shrinks the window (Android). flexGrow keeps centering
          // when there is extra space while allowing the content to extend and scroll.
          flexGrow: 1,
          justifyContent: 'center',
        },
        welcomeContainer: {
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        logo: {
          width: 200,
          height: 200,
          marginBottom: spacing.xs,
        },
        welcomeTitle: {
          fontSize: typography.xxxl,
          fontWeight: typography.bold,
          color: themeColors.text,
          textAlign: 'center',
          marginTop: -spacing.xs,
          marginBottom: spacing.xs,
        },
        welcomeSubtitle: {
          fontSize: typography.base,
          color: themeColors.textSecondary,
          textAlign: 'center',
          marginBottom: spacing.lg,
        },
        formContainer: {
          gap: spacing.md,
        },
        rtlInput: {
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        infoCard: {
          backgroundColor: themeColors.infoLight,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.sm,
        },
        infoText: {
          flex: 1,
          fontSize: typography.sm,
          color: themeColors.info,
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
      }),
    [themeColors]
  );

  return (
    <Screen keyboardAvoiding>
      <View style={styles.container}>
        <View style={styles.welcomeContainer}>
          <Image source={require('../../../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.welcomeTitle}>{t('auth.welcomeTitle')}</Text>
          <Text style={styles.welcomeSubtitle}>{t('auth.welcomeSubtitle')}</Text>
        </View>

        <View style={styles.formContainer}>
          <TextField
            label={t('auth.nationalId')}
            value={nationalId}
            onChangeText={setNationalId}
            style={styles.rtlInput}
            keyboardType="number-pad"
            autoCapitalize="none"
            placeholder={t('auth.nationalIdPlaceholder')}
          />

          <TextField
            label={t('auth.phoneNumber')}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            style={styles.rtlInput}
            keyboardType="phone-pad"
            autoCapitalize="none"
            placeholder={t('auth.phoneNumberPlaceholder')}
          />

          {needsSignup ? (
            <TextField
              label={t('auth.fullName')}
              value={fullName}
              onChangeText={setFullName}
              style={styles.rtlInput}
              autoCapitalize="words"
              placeholder={t('auth.fullNamePlaceholder')}
            />
          ) : null}

          <Button
            title={t('auth.login')}
            onPress={onSubmit}
            disabled={isLoading || !nationalId.trim() || !phoneNumber.trim() || (needsSignup && !fullName.trim())}
            loading={isLoading}
          />

          <TouchableOpacity
            style={styles.supportLink}
            onPress={() => navigation.navigate('ContactUs')}
            accessibilityRole="button"
          >
            <Text style={styles.supportText}>{t('auth.needHelp')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Screen>
  );
}
