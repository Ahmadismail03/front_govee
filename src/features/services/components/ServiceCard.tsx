import React, { useMemo, useState } from 'react';
import { I18nManager, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Service } from '../../../core/domain/service';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '../../../shared/utils/format';
import { spacing, typography, borderRadius, shadows } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { getServiceImageSource } from '../utils/serviceImages';
import { getFeeDisplayDescription, getServiceDisplayDescription, getServiceDisplayName } from '../utils/localization';

type Props = {
  service: Service;
  onPress: () => void;
};

export function ServiceCard({ service, onPress }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const [feesExpanded, setFeesExpanded] = useState(false);

  const displayName = useMemo(() => getServiceDisplayName(service, i18n.language), [service, i18n.language]);
  const displayDescription = useMemo(
    () => getServiceDisplayDescription(service, i18n.language),
    [service, i18n.language]
  );

  const feesBreakdown = useMemo(
    () => (Array.isArray(service.feesBreakdown) ? service.feesBreakdown : []),
    [service.feesBreakdown]
  );

  const hasMultipleFees = feesBreakdown.length > 1;
  const currency = 'JOD';

  const imageSource = getServiceImageSource(service);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.cardBackground,
          borderRadius: borderRadius.xl,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.md,
        },
        cardPressed: {
          opacity: 0.9,
          transform: [{ scale: 0.98 }],
        },
        imageContainer: {
          width: '100%',
          height: 180,
          position: 'relative',
        },
        serviceImage: {
          width: '100%',
          height: '100%',
        },
        imageOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        },
        badge: {
          position: 'absolute',
          top: spacing.md,
          right: I18nManager.isRTL ? undefined : spacing.md,
          left: I18nManager.isRTL ? spacing.md : undefined,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.md,
          ...shadows.sm,
        },
        badgeText: {
          fontSize: typography.xs,
          fontWeight: typography.semibold,
          color: colors.primary,
        },
        content: {
          padding: spacing.lg,
          gap: spacing.md,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: spacing.sm,
        },
        name: {
          flex: 1,
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.text,
          lineHeight: typography.xl * typography.tight,
        },
        detailsButton: {
          padding: spacing.xs,
        },
        descriptionContainer: {
          backgroundColor: colors.backgroundSecondary,
          padding: spacing.md,
          borderRadius: borderRadius.md,
          marginTop: spacing.xs,
        },
        description: {
          fontSize: typography.sm,
          color: colors.textSecondary,
          lineHeight: typography.sm * typography.relaxed,
        },
        detailsContainer: {
          marginTop: spacing.xs,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          gap: spacing.md,
        },
        detailsRow: {
          flexDirection: 'row',
          gap: spacing.md,
        },
        detailItem: {
          flex: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'flex-start',
        },
        detailIconContainer: {
          width: 32,
          height: 32,
          borderRadius: borderRadius.sm,
          backgroundColor: colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: spacing.xs,
        },
        detailTextContainer: {
          flex: 1,
          gap: spacing.xs,
        },
        detailLabel: {
          fontSize: typography.xs,
          color: colors.textTertiary,
          fontWeight: typography.medium,
        },
        detailValue: {
          fontSize: typography.sm,
          color: colors.text,
          fontWeight: typography.semibold,
        },
        feesValueRow: {
          flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: spacing.xs,
          alignSelf: 'flex-start',
        },
        feesDropdown: {
          borderWidth: 1,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          marginTop: spacing.xs,
        },
        feeRow: {
          flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.md,
        },
        feeDesc: {
          flex: 1,
          fontSize: typography.xs,
          fontWeight: typography.medium,
          textAlign: I18nManager.isRTL ? 'right' : 'left',
        },
        feeAmount: {
          fontSize: typography.xs,
          fontWeight: typography.semibold,
          textAlign: I18nManager.isRTL ? 'left' : 'right',
        },
        infoSection: {
          flexDirection: 'row',
          gap: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.borderLight,
          marginTop: spacing.sm,
        },
        infoItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          flex: 1,
        },
        infoText: {
          fontSize: typography.xs,
          color: colors.textSecondary,
          fontWeight: typography.medium,
        },
      }),
    [colors]
  );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={displayName}
    >
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.serviceImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={styles.imageOverlay} />
      </View>
      
      <View style={styles.content}>
        {/* Service Title */}
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
          <Pressable onPress={onPress} style={styles.detailsButton}>
            <Ionicons
              name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'}
              size={20}
              color={colors.primary}
            />
          </Pressable>
        </View>
        
        {/* Service Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.description} numberOfLines={4}>
            {displayDescription}
          </Text>
        </View>

        {/* Service Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="cash-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>{t('services.fees')}</Text>
                <Pressable
                  onPress={() => {
                    if (!hasMultipleFees) return;
                    setFeesExpanded((v) => !v);
                  }}
                  accessibilityRole={hasMultipleFees ? 'button' : undefined}
                  style={({ pressed }) => [
                    styles.feesValueRow,
                    hasMultipleFees && pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.detailValue}>{formatMoney(service.fees, currency)}</Text>
                  {hasMultipleFees && (
                    <Ionicons
                      name={feesExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textSecondary}
                    />
                  )}
                </Pressable>

                {hasMultipleFees && feesExpanded && (
                  <View style={[styles.feesDropdown, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}>
                    {feesBreakdown.map((fee, idx) => (
                      <View
                        key={`${fee.description ?? 'fee'}-${idx}`}
                        style={[
                          styles.feeRow,
                          idx !== feesBreakdown.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
                        ]}
                      >
                        <Text style={[styles.feeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                          {getFeeDisplayDescription(fee.description, i18n.language) || t('services.fees')}
                        </Text>
                        <Text style={[styles.feeAmount, { color: colors.text }]}> {formatMoney(fee.amount, 'JOD')} </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Additional Info Section */}
          <View style={styles.infoSection}>
            {service.requiredDocuments && service.requiredDocuments.length > 0 && (
              <View style={styles.infoItem}>
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={styles.infoText}>
                  {t('services.documentsCount', { count: service.requiredDocuments.length })}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

