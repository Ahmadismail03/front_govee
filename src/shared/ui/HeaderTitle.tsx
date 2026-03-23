import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';
import { useRtl } from '../../core/i18n/useRtl';

export function HeaderTitle({ title }: { title?: string }) {
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const styles = React.useMemo(() => createStyles(colors, isRtl), [colors, isRtl]);
  return (
    <View style={styles.root}>
      <Text style={styles.title} numberOfLines={1}>
        {title ?? ''}
      </Text>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>, isRtl: boolean) =>
  StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: '100%',
      flex: 1,
      paddingHorizontal: spacing.sm,
    },
    title: {
      color: colors.headerText,
      fontSize: typography.base,
      fontWeight: typography.semibold,
      textAlign: isRtl ? 'right' : 'center',
      writingDirection: isRtl ? 'rtl' : 'ltr',
      flexShrink: 1,
    },
  });
