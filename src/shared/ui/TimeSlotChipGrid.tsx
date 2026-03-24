import React, { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRtl } from '../../core/i18n/useRtl';
import { formatTimeLabel } from '../utils/format';
import { borderRadius, spacing, shadows, typography } from '../theme/tokens';
import { useThemeColors } from '../theme/useTheme';

const COLUMNS = 3;

export type TimeSlotChipItem = { id: string; startTime: string };

type Props = {
  slots: TimeSlotChipItem[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
};

/** Matches Screen horizontal inset so chip width is correct before onLayout. */
const SCREEN_HORIZONTAL_INSET = spacing.lg * 2;

export function TimeSlotChipGrid({ slots, selectedSlotId, onSelect }: Props) {
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const { width: screenWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    setMeasuredWidth(e.nativeEvent.layout.width);
  }, []);

  const gap = spacing.sm;
  const gridWidth = measuredWidth > 0 ? measuredWidth : Math.max(0, screenWidth - SCREEN_HORIZONTAL_INSET);
  const chipWidth = gridWidth > 0 ? (gridWidth - gap * (COLUMNS - 1)) / COLUMNS : 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        measureWrap: {
          width: '100%',
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          gap,
          width: '100%',
        },
        chip: {
          borderRadius: borderRadius.full,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.xs,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 44,
        },
        chipIdle: {
          backgroundColor: colors.surface,
          ...shadows.sm,
        },
        chipSelected: {
          backgroundColor: colors.primary,
          ...shadows.sm,
        },
        chipText: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          textAlign: 'center',
        },
        textIdle: {
          color: colors.text,
        },
        textSelected: {
          color: colors.textInverse,
        },
      }),
    [colors, gap]
  );

  const dirStyle = isRtl ? ({ direction: 'rtl' } as const) : ({ direction: 'ltr' } as const);

  return (
    <View style={styles.measureWrap} onLayout={onGridLayout}>
      <View style={[styles.grid, dirStyle]}>
        {chipWidth > 0 &&
          slots.map((slot) => {
            const selected = slot.id === selectedSlotId;
            return (
              <Pressable
                key={slot.id}
                onPress={() => onSelect(slot.id)}
                style={({ pressed }) => [
                  styles.chip,
                  styles.chipIdle,
                  selected && styles.chipSelected,
                  { width: chipWidth },
                  pressed && !selected && { opacity: 0.88 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={formatTimeLabel(slot.startTime)}
              >
                <Text style={[styles.chipText, selected ? styles.textSelected : styles.textIdle]}>
                  {formatTimeLabel(slot.startTime)}
                </Text>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}
