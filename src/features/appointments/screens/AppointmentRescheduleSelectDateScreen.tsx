import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { getServiceSlots } from '../../services/api/servicesRepository';
import { useAppointmentsStore } from '../store/useAppointmentsStore';
import type { TimeSlot } from '../../../core/domain/timeSlot';
import { spacing, typography, borderRadius } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';

type Props = NativeStackScreenProps<RootStackParamList, 'AppointmentRescheduleSelectDate'>;

// ─── helpers (shared logic with BookingSelectDateScreen) ─────────────────────

function toDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildWeekendMap(from: Date): Record<string, { disabled: true; disableTouchEvent: true }> {
  const map: Record<string, { disabled: true; disableTouchEvent: true }> = {};
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(from.getFullYear(), from.getMonth() + 8, 0);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow === 5 || dow === 6) {
      map[toDateString(cur)] = { disabled: true, disableTouchEvent: true };
    }
    cur.setDate(cur.getDate() + 1);
  }
  return map;
}

// ─── screen ───────────────────────────────────────────────────────────────────

export function AppointmentRescheduleSelectDateScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const appt = useAppointmentsStore(
    (s) => s.appointments.find((a) => a.id === route.params.appointmentId) ?? null
  );

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayStr = useMemo(() => toDateString(today), [today]);
  const weekendMap = useMemo(() => buildWeekendMap(today), [today]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isRtl ? '' : t('appointments.reschedule') });
  }, [navigation, t, isRtl]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!appt) return;
      setLoading(true);
      const s = await getServiceSlots(appt.serviceId);
      if (mounted) {
        setSlots(s);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [appt?.serviceId]);

  const handleDaySelect = useCallback(
    (dateStr: string) => {
      setSelectedDate(dateStr);
      navigation.navigate('AppointmentRescheduleSelectSlot', {
        appointmentId: appt!.id,
        date: dateStr,
      });
    },
    [navigation, appt]
  );

  const renderDay = useCallback(
    ({ date, state, marking }: any) => {
      const isPast = state === 'disabled';
      const isWeekend = marking?.disabled === true;
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
            styles.cell,
            isSelected && { backgroundColor: colors.primary },
            isDisabled && styles.disabledCell,
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                color: isSelected
                  ? colors.textInverse
                  : isToday
                  ? colors.primary
                  : colors.text,
              },
              isToday && !isSelected && styles.todayText,
            ]}
          >
            {date?.day ?? ''}
          </Text>
          {hasSlot && (
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          )}
        </Pressable>
      );
    },
    [colors, todayStr, handleDaySelect]
  );

  const markedDates = useMemo(() => {
    const availableDates = new Set(slots.filter((x) => x.isAvailable).map((x) => x.date));
    // Merge — preserve disabled flags for Fri/Sat instead of overwriting them
    const base: Record<string, any> = { ...weekendMap };
    for (const d of availableDates) {
      base[d] = { ...(base[d] ?? {}), marked: true };
    }
    if (selectedDate) {
      base[selectedDate] = {
        ...(base[selectedDate] ?? {}),
        selected: true,
        selectedColor: colors.primary,
      };
    }
    return base;
  }, [slots, weekendMap, selectedDate, colors.primary]);

  if (!appt) return <EmptyView />;
  if (loading) return <LoadingView />;

  return (
    <Screen scroll>
      <Text
        style={[
          hintStyle.hint,
          { color: colors.text },
          isRtl ? hintStyle.hintEdgeLeft : hintStyle.hintEdgeRight,
        ]}
      >
        {t('appointments.selectNewDate')}
      </Text>
      <View style={[hintStyle.calendarWrapper, { backgroundColor: colors.surface }]}>
        <Calendar
          markedDates={markedDates}
          minDate={todayStr}
          firstDay={0}
          hideExtraDays
          disableAllTouchEventsForDisabledDays
          dayComponent={renderDay}
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
    </Screen>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
    fontWeight: typography.bold as any,
  },
  dot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

const hintStyle = StyleSheet.create({
  hint: {
    fontSize: typography.lg,
    fontWeight: typography.bold as any,
    marginBottom: spacing.lg,
  },
  hintEdgeRight: {
    alignSelf: 'stretch',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  hintEdgeLeft: {
    alignSelf: 'stretch',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  calendarWrapper: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
});
