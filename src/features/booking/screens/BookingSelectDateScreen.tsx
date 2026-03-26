import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { getServiceSlots } from '../../services/api/servicesRepository';
import type { TimeSlot } from '../../../core/domain/timeSlot';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { ErrorView } from '../../../shared/ui/ErrorView';
import { spacing, typography, borderRadius, shadows, iconSizes } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingSelectDate'>;

// ─── helpers ──────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Pre-computes a disabled-map for every Friday (5) and Saturday (6)
 * covering currentMonth through currentMonth+7, so weekends are
 * blocked on all platforms without any manual per-tap checks.
 */
function buildWeekendMap(from: Date): Record<string, { disabled: true; disableTouchEvent: true }> {
  const map: Record<string, { disabled: true; disableTouchEvent: true }> = {};
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(from.getFullYear(), from.getMonth() + 8, 0);
  while (cur <= end) {
    const dow = cur.getDay(); // 0 Sun … 5 Fri  6 Sat
    if (dow === 5 || dow === 6) {
      map[toDateString(cur)] = { disabled: true, disableTouchEvent: true };
    }
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

// ─── screen ───────────────────────────────────────────────────────────────────

export function BookingSelectDateScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const styles = useMemo(() => createStyles(colors, isRtl), [colors, isRtl]);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(route.params.date ?? null);

  // Stable "today" reference — recomputed only on mount
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = useMemo(() => toDateString(today), [today]);

  // Weekend disabled map — stable, recomputed only on mount
  const weekendMap = useMemo(() => buildWeekendMap(today), [today]);

  useLayoutEffect(() => {
    // RTL: clear native center title — RtlStackHeaderRight shows Arabic from route map
    navigation.setOptions({ title: isRtl ? '' : t('booking.selectDate') });
  }, [navigation, t, isRtl]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const s = await getServiceSlots(route.params.serviceId);
        if (!mounted) return;
        setSlots(s);
      } catch {
        if (!mounted) return;
        setError(true);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [reloadToken, route.params.serviceId]);

  // Stable selection handler
  const handleDaySelect = useCallback(
    (dateStr: string) => {
      setSelectedDate(dateStr);
      navigation.navigate('BookingSelectSlot', {
        serviceId: route.params.serviceId,
        date: dateStr,
      });
    },
    [navigation, route.params.serviceId]
  );

  /**
   * Custom day renderer — gives us:
   *  • opacity 0.3 on every disabled day (past + Fri/Sat), cross-platform
   *  • full selected / today / dot-marker styling
   *  • right-aligned digits via textAlign:'center' inside a centred cell
   */
  const renderDay = useCallback(
    ({ date, state, marking }: any) => {
      const isPast = state === 'disabled';           // handled by minDate
      const isWeekend = marking?.disabled === true;  // handled by weekendMap
      const isDisabled = isPast || isWeekend;
      const isSelected = !isDisabled && marking?.selected === true;
      const isToday = date?.dateString === todayStr;
      const hasSlot = !isDisabled && marking?.marked === true;

      return (
        <Pressable
          onPress={() => {
            if (!isDisabled && date) handleDaySelect(date.dateString);
          }}
          disabled={isDisabled}
          style={[
            dayCellStyles.cell,
            isSelected && { backgroundColor: colors.primary },
            isDisabled && dayCellStyles.disabledCell,
          ]}
        >
          <Text
            style={[
              dayCellStyles.dayText,
              {
                color: isSelected
                  ? colors.textInverse
                  : isToday
                  ? colors.primary
                  : colors.text,
              },
              isToday && !isSelected && (dayCellStyles.todayText as any),
            ]}
          >
            {date?.day ?? ''}
          </Text>

          {/* availability dot */}
          {hasSlot && (
            <View style={[dayCellStyles.dot, { backgroundColor: colors.primary }]} />
          )}
        </Pressable>
      );
    },
    [colors, todayStr, handleDaySelect]
  );

  if (loading) return <LoadingView />;
  if (error)
    return (
      <ErrorView
        message={t('common.errorDesc')}
        onRetry={() => setReloadToken((x) => x + 1)}
      />
    );

  const availableDates = new Set(slots.filter((x) => x.isAvailable).map((x) => x.date));

  // Build markedDates by MERGING — never overwrite disabled flags with slot markers.
  // Spreading availableDates after weekendMap would strip `disabled:true` from Fri/Sat.
  const markedDates: Record<string, any> = { ...weekendMap };
  for (const d of availableDates) {
    markedDates[d] = { ...(markedDates[d] ?? {}), marked: true };
  }
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] ?? {}),
      selected: true,
      selectedColor: colors.primary,
    };
  }

  return (
    <Screen scroll>
      {/* ── Header icon + title ── */}
      <View style={styles.headerSection}>
        <View style={styles.headerIconContainer}>
          <Ionicons name="calendar-outline" size={iconSizes.xxl} color={colors.primary} />
        </View>
        <Text style={styles.headerTitle}>{t('booking.selectDate')}</Text>
      </View>

      {/* ── Description + bullet points ── */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.description}>{t('booking.selectDateDescription')}</Text>
        <View style={styles.descriptionPoints}>
          {(['booking.datePoint1', 'booking.datePoint2', 'booking.datePoint3'] as const).map(
            (key) => (
              <View key={key} style={styles.pointItem}>
                <Ionicons name="checkmark-circle" size={iconSizes.sm} color={colors.success} />
                <Text style={styles.pointText}>{t(key)}</Text>
              </View>
            )
          )}
        </View>
      </View>

      {/* ── Calendar ── */}
      <View style={styles.calendarContainer}>
        <View style={styles.calendarWrapper}>
          <Calendar
            markedDates={markedDates}
            minDate={todayStr}
            firstDay={0}
            hideExtraDays
            disableAllTouchEventsForDisabledDays
            dayComponent={renderDay}
            /**
             * renderArrow gives explicit control over arrow icons on every platform.
             * With I18nManager.forceRTL active, the Calendar flips the arrow positions
             * automatically; we just supply the correct icon for each direction.
             *   direction='left'  → Previous-month button (visually on the RIGHT in RTL)
             *   direction='right' → Next-month button     (visually on the LEFT  in RTL)
             */
            renderArrow={(direction) => (
              <Ionicons
                name={direction === 'left' ? 'chevron-forward' : 'chevron-back'}
                size={20}
                color={colors.primary}
              />
            )}
            theme={{
              todayTextColor: colors.primary,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.textInverse,
              arrowColor: colors.primary,
              monthTextColor: colors.text,
              textDayFontWeight: typography.medium,
              textMonthFontWeight: typography.bold,
              textDayHeaderFontWeight: typography.semibold,
              dayTextColor: colors.text,
              textDisabledColor: colors.textTertiary,
            }}
          />
        </View>
      </View>

      {/* Info footer card intentionally removed per RTL UI request */}
    </Screen>
  );
}

