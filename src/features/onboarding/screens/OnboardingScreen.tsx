import React, { useMemo, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../../../navigation/types';
import { setOnboardingCompleted } from '../storage/onboardingStorage';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { borderRadius, spacing, typography } from '../../../shared/theme/tokens';
import { useRtl } from '../../../core/i18n/useRtl';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

type Slide = {
  key: 'welcome' | 'booking' | 'voice' | 'final';
  title: string;
  description: string;
  image?: any;
};

const { width: screenWidth } = Dimensions.get('window');

export function OnboardingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { isRtl } = useRtl();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
    const visibleIndex = viewableItems[0]?.index;
    if (visibleIndex == null) return;
    setCurrentIndex(visibleIndex);
  });

  const slides = useMemo<Slide[]>(
    () => [
      {
        key: 'welcome',
        title: t('onboarding.welcome.title'),
        description: t('onboarding.welcome.description'),
        image: require('../../../../assets/onboarding/onboarding-welcome.png'),
      },
      {
        key: 'booking',
        title: t('onboarding.booking.title'),
        description: t('onboarding.booking.description'),
        image: require('../../../../assets/onboarding/onboarding-booking.png'),
      },
      {
        key: 'voice',
        title: t('onboarding.voice.title'),
        description: t('onboarding.voice.description'),
        image: require('../../../../assets/onboarding/onboarding-voice.png'),
      },
      {
        key: 'final',
        title: t('onboarding.final.title'),
        description: t('onboarding.final.description'),
      },
    ],
    [t]
  );

  const isLast = currentIndex === slides.length - 1;
  const activeDotIndex = isRtl ? slides.length - 1 - currentIndex : currentIndex;
  const textLift = Math.min(Math.max(Math.round(screenWidth * 0.27), 120), 155);

  const goToMainTabs = async () => {
    await setOnboardingCompleted();
    navigation.replace('MainTabs');
  };

  const goToLogin = async () => {
    await setOnboardingCompleted();
    navigation.navigate('AuthStart', {});
  };

  const onSkip = async () => {
    await goToMainTabs();
  };

  const onNext = () => {
    const nextIndex = Math.min(currentIndex + 1, slides.length - 1);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setCurrentIndex(nextIndex);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, spacing.md),
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
        page: {
          width: screenWidth,
          paddingHorizontal: spacing.lg,
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: spacing.lg,
        },
        cornerDecoration: {
          width: 96,
          height: 96,
          opacity: 1,
          zIndex: 3,
        },
        cornerDecorationAnchor: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          direction: 'ltr',
          alignItems: 'flex-start',
          zIndex: 3,
        },
        imageWrap: {
          width: '100%',
          height: Math.min(Math.max(screenWidth * 1.32, 500), 620),
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: spacing.lg,
        },
        image: {
          width: '100%',
          height: '100%',
          borderRadius: borderRadius.lg,
        },
        textWrap: {
          width: '100%',
          alignItems: 'center',
          gap: spacing.sm,
          position: 'relative',
          top: -textLift,
          marginTop: 0,
          marginBottom: 0,
        },
        textWrapFinal: {
          top: 0,
        },
        title: {
          fontSize: typography.xxxl,
          fontWeight: typography.bold,
          color: colors.primary,
          textAlign: 'center',
        },
        description: {
          maxWidth: 360,
          fontSize: typography.lg,
          color: colors.textSecondary,
          lineHeight: typography.lg * typography.relaxed,
          textAlign: 'center',
        },
        dotsRow: {
          flexDirection: isRtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          marginTop: spacing.md,
          marginBottom: spacing.lg,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: borderRadius.full,
          backgroundColor: colors.border,
        },
        dotActive: {
          width: 22,
          backgroundColor: colors.primary,
        },
        actionsRow: {
          width: '100%',
          flexDirection: isRtl ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingHorizontal: spacing.md,
        },
        textAction: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        },
        textActionLabel: {
          fontSize: typography.base,
          fontWeight: typography.semibold,
          color: colors.textSecondary,
        },
        nextButton: {
          minWidth: 120,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        nextButtonLabel: {
          color: colors.headerText,
          fontSize: typography.base,
          fontWeight: typography.bold,
        },
        finalCard: {
          width: '100%',
          marginTop: spacing.xl,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
        },
        finalPreviewCard: {
          width: '100%',
          maxWidth: 360,
          marginTop: spacing.xl,
          borderRadius: borderRadius.xl,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.lg,
          alignItems: 'center',
          gap: spacing.md,
        },
        finalPreviewIcon: {
          width: 62,
          height: 62,
          borderRadius: borderRadius.full,
          backgroundColor: colors.primaryLight,
          alignItems: 'center',
          justifyContent: 'center',
        },
        finalPreviewTitle: {
          fontSize: typography.lg,
          fontWeight: typography.bold,
          color: colors.text,
          textAlign: 'center',
        },
        finalPreviewPoint: {
          width: '100%',
          fontSize: typography.base,
          color: colors.textSecondary,
          textAlign: isRtl ? 'right' : 'left',
          lineHeight: typography.base * typography.relaxed,
        },
        finalButtonPrimary: {
          borderRadius: borderRadius.full,
          backgroundColor: colors.primary,
          paddingVertical: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
        },
        finalButtonPrimaryLabel: {
          color: colors.headerText,
          fontSize: typography.base,
          fontWeight: typography.bold,
        },
        finalButtonSecondary: {
          borderRadius: borderRadius.full,
          borderWidth: 1,
          borderColor: colors.primary,
          paddingVertical: spacing.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        },
        finalButtonSecondaryLabel: {
          color: colors.primary,
          fontSize: typography.base,
          fontWeight: typography.bold,
        },
      }),
    [colors, insets.bottom, insets.top, isRtl]
  );

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        viewabilityConfig={viewabilityConfig.current}
        onViewableItemsChanged={onViewableItemsChanged.current}
        renderItem={({ item }) => {
          const isFinalSlide = item.key === 'final';
          return (
            <View style={styles.page}>
              {!isFinalSlide ? (
                <View pointerEvents="none" style={styles.cornerDecorationAnchor}>
                  <Image
                    source={require('../../../../assets/onboarding/corner-top-right.png')}
                    style={styles.cornerDecoration}
                    resizeMode="contain"
                  />
                </View>
              ) : null}

              {!isFinalSlide && item.image ? (
                <View style={styles.imageWrap}>
                  <Image source={item.image} style={styles.image} resizeMode="contain" />
                </View>
              ) : null}

              <View style={[styles.textWrap, isFinalSlide && styles.textWrapFinal]}>
                <Text style={styles.title}>{item.title}</Text>
                {!isFinalSlide ? <Text style={styles.description}>{item.description}</Text> : null}
              </View>

              {isFinalSlide ? (
                <>
                  <View style={styles.finalPreviewCard}>
                    <View style={styles.finalPreviewIcon}>
                      <Ionicons name="shield-checkmark-outline" size={30} color={colors.primary} />
                    </View>
                    <Text style={styles.finalPreviewTitle}>{t('onboarding.final.previewTitle')}</Text>
                    <Text style={styles.finalPreviewPoint}>{`\u2022 ${t('onboarding.final.previewPoint1')}`}</Text>
                    <Text style={styles.finalPreviewPoint}>{`\u2022 ${t('onboarding.final.previewPoint2')}`}</Text>
                  </View>

                  <View style={styles.finalCard}>
                    <Pressable onPress={goToMainTabs} style={styles.finalButtonPrimary}>
                      <Text style={styles.finalButtonPrimaryLabel}>{t('onboarding.final.browseWithoutLogin')}</Text>
                    </Pressable>
                    <Pressable onPress={goToLogin} style={styles.finalButtonSecondary}>
                      <Text style={styles.finalButtonSecondaryLabel}>{t('onboarding.final.loginNow')}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          );
        }}
      />

      <View style={styles.dotsRow}>
        {slides.map((slide, idx) => (
          <View key={slide.key} style={[styles.dot, idx === activeDotIndex && styles.dotActive]} />
        ))}
      </View>
      {!isLast ? (
        <View style={styles.actionsRow}>
          <Pressable style={styles.textAction} onPress={onSkip}>
            <Text style={styles.textActionLabel}>{t('onboarding.skip')}</Text>
          </Pressable>
          <Pressable style={styles.nextButton} onPress={onNext}>
            <Text style={styles.nextButtonLabel}>{t('onboarding.next')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
