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

  const daySlots = useMemo(
    () => slots.filter((x) => x.date === route.params.date && x.isAvailable),
    [route.params.date, slots]
  );

  useEffect(() => {
    if (selectedSlotId) return;
    const preselected = route.params.slotId;
    if (!preselected) return;
    if (daySlots.some((s) => s.id === preselected)) {
      setSelectedSlotId(preselected);
    }
  }, [daySlots, route.params.slotId, selectedSlotId]);

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
    // In RTL: text block is at reading-start (right), icon is at reading-end (left)
    <View style={styles.header}>
      <View style={styles.headerTextContainer}>
        <Text style={styles.title}>{route.params.date}</Text>
        <Text style={styles.subtitle}>{t('booking.selectSlotDescription')}</Text>
      </View>
      <View style={styles.headerIcon}>
        <Ionicons name="time-outline" size={iconSizes.lg} color={colors.primary} />
      </View>
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
            slots={daySlots}
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
      justifyContent: 'space-between',
      gap: spacing.md,
      marginBottom: 0,
      direction: isRtl ? 'rtl' : 'ltr',
    } as any,
    title: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: isRtl ? 'right' : 'left',
    },
    subtitle: {
      fontSize: typography.sm,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      textAlign: isRtl ? 'right' : 'left',
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
    },
    bottomBar: {
      paddingTop: spacing.sm,
    },
    emptyActions: {
      marginTop: spacing.xl,
      alignItems: 'center',
    },
  });