// ─── static day-cell styles (no theme dependency) ─────────────────────────────

const dayCellStyles = StyleSheet.create({
  cell: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
  },
  disabledCell: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: typography.base,
    fontWeight: typography.regular as any,
    textAlign: 'center',
  },
  todayText: {
    fontWeight: typography.bold,
  },
  dot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

// ─── themed styles ────────────────────────────────────────────────────────────

const createStyles = (colors: ReturnType<typeof useThemeColors>, isRtl: boolean) =>
  StyleSheet.create({
    headerSection: {
      alignItems: 'center',
      marginBottom: spacing.xl,
      paddingVertical: spacing.lg,
    },
    headerIconContainer: {
      width: 80,
      height: 80,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      ...shadows.md,
    },
    headerTitle: {
      fontSize: typography.xxl,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: 'center',
    },
    descriptionContainer: {
      backgroundColor: colors.surface,
      padding: spacing.xl,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.xl,
      ...shadows.sm,
    },
    description: {
      fontSize: typography.base,
      color: colors.textSecondary,
      lineHeight: typography.base * typography.relaxed,
      marginBottom: spacing.md,
    },
    descriptionPoints: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    // flexDirection:'row' + I18nManager RTL → first child (icon) on the RIGHT,
    // text follows to the LEFT — correct Arabic bullet-point layout.
    pointItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    pointText: {
      flex: 1,
      fontSize: typography.sm,
      color: colors.text,
      lineHeight: typography.sm * typography.relaxed,
    },
    calendarContainer: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      marginBottom: spacing.md,
    },
    calendarWrapper: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      overflow: 'hidden',
      ...shadows.md,
    },
    infoContainer: {
      backgroundColor: colors.infoLight,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.lg,
      // Logical property: accent bar always at the reading-start edge
      borderStartWidth: 4,
      borderStartColor: colors.info,
    },
    // row-reverse in RTL: icon on LEFT, text on RIGHT
    // row in LTR:         icon on LEFT, text on RIGHT
    infoItem: {
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    infoContent: {
      flex: 1,
      gap: spacing.xs,
    },
    infoTitle: {
      fontSize: typography.base,
      fontWeight: typography.semibold,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    infoText: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      lineHeight: typography.sm * typography.relaxed,
    },
  });
