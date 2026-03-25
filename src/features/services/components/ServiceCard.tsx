import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRtl } from '../../../core/i18n/useRtl';
import type { Service } from '../../../core/domain/service';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { formatMoney } from '../../../shared/utils/format';
import { spacing, typography, borderRadius, shadows } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { getServiceImageSource } from '../utils/serviceImages';
import { getFeeDisplayDescription, getServiceDisplayName } from '../utils/localization';

type Props = {
  service: Service;
  onPress: () => void;
};

export function ServiceCard({ service, onPress }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const [feesExpanded, setFeesExpanded] = useState(false);

  const displayName = useMemo(() => getServiceDisplayName(service, i18n.language), [service, i18n.language]);

  const feesBreakdown = useMemo(
    () => (Array.isArray(service.feesBreakdown) ? service.feesBreakdown : []),
    [service.feesBreakdown]
  );

  const hasMultipleFees = feesBreakdown.length > 1;
const currency = 'ILS';
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
          end: spacing.md,
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
          paddingTop: spacing.lg,
          paddingBottom: spacing.lg,
          paddingLeft: spacing.lg,   // physical left
          paddingRight: 0,           // flush against the right card edge
          gap: spacing.md,
        },
        categoryBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          // RTL: flex-start = physical right; marginStart = physical right gap
          alignSelf: 'flex-start',
          marginStart: spacing.sm,
          backgroundColor: colors.primaryLight,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.full,
        },
        categoryText: {
          fontSize: typography.xs,
          fontWeight: typography.semibold,
          color: colors.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        titleRow: {
          width: '100%',
          flexDirection: 'row-reverse', // chevron always on physical right
          alignItems: 'flex-end',
          gap: spacing.sm,
        },
        name: {
          flex: 1,
          fontSize: typography.xl,
          fontWeight: typography.bold,
          color: colors.text,
          lineHeight: typography.xl * typography.tight,
          textAlign: 'left',
          marginStart: spacing.sm,
          writingDirection: 'rtl',
        },
        detailsButton: {
          padding: spacing.xs,
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
          minWidth: 0,
          alignItems: 'flex-start',
        },
        detailLabel: {
          fontSize: typography.xs,
          color: colors.textTertiary,
          fontWeight: typography.medium,
          textAlign: 'left',
          alignSelf: 'stretch',
        },
        detailValue: {
          fontSize: typography.sm,
          color: colors.text,
          fontWeight: typography.semibold,
          textAlign: 'left',
        },
        feesValueRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          alignSelf: 'stretch',
          justifyContent: 'flex-start',
        },
        feesDropdown: {
          borderWidth: 1,
          borderRadius: borderRadius.md,
          overflow: 'hidden',
          marginTop: spacing.xs,
          alignSelf: 'stretch',
          width: '100%',
        },
        feeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: spacing.xs,
        },
        feeDesc: {
          flex: 1,
          flexBasis: 0,
          minWidth: 0,
          flexShrink: 1,
          fontSize: typography.xs,
          fontWeight: typography.medium,
          textAlign: 'left',
        },
        feeAmount: {
          fontSize: typography.xs,
          fontWeight: typography.semibold,
          flexShrink: 0,
          textAlign: 'right',
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
        {/* Service Title — chevron first so it anchors to far right in RTL */}
        <View style={styles.titleRow}>
          <Pressable onPress={onPress} style={styles.detailsButton}>
            <Ionicons
              name={isRtl ? 'chevron-back' : 'chevron-forward'}
              size={20}
              color={colors.primary}
            />
          </Pressable>
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>
        </View>

        {service.category && (
          <View style={styles.categoryBadge}>
            <Ionicons name="folder-outline" size={14} color={colors.primary} />
            <Text style={styles.categoryText}>{service.category}</Text>
          </View>
        )}

        {/* Service Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <View
                style={[
                  styles.detailIconContainer,
                  // RTL: icon box slightly shifted so it doesn't stick out of the fees dropdown edge.
                  isRtl ? { transform: [{ translateX: -spacing.xs }] } : null,
                ]}
              >
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
                  <Text style={styles.detailValue}>{formatMoney(service.fees)}</Text>
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
                        <Text style={[styles.feeDesc, { color: colors.textSecondary }]}>
                          {getFeeDisplayDescription(fee.description, i18n.language) || t('services.fees')}
                        </Text>
                        <Text style={[styles.feeAmount, { color: colors.text }]}>{formatMoney(fee.amount)}</Text>
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

