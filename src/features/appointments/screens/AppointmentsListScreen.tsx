import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, Image } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import type { TabsParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { useAppointmentsStore } from '../store/useAppointmentsStore';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { ErrorView } from '../../../shared/ui/ErrorView';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { useAuthStore } from '../../auth/store/useAuthStore';
import type { Appointment } from '../../../core/domain/appointment';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, shadows, iconSizes } from '../../../shared/theme/tokens';
import { useThemeColors, type ThemeColors } from '../../../shared/theme/useTheme';
import { Button } from '../../../shared/ui/Button';
import { useServicesStore } from '../../services/store/useServicesStore';
import { getServiceImageSource } from '../../services/utils/serviceImages';
import { useRtl } from '../../../core/i18n/useRtl';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

type Props = BottomTabScreenProps<TabsParamList, 'AppointmentsTab'>;

export function AppointmentsListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { isRtl } = useRtl();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textDirStyle = useMemo(
    () =>
      isRtl
        ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
        : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const }),
    [isRtl]
  );
  const token = useAuthStore((s) => s.token);
  const load = useAppointmentsStore((s) => s.load);
  const isLoading = useAppointmentsStore((s) => s.isLoading);
  const error = useAppointmentsStore((s) => s.error);
  const appointments = useAppointmentsStore((s) => s.appointments);
  const [segment, setSegment] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  const forceLeftLayout = segment === 'PAST';

  useEffect(() => {
    if (token) load();
    // Intentionally depend only on `token` to avoid re-running due to unstable action references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visible = useMemo(() => {
    if (!appointments || !Array.isArray(appointments)) return [];
    return appointments.filter((a) =>
      segment === 'UPCOMING' ? a.status === 'UPCOMING' : a.status !== 'UPCOMING'
    );
  }, [appointments, segment]);

  // Auth gating is handled by RequireAuth. If the token is missing here,
  // allow the store/API layer to surface an error instead of navigating.

  if (isLoading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <Screen>
      {/* Title + icon under the red bar; Arabic: both on physical right (icon at edge). */}
      <View style={[styles.header, isRtl && !forceLeftLayout ? styles.headerRtl : styles.headerLtr]}>
        {isRtl && !forceLeftLayout ? (
          <>
            <View style={[styles.headerTextContainer, styles.headerTextContainerRtl]}>
              <RtlPhysicalRightBlock isRtl={isRtl}>
                <Text style={[styles.headerTitle, textDirStyle]}>{t('appointments.title')}</Text>
              </RtlPhysicalRightBlock>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="calendar-outline" size={iconSizes.lg} color={colors.primary} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.headerIcon}>
              <Ionicons name="calendar-outline" size={iconSizes.lg} color={colors.primary} />
            </View>
            <View style={styles.headerTextContainer}>
              <RtlPhysicalRightBlock isRtl={false}>
                <Text style={[styles.headerTitle, textDirStyle]}>{t('appointments.title')}</Text>
              </RtlPhysicalRightBlock>
            </View>
          </>
        )}
      </View>

      <View style={styles.segment}>
        <Pressable
          style={[styles.segBtn, segment === 'UPCOMING' && styles.segSelected]}
          onPress={() => setSegment('UPCOMING')}
          accessibilityRole="button"
        >
          <Text style={[styles.segText, segment === 'UPCOMING' && styles.segTextSelected]}>
            {t('appointments.upcoming')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, segment === 'PAST' && styles.segSelected]}
          onPress={() => setSegment('PAST')}
          accessibilityRole="button"
        >
          <Text style={[styles.segText, segment === 'PAST' && styles.segTextSelected]}>
            {t('appointments.past')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.segmentHintRow}>
        <Ionicons name="information-circle-outline" size={iconSizes.sm} color={colors.info} />
        <Text style={styles.segmentHintText}>
          {segment === 'UPCOMING'
            ? t('appointments.upcomingHint')
            : t('appointments.pastHint')}
        </Text>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item, index) => `${item.id}-${item.startTime}-${item.date}-${index}`}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AppointmentRow
            item={item}
            colors={colors}
            styles={styles}
            forceLeftLayout={forceLeftLayout}
            onPress={() =>
              navigation.getParent()?.navigate('AppointmentDetails' as any, {
                appointmentId: item.id,
              })
            }
          />
        )}
        ListEmptyComponent={<EmptyView icon="calendar-outline" title={t('appointments.emptyTitle')} description={t('appointments.emptyDesc')} />}
      />
    </Screen>
  );
}

type Styles = ReturnType<typeof createStyles>;

