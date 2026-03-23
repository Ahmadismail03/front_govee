import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';
import { spacing, typography, borderRadius } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';
import { useRtl } from '../../core/i18n/useRtl';
type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  style?: StyleProp<TextStyle>;
} & Omit<TextInputProps, 'value' | 'onChangeText' | 'style'>;

export function TextField({ label, value, onChangeText, style: customStyle, ...rest }: Props) {
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        root: {
          gap: spacing.sm,
        },
        label: {
          fontSize: typography.sm,
          fontWeight: typography.medium,
          color: colors.text,
          textAlign: isRtl ? 'right' : 'left',
          writingDirection: isRtl ? 'rtl' : 'ltr',
        },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          fontSize: typography.base,
          color: colors.text,
          backgroundColor: colors.surface,
          textAlign: isRtl ? 'right' : 'left',
          writingDirection: isRtl ? 'rtl' : 'ltr',
        },
      }),
    [colors, isRtl]
  );

  return (
    <View style={styles.root}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, customStyle]}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label || 'text input'}
        placeholderTextColor={colors.textTertiary}
        {...rest}
      />
    </View>
  );
}
