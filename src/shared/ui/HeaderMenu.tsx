import React, { useMemo, useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { borderRadius, iconSizes, shadows, spacing, typography } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';
import { useRtl } from '../../core/i18n/useRtl';
type MenuItem = {
  key: string;
  icon: string;
  title: string;
  onPress: () => void;
};

export function HeaderMenuButton() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const navigateTo = (screen: string, params?: any) => {
    const parent = typeof navigation?.getParent === 'function' ? navigation.getParent() : null;
    if (parent?.navigate) return parent.navigate(screen as any, params as any);
    return navigation.navigate(screen as any, params as any);
  };

  const items = useMemo<MenuItem[]>(
    () => [
      {
        key: 'contact',
        icon: 'call-outline',
        title: t('header.menu.contactUs'),
        onPress: () => navigateTo('ContactUs'),
      },
      {
        key: 'support',
        icon: 'headset',
        title: t('header.menu.technicalSupport'),
        onPress: () => navigateTo('TechnicalSupport'),
      },
      {
        key: 'report',
        icon: 'bug-outline',
        title: t('header.menu.reportProblem'),
        onPress: () => navigateTo('ReportProblem'),
      },
      {
        key: 'settings',
        icon: 'settings-outline',
        title: t('header.menu.settings'),
        onPress: () => navigateTo('Settings'),
      },
    ],
    [t]
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('header.menu.open')}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Ionicons name="menu" size={iconSizes.md} color={colors.headerText} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[styles.menu, { start: spacing.md }]}
          >
            {items.map((it) => (
              <Pressable
                key={it.key}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => {
                  setOpen(false);
                  it.onPress();
                }}
              >
                <Ionicons name={it.icon as any} size={iconSizes.sm} color={colors.text} />
                <Text style={styles.itemText}>{it.title}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

type ContactCardProps = {
  title: string;
  description?: string;
  email?: string;
  phone?: string;
};

/** Arabic: pin copy to the physical right; `textAlign` is not mirrored by rtl ancestors. */
function RtlPhysicalRightBlock({
  isRtl,
  layout = 'fullWidth',
  children,
}: {
  isRtl: boolean;
  /** `fullWidth` = card titles; `shrink` = trailing hint in a row. */
  layout?: 'fullWidth' | 'shrink';
  children: React.ReactNode;
}) {
  if (!isRtl) return <>{children}</>;
  const box =
    layout === 'fullWidth'
      ? { alignSelf: 'stretch' as const, direction: 'ltr' as const, width: '100%' as const }
      : { flexShrink: 0, direction: 'ltr' as const };
  return <View style={box}>{children}</View>;
}

export function ContactCard({ title, description, email, phone }: ContactCardProps) {
  const { t } = useTranslation();
  const { isRtl } = useRtl();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const textDirStyle = useMemo(
    () =>
      isRtl
        ? ({ textAlign: 'right' as const, writingDirection: 'rtl' as const })
        : ({ textAlign: 'left' as const, writingDirection: 'ltr' as const }),
    [isRtl]
  );

  const copy = async (value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert(t('common.successTitle'), t('header.menu.copied'));
    } catch {
      Alert.alert(t('common.errorTitle'));
    }
  };

  const openUrl = async (url: string) => {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error('Cannot open');
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('common.errorTitle'), t('common.errorDesc'));
    }
  };

  const hint = `${t('support.actions.open')} • ${t('header.menu.copy')}`;

  return (
    <View style={styles.card}>
      <RtlPhysicalRightBlock isRtl={isRtl}>
        <Text style={[styles.cardTitle, textDirStyle]}>{title}</Text>
      </RtlPhysicalRightBlock>
      {description ? (
        <RtlPhysicalRightBlock isRtl={isRtl}>
          <Text style={[styles.cardDesc, textDirStyle]}>{description}</Text>
        </RtlPhysicalRightBlock>
      ) : null}

      {email ? (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => openUrl(`mailto:${email}`)}
          onLongPress={() => copy(email)}
          accessibilityRole="button"
          accessibilityLabel={email}
        >
          <Ionicons name="mail-outline" size={iconSizes.sm} color={colors.primary} />
          <View style={styles.valueCell}>
            {isRtl ? (
              <View style={styles.valueLtrBox}>
                <Text style={[styles.value, textDirStyle]}>{email}</Text>
              </View>
            ) : (
              <Text style={[styles.value, textDirStyle]}>{email}</Text>
            )}
          </View>
          <RtlPhysicalRightBlock isRtl={isRtl} layout="shrink">
            <Text style={[styles.copyHint, textDirStyle]}>{hint}</Text>
          </RtlPhysicalRightBlock>
        </Pressable>
      ) : null}

      {phone ? (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => openUrl(`tel:${phone}`)}
          onLongPress={() => copy(phone)}
          accessibilityRole="button"
          accessibilityLabel={phone}
        >
          <Ionicons name="call-outline" size={iconSizes.sm} color={colors.primary} />
          <View style={styles.valueCell}>
            {isRtl ? (
              <View style={styles.valueLtrBox}>
                <Text style={[styles.value, textDirStyle]}>{phone}</Text>
              </View>
            ) : (
              <Text style={[styles.value, textDirStyle]}>{phone}</Text>
            )}
          </View>
          <RtlPhysicalRightBlock isRtl={isRtl} layout="shrink">
            <Text style={[styles.copyHint, textDirStyle]}>{hint}</Text>
          </RtlPhysicalRightBlock>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    button: {
      padding: spacing.xs,
      borderRadius: borderRadius.md,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    backdrop: {
      flex: 1,
    },
    menu: {
      position: 'absolute',
      top: 52,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 220,
      overflow: 'hidden',
      ...shadows.sm,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    itemPressed: {
      backgroundColor: colors.cardBackground,
    },
    itemText: {
      fontSize: typography.base,
      fontWeight: typography.medium,
      color: colors.text,
    },
    card: {
      backgroundColor: colors.cardBackground,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    cardTitle: {
      fontSize: typography.lg,
      fontWeight: typography.semibold,
      color: colors.text,
      alignSelf: 'stretch',
    },
    cardDesc: {
      fontSize: typography.base,
      color: colors.textSecondary,
      lineHeight: typography.base * typography.normal,
      alignSelf: 'stretch',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowPressed: {
      opacity: 0.8,
    },
    valueCell: {
      flex: 1,
      minWidth: 0,
    },
    valueLtrBox: {
      direction: 'ltr',
      alignSelf: 'stretch',
    },
    value: {
      fontSize: typography.base,
      color: colors.text,
    },
    copyHint: {
      fontSize: typography.sm,
      color: colors.textTertiary,
    },
  });

