import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { shadows } from '../../../shared/theme/tokens';
import { useVoiceStore } from '../store/useVoiceStore';

type VoiceFABProps = {
  onPress: () => void;
  side: 'left' | 'right';
  bottomOffset: number;
};

function VoiceFAB({ onPress, side, bottomOffset }: VoiceFABProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.6, duration: 950, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 950, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.55, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseOpacity]);

  return (
    <View
      style={[
        styles.wrapper,
        side === 'right' ? styles.alignLeft : styles.alignRight,
        { bottom: bottomOffset },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.fabContainer}>
        <Animated.View
          style={[
            styles.ring,
            { transform: [{ scale: pulse }], opacity: pulseOpacity },
          ]}
        />
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={styles.fab}
          accessibilityRole="button"
          accessibilityLabel="Voice Assistant"
        >
          <Ionicons name="mic-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function FloatingVoiceButton() {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const setVoiceOpen = useVoiceStore((state) => state.setIsOpen);
  const activeLanguage = i18n.resolvedLanguage || i18n.language;
  const fabSide: 'left' | 'right' = activeLanguage.startsWith('ar') ? 'right' : 'left';
  const bottomOffset = 56 + insets.bottom + Math.max(insets.bottom - 30);

  return (
    <VoiceFAB
      key={`global-fab-${fabSide}`}
      onPress={() => setVoiceOpen(true)}
      side={fabSide}
      bottomOffset={bottomOffset}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 20,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  fabContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C4161C',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C4161C',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
});