import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { ErrorView } from '../../../shared/ui/ErrorView';
import { Button } from '../../../shared/ui/Button';
import type { Service } from '../../../core/domain/service';
import { getServiceById } from '../api/servicesRepository';
import { formatMoney } from '../../../shared/utils/format';
import { spacing, typography, borderRadius, shadows } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { getServiceImageSource } from '../utils/serviceImages';
import { getFeeDisplayDescription, getServiceDisplayDescription, getServiceDisplayName } from '../utils/localization';
import { useRtl } from '../../../core/i18n/useRtl';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceDetails'>;

export function ServiceDetailsScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const styles = React.useMemo(() => createStyles(colors, isRtl), [colors, isRtl]);
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [feesExpanded, setFeesExpanded] = useState(Boolean(route.params.expandFees));

  const feesBreakdown = useMemo(
    () => (Array.isArray(service?.feesBreakdown) ? service.feesBreakdown : []),
    [service?.feesBreakdown]
  );
  const hasFeesBreakdown = feesBreakdown.length > 0;
  const hasMultipleFees = feesBreakdown.length > 1;
const currency = 'ILS';

  // Ensure expandFees param is applied even if it becomes available after mount.
  useEffect(() => {
    if (route.params?.expandFees) setFeesExpanded(true);
  }, [route.params?.expandFees]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: '', headerBackTitle: '' });
  }, [navigation]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const svc = await getServiceById(route.params.serviceId);
        if (mounted) {
          setService(svc);
          // Empty title keeps the native iOS bar blank (no fallback text).
          // The service name is shown prominently below the hero image.
          navigation.setOptions({
            title: '',
            headerBackTitle: '',
          });
        }
      } catch (e: any) {
        if (mounted) setError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [navigation, route.params.serviceId, i18n.language]);

  useEffect(() => {
    if (!service) return;
    navigation.setOptions({
      title: '',
      headerBackTitle: '',
    });
  }, [navigation, service, i18n.language]);

  if (isLoading) return <LoadingView />;
  if (error || !service)
    return (
      <ErrorView
        message={t('common.errorDesc')}
        onRetry={() => navigation.replace('ServiceDetails', { serviceId: route.params.serviceId })}
      />
    );

  const onBook = () => {
    navigation.navigate('BookingSelectDate', { serviceId: service.id });
  };

  return (
    <Screen scroll>
      {/* Image at the top */}
      <Image
        source={getServiceImageSource(service)}
        style={styles.hero}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />

      {/* Book Appointment Button right after image */}
      <Button title={t('services.bookAppointment')} onPress={onBook} style={styles.bookButton} />

      {/* Service Name */}
      <Text style={styles.serviceName}>{getServiceDisplayName(service, i18n.language)}</Text>

      {/* Description */}
      <Text style={styles.description}>{getServiceDisplayDescription(service, i18n.language)}</Text>

      {/* Details Section */}
      <View style={styles.detailsSection}>
        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>{t('services.fees')}</Text>
          <Pressable
            onPress={() => {
              if (!hasFeesBreakdown) return;
              setFeesExpanded((v) => !v);
            }}
            accessibilityRole={hasFeesBreakdown ? 'button' : undefined}
            style={({ pressed }) => [
              styles.feesValueRow,
              hasFeesBreakdown && pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.detailValue}>{formatMoney(service.fees)}</Text>
            {hasFeesBreakdown && (
              <Ionicons
                name={feesExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textSecondary}
              />
            )}
          </Pressable>

          {hasFeesBreakdown && feesExpanded && (
            <View style={[styles.feesDropdown, { borderColor: colors.borderLight, backgroundColor: colors.surface }]}>
              {feesBreakdown.map((fee, idx) => (
                <View
                  key={`${fee.description ?? 'fee'}-${idx}`}
                  style={[
                    styles.feeRow,
                    idx !== feesBreakdown.length - 1 && {
                      borderBottomColor: colors.borderLight,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Text
                    style={[styles.feeDesc, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {getFeeDisplayDescription(fee.description, i18n.language) || t('services.fees')}
                  </Text>
                  <Text style={[styles.feeAmount, { color: colors.text }]} numberOfLines={1}>
                    {formatMoney(fee.amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Required Documents */}
      <Text style={styles.sectionTitle}>{t('services.requiredDocuments')}</Text>
      <View style={styles.list}>
        {service.requiredDocuments.map((d) => (
          <View key={d} style={styles.listItemContainer}>
            <Text style={styles.listItem}>• {d}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>, isRtl: boolean) {
  // User request: physical alignment should start from far-left on iOS RTL.
  // (Keep writingDirection rtl so Arabic glyph flow remains correct.)
  const textAlign = isRtl ? 'left' : 'left';
  const writingDirection = isRtl ? ('rtl' as const) : ('ltr' as const);

  return StyleSheet.create({
  hero: {
    width: '100%',
    height: 250,
    backgroundColor: colors.backgroundSecondary,
    marginBottom: spacing.lg,
  },
  bookButton: {
    marginBottom: spacing.xl,
  },
  serviceName: {
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: typography.xxl * typography.tight,
    textAlign,
    writingDirection,
    alignSelf: 'stretch',
    width: '100%',
  },
  description: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: typography.base * typography.relaxed,
    marginBottom: spacing.xl,
    textAlign,
    writingDirection,
    alignSelf: 'stretch',
    width: '100%',
  },
  detailsSection: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  feesValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
    // Keep icon + amount cluster anchored at physical right in RTL.
    direction: 'ltr',
  },
  feesDropdown: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
    feeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      // Description (left) and amount (right) with stable RTL layout.
      justifyContent: 'space-between',
      flexShrink: 1,
      alignSelf: 'stretch',
      width: '100%',
      // Force physical placement: description stays on the physical left,
      // amount stays on the physical right (prevents iOS RTL mirroring).
      direction: 'ltr',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
  feeDesc: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    textAlign: isRtl ? 'right' : 'left',
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
  },
  feeAmount: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    textAlign: 'right',
    // Digits should not be mirrored.
    writingDirection: 'ltr',
    flexShrink: 0,
  },
  detailCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  detailLabel: {
    fontSize: typography.sm,
    color: colors.textTertiary,
    fontWeight: typography.medium,
    marginBottom: spacing.xs,
    textAlign,
    writingDirection,
    alignSelf: 'stretch',
    width: '100%',
  },
  detailValue: {
    fontSize: typography.lg,
    color: colors.text,
    fontWeight: typography.semibold,
    textAlign: isRtl ? 'right' : 'left',
    writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    alignSelf: 'stretch',
    width: '100%',
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    color: colors.text,
    textAlign,
    writingDirection,
    alignSelf: 'stretch',
    width: '100%',
  },
  list: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  listItemContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'stretch',
    width: '100%',
  },
  listItem: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: typography.base * typography.relaxed,
    textAlign,
    writingDirection,
    alignSelf: 'stretch',
    width: '100%',
  },
  });
}
