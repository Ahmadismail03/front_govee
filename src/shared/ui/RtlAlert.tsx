import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { useThemeColors } from '../theme/useTheme';
import { spacing, typography, borderRadius } from '../theme/tokens';

interface RtlAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface RtlAlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: RtlAlertButton[];
}

let _setAlert: ((state: RtlAlertState) => void) | null = null;

export function showRtlAlert(
  title: string,
  message: string,
  buttons: RtlAlertButton[] = [{ text: 'حسناً', style: 'cancel' }]
) {
  _setAlert?.({ visible: true, title, message, buttons });
}

export function RtlAlertProvider() {
  const themeColors = useThemeColors();
  const isRtl = I18nManager.isRTL;

  const [alert, setAlert] = useState<RtlAlertState>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  _setAlert = setAlert;

  const dismiss = () => setAlert((prev) => ({ ...prev, visible: false }));

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: themeColors.cardBackground ?? themeColors.surface,
      borderRadius: borderRadius.lg,
      width: '100%',
      maxWidth: 340,
      overflow: 'hidden',
    },
    content: {
      padding: spacing.xl,
    },
    title: {
      fontSize: typography.lg,
      fontWeight: typography.bold as any,
      color: themeColors.text,
      textAlign: 'left',
      writingDirection: 'ltr',
      marginBottom: spacing.sm,
    },
    message: {
      fontSize: typography.base,
      color: themeColors.textSecondary,
      textAlign: 'left',
      writingDirection: 'ltr',
      lineHeight: 22,
    },
    divider: {
      height: 1,
      backgroundColor: themeColors.border,
    },
    buttonsRow: {
      flexDirection: isRtl ? 'row' : 'row-reverse',
    },
    button: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    buttonText: {
      fontSize: typography.base,
      fontWeight: '600',
      color: themeColors.primary,
    },
    cancelButtonText: {
      color: themeColors.textSecondary,
    },
    destructiveButtonText: {
      color: '#EF4444',
    },
    buttonDivider: {
      width: 1,
      backgroundColor: themeColors.border,
    },
  });

  return (
    <Modal
      transparent
      visible={alert.visible}
      animationType="fade"
      onRequestClose={dismiss}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={dismiss}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.content}>
            <Text style={styles.title}>{alert.title}</Text>
            {!!alert.message && (
              <Text style={styles.message}>{alert.message}</Text>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.buttonsRow}>
            {alert.buttons.map((btn, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View style={styles.buttonDivider} />}
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => {
                    dismiss();
                    btn.onPress?.();
                  }}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      btn.style === 'cancel' && styles.cancelButtonText,
                      btn.style === 'destructive' && styles.destructiveButtonText,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
