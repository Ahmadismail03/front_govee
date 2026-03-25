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

      <Modal transparent visible={showSuccessAlert} animationType="fade">
        <Pressable style={styles.alertOverlay} onPress={() => setShowSuccessAlert(false)}>
          <Pressable
            style={[styles.alertCard, isRtl ? styles.alertCardRtl : undefined]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.alertTitle, isRtl ? styles.alertTextRtl : undefined]}>تم التغيير</Text>
            <Text style={[styles.alertMessage, isRtl ? styles.alertTextRtl : undefined]}>
              تم تغيير موعدك بنجاح
            </Text>
            <View style={[styles.alertActions, isRtl ? styles.alertActionsRtl : undefined]}>
              <Pressable
                style={styles.alertButton}
                onPress={() => {
                  setShowSuccessAlert(false);
                  navigation.navigate('MainTabs', { screen: 'AppointmentsTab' });
                }}
                accessibilityRole="button"
              >
                <Text style={styles.alertButtonText}>حسناً</Text>
              </Pressable>
            </View>
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
  alertCard: {
    backgroundColor: '#3a3a3a',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    width: '86%',
    maxWidth: 380,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  alertCardRtl: {
    alignItems: 'flex-start',
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  alertMessage: {
    fontSize: 13,
    opacity: 0.9,
    color: '#fff',
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  alertTextRtl: {
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  alertActions: {
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
  },
  alertActionsRtl: {
    alignItems: 'center',
  },
  alertButton: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
