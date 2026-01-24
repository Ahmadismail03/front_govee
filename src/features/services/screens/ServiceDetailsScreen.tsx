import React, { useEffect, useMemo, useState } from 'react';
import { I18nManager, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceDetails'>;

export function ServiceDetailsScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [service, setService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [feesExpanded, setFeesExpanded] = useState(false);

  const feesBreakdown = useMemo(
    () => (Array.isArray(service?.feesBreakdown) ? service.feesBreakdown : []),
    [service?.feesBreakdown]
  );
  const hasMultipleFees = feesBreakdown.length > 1;
  const currency = 'JOD';

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      setError(false);
      try {
        const svc = await getServiceById(route.params.serviceId);
        if (mounted) {
          setService(svc);
          navigation.setOptions({ title: getServiceDisplayName(svc, i18n.language) });
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
    navigation.setOptions({ title: getServiceDisplayName(service, i18n.language) });
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
                    idx !== feesBreakdown.length - 1 && {
                      borderBottomColor: colors.borderLight,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Text style={[styles.feeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {getFeeDisplayDescription(fee.description, i18n.language) || t('services.fees')}
                  </Text>
                  <Text style={[styles.feeAmount, { color: colors.text }]}>
                    {formatMoney(fee.amount, 'JOD')}
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

function createStyles(colors: ReturnType<typeof useThemeColors>) {
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
  },
  description: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: typography.base * typography.relaxed,
    marginBottom: spacing.xl,
  },
  detailsSection: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
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
    marginTop: spacing.sm,
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
    fontSize: typography.sm,
    fontWeight: typography.medium,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  feeAmount: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    textAlign: I18nManager.isRTL ? 'left' : 'right',
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
  },
  detailValue: {
    fontSize: typography.lg,
    color: colors.text,
    fontWeight: typography.semibold,
  },
  sectionTitle: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    color: colors.text,
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
  },
  listItem: {
    fontSize: typography.base,
    color: colors.textSecondary,
    lineHeight: typography.base * typography.relaxed,
  },
  });
}
