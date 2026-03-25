import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';
import { getServiceSlots } from '../../services/api/servicesRepository';
import { useAppointmentsStore } from '../store/useAppointmentsStore';
import type { TimeSlot } from '../../../core/domain/timeSlot';
import { Button } from '../../../shared/ui/Button';
import { TimeSlotChipGrid } from '../../../shared/ui/TimeSlotChipGrid';
import { spacing, typography } from '../../../shared/theme/tokens';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'AppointmentRescheduleSelectSlot'>;

export function AppointmentRescheduleSelectSlotScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const styles = useMemo(() => createStyles(colors, isRtl), [colors, isRtl]);
  const appt = useAppointmentsStore((s) => s.appointments.find((a) => a.id === route.params.appointmentId) ?? null);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

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

  const daySlots = useMemo(() => {
    return slots.filter((x) => x.date === route.params.date && x.isAvailable);
  }, [route.params.date, slots]);

  if (!appt) return <EmptyView />;
  if (loading) return <LoadingView />;
  if (daySlots.length === 0) return <EmptyView title={t('common.emptyTitle')} description={t('appointments.noSlots')} />;

  const onNext = () => {
    if (!selectedSlotId) return;
    navigation.navigate('AppointmentRescheduleConfirm', {
      appointmentId: appt.id,
      date: route.params.date,
      slotId: selectedSlotId,
    });
  };

  return (
    <Screen>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RtlPhysicalRightBlock isRtl={isRtl}>
            <Text style={styles.title}>{route.params.date}</Text>
          </RtlPhysicalRightBlock>
          <TimeSlotChipGrid
            slots={daySlots}
            selectedSlotId={selectedSlotId}
            onSelect={setSelectedSlotId}
          />
        </ScrollView>

        {selectedSlotId ? (
          <View style={styles.bottomBar}>
            <Button title={t('common.ok')} onPress={onNext} variant="primary" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>, isRtl: boolean) =>
  StyleSheet.create({
    container: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: {
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    title: {
      fontSize: typography.lg,
      fontWeight: typography.bold,
      color: colors.text,
      textAlign: isRtl ? 'right' : 'left',
      writingDirection: isRtl ? 'rtl' : 'ltr',
      alignSelf: 'stretch',
      marginBottom: spacing.sm,
    },
    bottomBar: { paddingTop: spacing.sm },
  });
