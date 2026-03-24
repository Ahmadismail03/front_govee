import React, { useLayoutEffect, useMemo } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { TextField } from '../../../shared/ui/TextField';
import { Button } from '../../../shared/ui/Button';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';
import { borderRadius, spacing, typography } from '../../../shared/theme/tokens';
import { useProfileStore } from '../store/useProfileStore';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { getDisplayInitials } from '../../../shared/utils/displayInitials';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export function ProfileEditScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isRtl } = useRtl();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);

  const fullName = useProfileStore((s) => s.fullName);
  const setFullName = useProfileStore((s) => s.setFullName);
  const photoUri = useProfileStore((s) => s.photoUri);

  const nationalId = user?.nationalId ?? '—';
  const phoneNumber = user?.phoneNumber ?? '—';
  const displayNameForInitials = useMemo(
    () => (fullName || '').trim() || t('profile.nameFallback'),
    [fullName, t]
  );
  const avatarInitials = useMemo(() => getDisplayInitials(displayNameForInitials, '?'), [displayNameForInitials]);

  const textDirStyle = useMemo(
    () =>
      isRtl
        ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
        : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const }),
    [isRtl]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isRtl ? '' : t('profile.editProfileButton'),
    });
  }, [navigation, isRtl, t]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        headerCard: {
          backgroundColor: colors.cardBackground,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          marginBottom: spacing.lg,
          alignSelf: 'stretch',
        },
        headerCardRtl: {
          flexDirection: 'row',
          direction: 'ltr',
          justifyContent: 'flex-end',
        },
        avatar: {
          width: 72,
          height: 72,
          borderRadius: borderRadius.full,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: {
          width: 72,
          height: 72,
        },
        avatarInitials: {
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.textSecondary,
          textAlign: 'center',
        },
        headerMeta: {
          flex: 1,
          gap: spacing.xs,
          minWidth: 0,
        },
        headerTitle: {
          fontSize: typography.lg,
          fontWeight: typography.semibold,
          color: colors.text,
          alignSelf: 'stretch',
        },
        headerSub: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          alignSelf: 'stretch',
        },
        sectionTitle: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.text,
          marginBottom: spacing.sm,
          alignSelf: 'stretch',
        },
        card: {
          backgroundColor: colors.cardBackground,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          gap: spacing.md,
          marginBottom: spacing.lg,
          alignSelf: 'stretch',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
        },
        rowClusterRtlWrap: {
          flex: 1,
          flexDirection: 'row',
          direction: 'ltr',
          justifyContent: 'flex-end',
          minWidth: 0,
        },
        rowClusterRtl: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: spacing.sm,
          flexShrink: 1,
          maxWidth: '100%',
        },
        rowLast: {
          borderBottomWidth: 0,
          paddingBottom: 0,
        },
        label: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          flexShrink: 0,
        },
        value: {
          fontSize: typography.base,
          color: colors.text,
          fontWeight: typography.medium,
          flexShrink: 1,
          minWidth: 0,
        },
        actionsRow: {
          flexDirection: 'row',
          gap: spacing.sm,
          marginTop: spacing.md,
        },
        flex1: {
          flex: 1,
        },
      }),
    [colors]
  );

  const avatarEl = (
    <View
      style={styles.avatar}
      accessibilityRole="image"
      accessibilityLabel={photoUri ? displayNameForInitials : `${displayNameForInitials}, ${avatarInitials}`}
    >
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.avatarImage} />
      ) : (
        <Text style={styles.avatarInitials} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {avatarInitials}
        </Text>
      )}
    </View>
  );

  const subline = phoneNumber !== '—' ? phoneNumber : nationalId;

  const headerMetaEl = (
    <View style={styles.headerMeta}>
      <RtlPhysicalRightBlock isRtl={isRtl}>
        <Text style={[styles.headerTitle, textDirStyle]} numberOfLines={2}>
          {fullName || t('profile.nameFallback')}
        </Text>
        <Text style={[styles.headerSub, textDirStyle]} numberOfLines={1}>
          {subline}
        </Text>
      </RtlPhysicalRightBlock>
    </View>
  );

  return (
    <Screen scroll>
      <View style={[styles.headerCard, isRtl && styles.headerCardRtl]}>
        {isRtl ? (
          <>
            {headerMetaEl}
            {avatarEl}
          </>
        ) : (
          <>
            {avatarEl}
            {headerMetaEl}
          </>
        )}
      </View>

      <View style={styles.card}>
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.sectionTitle, textDirStyle]}>{t('profile.personalInfo')}</Text>
        </RtlPhysicalRightBlock>

        <RtlPhysicalRightBlock isRtl={isRtl}>
          <TextField
            label={t('profile.fullName')}
            value={fullName}
            onChangeText={(v) => void setFullName(v)}
            placeholder={t('profile.fullNamePlaceholder')}
          />
        </RtlPhysicalRightBlock>

        <View style={styles.row}>
          {isRtl ? (
            <View style={styles.rowClusterRtlWrap}>
              <View style={styles.rowClusterRtl}>
                <Text style={[styles.label, textDirStyle]}>{t('profile.phoneNumber')}</Text>
                <Text style={[styles.value, textDirStyle]}>{phoneNumber}</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>{t('profile.phoneNumber')}</Text>
              <Text style={styles.value}>{phoneNumber}</Text>
            </>
          )}
        </View>
        <View style={[styles.row, styles.rowLast]}>
          {isRtl ? (
            <View style={styles.rowClusterRtlWrap}>
              <View style={styles.rowClusterRtl}>
                <Text style={[styles.label, textDirStyle]}>{t('profile.nationalId')}</Text>
                <Text style={[styles.value, textDirStyle]}>{nationalId}</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>{t('profile.nationalId')}</Text>
              <Text style={styles.value}>{nationalId}</Text>
            </>
          )}
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.flex1}>
            <Button title={t('common.cancel')} variant="secondary" onPress={() => navigation.goBack()} />
          </View>
          <View style={styles.flex1}>
            <Button title={t('common.save')} variant="primary" onPress={() => navigation.goBack()} />
          </View>
        </View>
      </View>
    </Screen>
  );
}
