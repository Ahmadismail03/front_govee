import React, { useEffect, useMemo } from 'react';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TabsParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { ErrorView } from '../../../shared/ui/ErrorView';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { Button } from '../../../shared/ui/Button';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { borderRadius, spacing, typography } from '../../../shared/theme/tokens';
import { getDisplayInitials } from '../../../shared/utils/displayInitials';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { useRtl } from '../../../core/i18n/useRtl';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

type Props = BottomTabScreenProps<TabsParamList, 'ProfileTab'>;

export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isRtl } = useRtl();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const profileBoot = useProfileStore((s) => s.bootstrap);
  const profileLoading = useProfileStore((s) => s.isLoading);
  const profileError = useProfileStore((s) => s.error);
  const fullName = useProfileStore((s) => s.fullName);
  const setFullName = useProfileStore((s) => s.setFullName);
  const photoUri = useProfileStore((s) => s.photoUri);
  const clearProfile = useProfileStore((s) => s.clear);


  useEffect(() => {
    profileBoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fromAuth = (user as any)?.fullName;
    if (!profileLoading && !(fullName || '').trim() && typeof fromAuth === 'string' && fromAuth.trim()) {
      setFullName(fromAuth.trim());
    }
  }, [fullName, profileLoading, setFullName, user]);

  const navigateTo = (screen: string, params?: any) => {
    const parent = typeof navigation?.getParent === 'function' ? navigation.getParent() : null;
    if (parent?.navigate) return parent.navigate(screen as any, params as any);
    return navigation.navigate(screen as any, params as any);
  };

  const textDirStyle = useMemo(
    () =>
      isRtl
        ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
        : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const }),
    [isRtl]
  );

  const displayName = useMemo(
    () => (fullName || '').trim() || t('profile.nameFallback'),
    [fullName, t]
  );
  const avatarInitials = useMemo(() => getDisplayInitials(displayName, '?'), [displayName]);

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
        changePhoto: {
          marginTop: spacing.sm,
          alignSelf: 'flex-start',
        },
        card: {
          backgroundColor: colors.cardBackground,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          gap: spacing.md,
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
        dangerZone: {
          gap: spacing.sm,
        },
      }),
    [colors]
  );

  if (profileLoading) return <LoadingView />;
  if (profileError) return <ErrorView message={profileError} onRetry={() => profileBoot()} />;

  const nationalId = user?.nationalId ?? '—';
  const phoneNumber = user?.phoneNumber ?? '—';

  const avatarEl = (
    <View
      style={styles.avatar}
      accessibilityRole="image"
      accessibilityLabel={photoUri ? displayName : `${displayName}, ${avatarInitials}`}
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

  const headerMetaEl = (
    <View style={styles.headerMeta}>
      <RtlPhysicalRightBlock isRtl={isRtl}>
        <Text style={[styles.headerTitle, textDirStyle]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.headerSub, textDirStyle]} numberOfLines={1}>
          {t('profile.verifiedSub')}
        </Text>
      </RtlPhysicalRightBlock>
      <View style={styles.changePhoto}>
        <Button title={t('profile.editProfileButton')} variant="secondary" onPress={() => navigateTo('ProfileEdit')} />
      </View>
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
      </View>

      <View style={styles.dangerZone}>
        <Button
          title={t('profile.logout')}
          variant="secondary"
          onPress={async () => {
            await signOut();
            await clearProfile();
            navigation.navigate('HomeTab');
          }}
        />
      </View>
    </Screen>
  );
}
