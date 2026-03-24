import React, { useLayoutEffect, useMemo } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { useAppointmentsStore } from '../store/useAppointmentsStore';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { useRtl } from '../../../core/i18n/useRtl';
import { RtlPhysicalRightBlock } from '../../../shared/ui/RtlPhysicalRightBlock';

type Props = NativeStackScreenProps<RootStackParamList, 'AppointmentCancelConfirm'>;

export function AppointmentCancelConfirmScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { isRtl } = useRtl();
  const colors = useThemeColors();
  const appointments = useAppointmentsStore((s) => s.appointments);
  const isLoading = useAppointmentsStore((s) => s.isLoading);
  const cancel = useAppointmentsStore((s) => s.cancel);

  const appt = useMemo(
    () => appointments.find((a) => a.id === route.params.appointmentId) ?? null,
    [appointments, route.params.appointmentId]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: isRtl ? '' : t('appointments.cancel') });
  }, [navigation, t, isRtl]);

  const textDirStyle = useMemo(
    () =>
      isRtl
        ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
        : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const }),
    [isRtl]
  );

  if (!appt) return <EmptyView />;

  const onConfirm = async () => {
    Alert.alert(
      'تأكيد الإلغاء',
      'هل أنت متأكد من إلغاء الموعد؟',
      [
        {
          text: 'لا',
          style: 'cancel'
        },
        {
          text: 'نعم',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancel(appt.id);
              navigation.navigate('MainTabs', { screen: 'AppointmentsTab' });
            } catch {
              Alert.alert(t('common.errorTitle'));
            }
          }
        }
      ]
    );
  };

  return (
    <Screen>
      <RtlPhysicalRightBlock isRtl={isRtl}>
        <Text style={[styles.title, textDirStyle, { color: colors.text }]}>
          {t('appointments.cancelConfirmTitle')}
        </Text>
      </RtlPhysicalRightBlock>
      <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.meta, textDirStyle, { color: colors.text }]}>{appt.serviceName}</Text>
        </RtlPhysicalRightBlock>
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.meta, textDirStyle, { color: colors.textSecondary }]}>
            {appt.date} {appt.startTime}-{appt.endTime}
          </Text>
        </RtlPhysicalRightBlock>
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.meta, textDirStyle, { color: colors.textTertiary }]}>
            {appt.referenceNumber}
          </Text>
        </RtlPhysicalRightBlock>
      </View>
      <View style={isRtl ? styles.cancelBtnRtl : styles.cancelBtnLtr}>
        <Button
          title={t('appointments.cancel')}
          onPress={onConfirm}
          disabled={isLoading || appt.status !== 'UPCOMING'}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '900', alignSelf: 'stretch' },
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    alignSelf: 'stretch',
  },
  meta: { opacity: 0.9, alignSelf: 'stretch' },
  cancelBtnRtl: {
    alignSelf: 'stretch',
    direction: 'ltr',
    alignItems: 'flex-end',
  },
  cancelBtnLtr: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
  },
});
