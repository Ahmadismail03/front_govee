import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import type { TimeSlot } from '../../../core/domain/timeSlot';
import { getServiceSlots } from '../../services/api/servicesRepository';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { ErrorView } from '../../../shared/ui/ErrorView';
import { Screen } from '../../../shared/ui/Screen';
import { Button } from '../../../shared/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, iconSizes } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';
import { TimeSlotChipGrid } from '../../../shared/ui/TimeSlotChipGrid';

type Props = NativeStackScreenProps<RootStackParamList, 'BookingSelectSlot'>;

export function BookingSelectSlotScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const styles = useMemo(() => createStyles(colors, isRtl), [colors, isRtl]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(route.params.slotId ?? null);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useLayoutEffect(() => {
    navigation.setOptions({ title: isRtl ? '' : t('booking.selectSlot') });
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

  const todayYmd = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const isBookingToday = route.params.date === todayYmd;

  const todayMonthKey = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }, []);

  const isOutsideCurrentMonth = useMemo(() => {
    const [y, m] = route.params.date.split('-');
    const monthKey = `${y}-${String(m ?? '').padStart(2, '0')}`;
    return monthKey !== todayMonthKey;
  }, [route.params.date, todayMonthKey]);

  // Tick so "today" chips become disabled right after time passes (e.g. 01:30)
  useEffect(() => {
    if (!isBookingToday) return;
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [isBookingToday]);

  const daySlots = useMemo(
    () => slots.filter((x) => x.date === route.params.date),
    [route.params.date, slots]
  );

  const daySlotItems = useMemo(() => {
    const [y, m, d] = route.params.date.split('-').map((n) => Number(n));
    const yNum = y;
    const mIdx = (m ?? 1) - 1;
    const dNum = d;

    return daySlots.map((s) => {
      const [hhStr, minStr] = s.startTime.split(':');
      const hh = Number(hhStr);
      const min = Number(minStr);
      const slotDate = new Date(yNum, mIdx, dNum, hh, min);
      // If it's today and the time is reached (01:30 inclusive), treat as "past"
      // so it becomes disabled once the time is reached.
      const isPast = isBookingToday && slotDate.getTime() <= nowMs;
      return {
        id: s.id,
        startTime: s.startTime,
        disabled: !s.isAvailable || isPast || isOutsideCurrentMonth,
      };
    });
  }, [daySlots, isBookingToday, isOutsideCurrentMonth, nowMs, route.params.date]);

  // Keep selection valid (don't allow selecting disabled chips).
  useEffect(() => {
    if (!selectedSlotId) return;
    const selectedItem = daySlotItems.find((x) => x.id === selectedSlotId);
    if (selectedItem?.disabled) setSelectedSlotId(null);
  }, [daySlotItems, selectedSlotId]);

  useEffect(() => {
    if (selectedSlotId) return;
    const preselected = route.params.slotId;
    if (!preselected) return;
    const selectedItem = daySlotItems.find((x) => x.id === preselected);
    if (selectedItem && !selectedItem.disabled) setSelectedSlotId(preselected);
  }, [daySlotItems, route.params.slotId, selectedSlotId]);

  if (loading) return <LoadingView />;
  if (error)
    return <ErrorView message={t('common.errorDesc')} onRetry={() => setReloadToken((x) => x + 1)} />;
  if (daySlots.length === 0)
    return (
      <Screen>
        <EmptyView
          title={t('booking.noSlotsTitle')}
          description={t('booking.noSlotsDesc')}
        />
        <View style={styles.emptyActions}>
          <Button title={t('common.ok')} onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );

  const onNext = () => {
    if (!selectedSlotId) return;
    navigation.navigate('BookingConfirm', {
      serviceId: route.params.serviceId,
      date: route.params.date,
      slotId: selectedSlotId,
    });
  };

  const ListHeader = () => (
    <View style={styles.header}>
      {isRtl ? (
        <>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>{route.params.date}</Text>
              <Text style={styles.subtitle}>{t('booking.selectSlotDescription')}</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="time-outline" size={iconSizes.lg} color={colors.primary} />
            </View>
        </>
      ) : (
        <>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{route.params.date}</Text>
            <Text style={styles.subtitle}>{t('booking.selectSlotDescription')}</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="time-outline" size={iconSizes.lg} color={colors.primary} />
          </View>
        </>
      )}
    </View>
  );

  return (
    <Screen>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ListHeader />
          <TimeSlotChipGrid
            slots={daySlotItems}
            selectedSlotId={selectedSlotId}
            onSelect={setSelectedSlotId}
          />
        </ScrollView>

        {selectedSlotId ? (
          <View style={styles.bottomBar}>
            <Button title={t('common.ok')} onPress={onNext} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>, isRtl: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    // Header: row with text at reading-start (right in RTL) and icon at reading-end (left in RTL)
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: isRtl ? 'flex-start' : 'space-between',
      gap: isRtl ? spacing.xs : spacing.md,
      marginBottom: 0,
      // Force LTR so the start is physical left, and we control RTL visually.
      direction: 'ltr',
    } as any,
    title: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: isRtl ? 'right' : 'left',
      writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    },
    subtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      textAlign: isRtl ? 'right' : 'left',
      writingDirection: isRtl ? ('rtl' as const) : ('ltr' as const),
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerTextContainer: {
      flex: 1,
      alignItems: isRtl ? 'flex-end' : 'flex-start',
    },
    bottomBar: {
      paddingTop: spacing.sm,
    },
    emptyActions: {
      marginTop: spacing.xl,
      alignItems: 'center',
    },
  });
