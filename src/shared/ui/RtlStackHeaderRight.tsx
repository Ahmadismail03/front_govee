import React, { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../theme/useTheme';
import { typography } from '../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import { ROUTE_HEADER_TITLE_KEYS } from '../../navigation/routeHeaderTitleKeys';

/**
 * RTL stack header: back chevron on the physical right + title immediately to its left.
 *
 * Native stack always passes `title` to the OS bar (duplicate with this row) unless `title` is cleared.
 * Screens should call `setOptions({ title: '' })` when RTL (see useLayoutEffect in each screen).
 */
export function RtlStackHeaderRight() {
  const navigation = useNavigation();
  const route = useRoute();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const opts = (navigation as { getCurrentOptions?: () => { title?: string } }).getCurrentOptions?.();
  const raw = opts?.title;
  const routeName = route.name as keyof RootStackParamList;
  const mapKey = ROUTE_HEADER_TITLE_KEYS[routeName];

  const displayTitle = useMemo(() => {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    // Never show React Navigation's default English route id as the label
    if (trimmed === route.name) {
      return mapKey ? t(mapKey) : '';
    }
    // Native title cleared for RTL — use i18n map
    if (!trimmed) {
      return mapKey ? t(mapKey) : '';
    }
    // Real custom title (e.g. topic name) set by the screen
    return trimmed;
  }, [raw, route.name, mapKey, t]);

  return (
    <View style={styles.cluster} accessibilityRole="toolbar">
      <Pressable
        onPress={() => navigation.goBack()}
        style={styles.hit}
        accessibilityRole="button"
        accessibilityLabel="back"
      >
        <Ionicons name="chevron-forward" size={28} color={colors.headerText} />
      </Pressable>
      {displayTitle ? (
        <Text style={[styles.title, { color: colors.headerText }]} numberOfLines={1}>
          {displayTitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    flexShrink: 1,
    maxWidth: '100%',
    flexWrap: 'nowrap',
    direction: 'rtl',
  } as const,
  hit: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  title: {
    flexShrink: 1,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    textAlign: 'right',
    writingDirection: 'rtl',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
});
