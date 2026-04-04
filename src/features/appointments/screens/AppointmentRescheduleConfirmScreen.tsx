import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { getServiceSlots } from '../../services/api/servicesRepository';
import { useAppointmentsStore } from '../store/useAppointmentsStore';
import type { TimeSlot } from '../../../core/domain/timeSlot';
import { Button } from '../../../shared/ui/Button';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';
import { formatTimeLabel } from '../../../shared/utils/format';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'AppointmentRescheduleConfirm'>;

export function AppointmentRescheduleConfirmScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const appt = useAppointmentsStore((s) => s.appointments.find((a) => a.id === route.params.appointmentId) ?? null);
  const isLoading = useAppointmentsStore((s) => s.isLoading);
  const reschedule = useAppointmentsStore((s) => s.reschedule);

  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isRtl ? '' : t('appointments.reschedule') });
  }, [navigation, t, isRtl]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!appt) return;
      setLoading(true);
      const slots = await getServiceSlots(appt.serviceId);
      const chosen = slots.find((s) => s.id === route.params.slotId) ?? null;
      if (mounted) {
        setSlot(chosen);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [appt?.serviceId, route.params.slotId]);

  if (!appt) return <EmptyView />;
  if (loading || !slot) return <LoadingView />;

  const onConfirm = async () => {
    try {
      await reschedule({
        appointmentId: appt.id,
        serviceId: appt.serviceId,
        date: route.params.date,
        slotId: route.params.slotId,
      });
      setShowSuccessAlert(true);
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e?.message ?? t('common.errorDesc'));
    }
  };

  return (
    <Screen>
      <RtlPhysicalRightBlock isRtl={isRtl}>
        <Text style={[styles.title, { color: colors.text }, isRtl ? styles.titleRtl : undefined]}>
          {t('appointments.rescheduleConfirmTitle')}
        </Text>
      </RtlPhysicalRightBlock>

      <RtlPhysicalRightBlock isRtl={isRtl}>
        <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }, isRtl ? styles.boxRtl : undefined]}>
          <Text style={[styles.meta, { color: colors.text }, isRtl ? styles.metaRtl : undefined]}>{appt.serviceName}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }, isRtl ? styles.metaRtl : undefined]}>
            {route.params.date} {formatTimeLabel(slot.startTime)}
          </Text>
        </View>
      </RtlPhysicalRightBlock>

      <Button
        title={t('appointments.reschedule')}
        onPress={onConfirm}
        loading={isLoading}
        disabled={isLoading || appt.status !== 'UPCOMING'}
      />

      <Modal transparent visible={showSuccessAlert} animationType="fade" onRequestClose={() => setShowSuccessAlert(false)}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setShowSuccessAlert(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.cardBackground ?? colors.surface,
              borderRadius: 16,
              width: '100%',
              maxWidth: 340,
              overflow: 'hidden',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Content */}
            <View style={{ padding: 20 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: colors.text,
                  marginBottom: 6,
                  textAlign: 'left',
                  writingDirection: 'ltr',
                }}
              >
                تم التغيير
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  color: colors.textSecondary,
                  lineHeight: 22,
                  textAlign: 'left',
                  writingDirection: 'ltr',
                }}
              >
                تم تغيير موعدك بنجاح
              </Text>
            </View>

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: colors.border }} />

            {/* Button */}
            <Pressable
              style={{ paddingVertical: 14, alignItems: 'center' }}
              onPress={() => {
                setShowSuccessAlert(false);
                navigation.navigate('MainTabs', { screen: 'AppointmentsTab' });
              }}
              accessibilityRole="button"
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>
                حسناً
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '900' },
  titleRtl: {
    alignSelf: 'stretch',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  boxRtl: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
  },
  meta: { opacity: 0.9 },
  metaRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