function AppointmentRow({
  item,
  onPress,
  colors,
  styles,
  forceLeftLayout = false,
}: {
  item: Appointment;
  onPress: () => void;
  colors: ThemeColors;
  styles: Styles;
  forceLeftLayout?: boolean;
}) {
  const { t } = useTranslation();
  const { isRtl } = useRtl();
  const useRtlRowLayout = isRtl && !forceLeftLayout;
  const textDirStyle = useRtlRowLayout
    ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
    : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const });
  const statusColor =
    item.status === 'UPCOMING'
      ? colors.success
      : item.status === 'PAST'
        ? colors.info
        : colors.textTertiary;

  const statusText =
    item.status === 'UPCOMING'
      ? t('appointments.upcoming')
      : item.status === 'PAST'
        ? t('appointments.past')
        : t('appointments.cancel');

  // Use same images as services list based on serviceId
  const services = useServicesStore((s) => s.services);
  const svc = services.find((s) => s.id === item.serviceId);
  const imageSource = svc
    ? getServiceImageSource({ id: svc.id, category: svc.category, imageKey: svc.imageKey })
    : require('../../../../assets/promo/promo_services.png');

  const timeRange = `${item.startTime}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.referenceNumber}
    >
      <View style={styles.rowHeader}>
        <View style={styles.rowImageContainer}>
          <Image
            source={imageSource}
            style={styles.rowImage}
            resizeMode="cover"
          />
        </View>
        <View style={[styles.rowContent, useRtlRowLayout && styles.rowContentRtl]}>
          <View style={[styles.rowTitleLine, useRtlRowLayout && styles.rowTitleLineRtlLeft]}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]} />
            <Text style={[styles.rowTitle, useRtlRowLayout ? styles.rowTitleRtlLeft : textDirStyle]} numberOfLines={1}>
              {item.serviceName}
            </Text>
          </View>
          <View style={[styles.rowMeta, useRtlRowLayout && styles.rowMetaRtl]}>
            <Ionicons name="time-outline" size={iconSizes.xs} color={colors.textSecondary} />
            <Text style={[styles.rowMetaText, textDirStyle]}>
              {item.date}  {timeRange}
            </Text>
          </View>
          <View style={[styles.rowMeta, useRtlRowLayout && styles.rowMetaRtl]}>
            <Ionicons name="receipt-outline" size={iconSizes.xs} color={colors.textSecondary} />
            <Text style={[styles.rowMetaText, textDirStyle]}>{item.referenceNumber}</Text>
          </View>
          <View style={[styles.rowStatusLine, useRtlRowLayout && styles.rowStatusLineRtlLeft]}>
            <Text style={[styles.rowDescription, useRtlRowLayout ? styles.rowDescriptionRtlLeft : textDirStyle]} numberOfLines={2}>
              {statusText}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
      alignSelf: 'stretch',
    },
    headerLtr: {
      justifyContent: 'flex-start',
    },
    headerRtl: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      direction: 'ltr',
    },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTextContainer: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 0,
    },
    headerTextContainerRtl: {
      flex: 0,
      flexGrow: 0,
      flexShrink: 1,
      maxWidth: '78%',
    },
    headerTitle: {
      fontSize: typography.xl,
      fontWeight: typography.bold,
      color: colors.text,
      alignSelf: 'stretch',
    },
    headerDescription: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: typography.sm * typography.relaxed,
    },
    segment: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
      backgroundColor: colors.backgroundSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.xs,
    },
    segBtn: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      borderRadius: borderRadius.sm,
    },
    segSelected: {
      backgroundColor: colors.surface,
      ...shadows.sm,
    },
    segText: {
      fontSize: typography.sm,
      fontWeight: typography.medium,
      color: colors.textSecondary,
    },
    segTextSelected: {
      color: colors.text,
      fontWeight: typography.bold,
    },
    segmentHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    segmentHintText: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: typography.sm * typography.relaxed,
      textAlign: 'left',
    },
    list: {
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    row: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.sm,
    },
    rowPressed: {
      backgroundColor: colors.cardHover,
      opacity: 0.8,
    },
    rowHeader: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    rowImageContainer: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      backgroundColor: colors.primaryLight,
    },
    rowImage: {
      width: '100%',
      height: '100%',
    },
    rowContent: {
      flex: 1,
      gap: spacing.xs,
    },
    rowContentRtl: {
      alignItems: 'flex-end',
    },
    rowTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      flex: 1,
    },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'stretch',
    },
    rowTitleLineRtlLeft: {
      justifyContent: 'flex-start',
    },
    rowTitleRtlLeft: {
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    rowMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    rowMetaRtl: {
      flexDirection: 'row-reverse',
      justifyContent: 'flex-end',
      alignSelf: 'stretch',
    },
    rowMetaText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    rowDescription: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      alignSelf: 'stretch',
    },
    rowDescriptionRtlLeft: {
      textAlign: 'left',
      writingDirection: 'rtl',
    },
    rowStatusLine: {
      marginTop: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'stretch',
    },
    rowStatusLineRtlLeft: {
      justifyContent: 'flex-start',
    },
    statusBadge: {
      width: 8,
      height: 8,
      borderRadius: borderRadius.full,
    },
  });

