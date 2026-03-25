import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { getDefaultHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
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

export type HeaderMenuDropdownEdge = 'leading' | 'trailing';

type HeaderMenuButtonProps = {
  /**
   * Horizontal anchor for the dropdown (under the hamburger).
   * - `leading`: same edge as `headerLeft` (e.g. main tabs: logo + menu on the left).
   * - `trailing`: same edge as `headerRight` (e.g. AuthStart menu on the right).
   */
  dropdownEdge?: HeaderMenuDropdownEdge;
  /** Stack screen uses `presentation: 'modal'` (taller iOS header) — keeps the menu flush under the bar. */
  modalStackHeader?: boolean;
};

export function HeaderMenuButton({
  dropdownEdge = 'leading',
  modalStackHeader = false,
}: HeaderMenuButtonProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [menuTopPx, setMenuTopPx] = useState<number | null>(null);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const fallbackMenuTop = useMemo(() => {
    const rnEstimate = getDefaultHeaderHeight(frame, modalStackHeader, insets.top);
    if (Platform.OS === 'android') {
      // RN's formula is often 64 + insets.top; real material headers + edge-to-edge
      // end shorter (~56 toolbar), which left a visible gap under the ☰.
      const status = StatusBar.currentHeight ?? 0;
      const toolbar = 56;
      const fromStatus = status > 0 ? status + toolbar : insets.top + toolbar;
      return Math.max(insets.top, Math.min(fromStatus, rnEstimate) - 4);
    }
    return Math.max(insets.top, rnEstimate - 6);
  }, [frame.height, frame.width, insets.top, modalStackHeader]);

  const openMenu = useCallback(() => {
    let attempts = 0;
    const runMeasure = () => {
      anchorRef.current?.measureInWindow((_x, y, _w, h) => {
        attempts += 1;
        const underIcon = y + h;
        const looksValid = h > 0 && underIcon > insets.top + 8 && y >= 0;

        if (!looksValid && attempts < 8) {
          requestAnimationFrame(runMeasure);
          return;
        }

        const top = looksValid ? underIcon : fallbackMenuTop;
        setMenuTopPx(top);
        setOpen(true);
      });
    };

    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (Platform.OS === 'android') {
          requestAnimationFrame(runMeasure);
        } else {
          runMeasure();
        }
      });
    });
  }, [fallbackMenuTop, insets.top]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setMenuTopPx(null);
  }, []);

  const menuTop = menuTopPx ?? fallbackMenuTop;
  const menuHorizontalStyle =
    dropdownEdge === 'trailing' ? { end: spacing.md } : { start: spacing.md };

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
      <View ref={anchorRef} collapsable={false} style={styles.anchor}>
        <Pressable
          onPress={openMenu}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('header.menu.open')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Ionicons name="menu" size={iconSizes.md} color={colors.headerText} />
        </Pressable>
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
        // Android: default modal content sits below the status bar while
        // measureInWindow() uses full-screen coords — `top` was too large (huge gap under ☰).
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityRole="button" />
          <View style={[styles.menu, { top: menuTop }, menuHorizontalStyle]} pointerEvents="box-none">
            {items.map((it) => (
              <Pressable
                key={it.key}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => {
                  closeMenu();
                  it.onPress();
                }}
              >
                <Ionicons name={it.icon as any} size={iconSizes.sm} color={colors.text} />
                <Text style={styles.itemText}>{it.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
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
    anchor: {
      alignSelf: 'center',
    },
    button: {
      padding: spacing.xs,
      borderRadius: borderRadius.md,
    },
    buttonPressed: {
      opacity: 0.7,
    },
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    menu: {
      position: 'absolute',
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

