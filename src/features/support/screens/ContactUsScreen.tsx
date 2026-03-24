import React, { useLayoutEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { ContactCard } from '../../../shared/ui/HeaderMenu';
import { View, StyleSheet, Image, Text } from 'react-native';
import { spacing, typography, borderRadius, shadows } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactUs'>;

export function ContactUsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isRtl } = useRtl();
  const colors = useThemeColors();

  useLayoutEffect(() => {
    navigation.setOptions({ title: isRtl ? '' : t('support.contact.title') });
  }, [navigation, t, isRtl]);

  const textDirStyle = React.useMemo(
    () =>
      isRtl
        ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
        : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const }),
    [isRtl]
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        heroCard: {
          backgroundColor: colors.cardBackground,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: spacing.lg,
          marginBottom: spacing.lg,
          ...shadows.sm,
        },
        heroImage: {
          width: '100%',
          height: 176,
          borderRadius: borderRadius.md,
          marginBottom: spacing.md,
          backgroundColor: colors.surface,
        },
        heroTitle: {
          fontSize: typography.lg,
          fontWeight: typography.bold,
          color: colors.text,
          marginBottom: spacing.xs,
          alignSelf: 'stretch',
        },
        heroSubtitle: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          lineHeight: typography.sm * typography.relaxed,
          alignSelf: 'stretch',
        },
        footer: {
          marginTop: spacing.xl,
          alignSelf: 'stretch',
        },
        footerText: {
          fontSize: typography.xs,
          color: colors.textTertiary,
          alignSelf: 'stretch',
        },
      }),
    [colors]
  );

  return (
    <Screen scroll>
      <View style={styles.heroCard}>
        <Image
          source={require('../../../../assets/support/contact-hero.jpg')}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.heroTitle, textDirStyle]}>
            {t('support.contact.heroTitle')}
          </Text>
        </RtlPhysicalRightBlock>
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.heroSubtitle, textDirStyle]}>
            {t('support.contact.heroSubtitle')}
          </Text>
        </RtlPhysicalRightBlock>
      </View>

      <ContactCard
        title={t('support.contact.cardTitle')}
        description={t('support.contact.cardDesc')}
        email={t('support.contact.email')}
        phone={t('support.contact.phone')}
      />

      <View style={styles.footer}>
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.footerText, textDirStyle]}>
            {t('support.contact.footerCopyright')}
          </Text>
        </RtlPhysicalRightBlock>
      </View>
    </Screen>
  );
}
