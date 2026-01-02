import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { getServiceSlots } from '../../services/api/servicesRepository';
import { useAppointmentsStore } from '../store/useAppointmentsStore';
import type { TimeSlot } from '../../../core/domain/timeSlot';
import { Button } from '../../../shared/ui/Button';
import { formatTimeLabel } from '../../../shared/utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'AppointmentRescheduleSelectSlot'>;

export function AppointmentRescheduleSelectSlotScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const appt = useAppointmentsStore((s) => s.appointments.find((a) => a.id === route.params.appointmentId) ?? null);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: t('appointments.reschedule') });
  }, [navigation, t]);

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
        <Text style={[styles.title, { color: colors.text }]}>{route.params.date}</Text>
        <FlatList
          data={daySlots}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const selected = item.id === selectedSlotId;
            return (
              <Pressable
                onPress={() => setSelectedSlotId(item.id)}
                style={[
                  styles.slot,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  selected && { borderColor: colors.primary, backgroundColor: colors.cardHover },
                ]}
                accessibilityRole="button"
                accessibilityLabel={formatTimeLabel(item.startTime)}
              >
                <View style={styles.slotRow}>
                  <Text style={[styles.slotText, { color: colors.text }]}>{formatTimeLabel(item.startTime)}</Text>
                </View>
              </Pressable>
            );
          }}
        />

        {selectedSlotId ? (
          <View style={styles.bottomBar}>
            <Button title={t('common.ok')} onPress={onNext} variant="primary" />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  list: { gap: 10, paddingVertical: 8, paddingBottom: 24 },
  slot: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
  },
  slotRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  slotText: { fontSize: 16, fontWeight: '600' },
  bottomBar: { paddingTop: 10 },
});
