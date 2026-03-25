import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRtl } from '../../../core/i18n/useRtl';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { TabsParamList } from '../../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHomeStore } from '../store/useHomeStore';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { ErrorView } from '../../../shared/ui/ErrorView';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { spacing, typography, borderRadius, shadows } from '../../../shared/theme/tokens';
import { useVoiceStore } from '../../voice/store/useVoiceStore';
import { useServicesStore } from '../../services/store/useServicesStore';
import { getServiceImageSource } from '../../services/utils/serviceImages';
import type { Service } from '../../../core/domain/service';

type Props = BottomTabScreenProps<TabsParamList, 'HomeTab'>;

type Promo = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  bgColor: string;
  titleSpacing: number;   // marginBottom between title and subtitle
  titleLineHeight: number; // lineHeight on the title (controls implicit space below last line)
};

type QuickAction = {
  key: string;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  onPress: () => void;
};

const systemFontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
}) as string;

// ─── Animated Quick Action Card ───────────────────────────────────────────────
function ActionGridCard({
  item,
  colors,
}: {
  item: QuickAction;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 4 }),
      Animated.timing(opacity, { toValue: 0.88, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity, flex: 1 }}>
      <Pressable
        onPress={item.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={[
          gridStyles.card,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
          },
        ]}
      >
        {/* Icon on top-right */}
        <View style={[gridStyles.iconBubble, { backgroundColor: item.bgColor, alignSelf: 'flex-start' }]}>
          <Ionicons name={item.icon as any} size={22} color={item.color} />
        </View>
        {/* Title below icon, right-aligned for Arabic */}
        <Text
          style={[gridStyles.cardTitle, { color: colors.text, textAlign: 'left' }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const gridStyles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 108,
    ...shadows.md,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    width: '100%',
  },
});

// ─── Floating Voice FAB ───────────────────────────────────────────────────────
function VoiceFAB({
  onPress,
  side,
  bottomOffset,
}: {
  onPress: () => void;
  side: 'left' | 'right';
  bottomOffset: number;
}) {
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
        fabStyles.wrapper,
        side === 'right' ? fabStyles.alignLeft : fabStyles.alignRight,
        { bottom: bottomOffset },
      ]}
      pointerEvents="box-none"
    >
      {/* Container so ring and FAB share the same centre point */}
      <View style={fabStyles.fabContainer}>
        <Animated.View
          style={[
            fabStyles.ring,
            { transform: [{ scale: pulse }], opacity: pulseOpacity },
          ]}
        />
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={fabStyles.fab}
          accessibilityRole="button"
          accessibilityLabel="Voice Assistant"
        >
          <Ionicons name="mic-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fabStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
  },
  alignRight: {
    alignItems: 'flex-end',
    paddingRight: 30,
  },
  alignLeft: {
    alignItems: 'flex-start',
    paddingLeft: 30,
  },
  /** Centres the ring behind the FAB button */
  fabContainer: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Pulsing ring — same size as FAB; scale animation enlarges it */
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

// ─── Service Card ─────────────────────────────────────────────────────────────
function ServiceCard({
  service,
  colors,
  onPress,
}: {
  service: Service;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const imageSource = getServiceImageSource(service);

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={service.name}
        style={[
          serviceCardStyles.card,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            borderStartWidth: 4,
            borderStartColor: '#C4161C',
            direction: 'rtl',
          } as any,
        ]}
      >
        {/* Image */}
        <View style={serviceCardStyles.imageWrap}>
          <Image source={imageSource} style={serviceCardStyles.image} resizeMode="cover" />
          <View style={serviceCardStyles.imageScrim} />
        </View>

        {/* Content */}
        <View style={serviceCardStyles.content}>
          {/* Title row: chevron first (anchors to far right in RTL) then name */}
          <View style={serviceCardStyles.titleRow}>
            <Ionicons
              name="chevron-back"
              size={20}
              color={colors.primary}
              style={serviceCardStyles.arrow}
            />
            <Text
              style={[serviceCardStyles.title, { color: colors.text }]}
              numberOfLines={2}
            >
              {service.name}
            </Text>
          </View>

          {/* Footer */}
          <View style={serviceCardStyles.footer}>
            <View style={serviceCardStyles.badge}>
              <Text style={serviceCardStyles.badgeText}>
                {service.category}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const serviceCardStyles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    ...shadows.md,
  },
  imageWrap: {
    width: '100%',
    height: 130,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  content: {
    flexDirection: 'column',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    // RTL: paddingStart = physical right — 0 so title sits flush to the red accent edge
    paddingStart: 0,
    paddingEnd: spacing.md,
    gap: spacing.sm,
  },
  // Full width so the chevron+title cluster anchors to the far right without stray space
  titleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
    fontSize: typography.base,
    fontWeight: typography.semibold,
    textAlign: 'right',
    lineHeight: Math.round(typography.base * 1.5),
    fontFamily: systemFontFamily,
  },
  arrow: {
    marginTop: spacing.xs,
    flexShrink: 0,
  },
  footer: {
    // RTL column: flex-end on cross-axis = physical left — pill sits at far left
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  badge: {
    backgroundColor: '#FFE5E6',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: '#C4161C',
    fontFamily: systemFontFamily,
    lineHeight: Math.round(typography.xs * 1.4),
    textAlign: 'left',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function HomeScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { isRtl } = useRtl();
  const insets = useSafeAreaInsets();
  const activeLanguage = i18n.resolvedLanguage || i18n.language;
  const fabSide: 'left' | 'right' = activeLanguage.startsWith('ar') ? 'right' : 'left';

  const carouselRef = useRef<FlatList<Promo> | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const setVoiceOpen = useVoiceStore((s) => s.setIsOpen);

  const home = useHomeStore((s) => s.home);
  const isLoading = useHomeStore((s) => s.isLoading);
  const error = useHomeStore((s) => s.error);
  const loadHome = useHomeStore((s) => s.load);

  // Read raw slices — never pass a selector that returns a new array (causes infinite loop)
  const rawServices = useServicesStore((s) => s.services);
  const servicesSearch = useServicesStore((s) => s.search);
  const servicesCategory = useServicesStore((s) => s.category);
  const loadServices = useServicesStore((s) => s.load);
  const servicesLoading = useServicesStore((s) => s.isLoading);

  // Stable derived list — recalculated only when inputs actually change
  const allServices = useMemo(() => {
    const enabled = rawServices.filter((s) => s.isEnabled);
    const bySearch = servicesSearch.trim()
      ? enabled.filter((s) => s.name.toLowerCase().includes(servicesSearch.trim().toLowerCase()))
      : enabled;
    if (servicesCategory === 'ALL') return bySearch;
    return bySearch.filter((s) => s.category === servicesCategory);
  }, [rawServices, servicesSearch, servicesCategory]);

  // Fixed list of featured service IDs — rendered in this order, missing IDs are skipped
  const FEATURED_SERVICE_IDS = [
    'CHANGE_MARITAL_STATUS_DIVORCE_CITIZENS',
    'ISSUE_ID_FIRST_TIME',
    'ISSUE_NEW_DRIVING_LICENSE',
    'ISSUE_PASSPORT_FIRST_TIME_OVER_18',
  ];

  const featuredServices = useMemo<Service[]>(() => {
    if (!allServices.length) return [];
    return FEATURED_SERVICE_IDS
      .map((id) => allServices.find((s) => s.id === id))
      .filter((s): s is Service => Boolean(s));
  }, [allServices]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    navigation.setOptions({ title: t('home.title') });
  }, [navigation, t]);

  useEffect(() => {
    if (!home) loadHome();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!allServices.length && !servicesLoading) loadServices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigateTo = (screen: string, params?: any) => {
    const parent = typeof navigation?.getParent === 'function' ? navigation.getParent() : null;
    if (parent?.navigate) return parent.navigate(screen as any, params as any);
    return (navigation as any).navigate(screen, params);
  };

  // ── Carousel data ──────────────────────────────────────────────────────────
  const promos = useMemo<Promo[]>(
    () => [
      {
        key: 'assistant',
        title: 'المساعد الصوتي الذكي',
        subtitle: 'اسأل بصوتك عن أي خدمة حكومية، واحصل على الإرشادات أو احجز موعدك بسهولة.',
        icon: 'mic',
        bgColor: '#C4161C',
        titleSpacing: spacing.md,
        titleLineHeight: typography.xl * 1.25,
      },
      {
        key: 'notifications',
        title: 'تذكير بالمواعيد',
        subtitle: 'استلم إشعارات فورية لتأكيد المواعيد والتذكير قبل موعدك.',
        icon: 'notifications',
        bgColor: '#0B7A33',
        titleSpacing: spacing.md,
        titleLineHeight: typography.xl * 1.25,
      },
      {
        key: 'services',
        title: t('home.carousel.servicesTitle'),
        subtitle: t('home.carousel.servicesSubtitle'),
        icon: 'calendar-clear-outline',
        bgColor: '#C4161C',
        titleSpacing: spacing.md,
        titleLineHeight: typography.xl * 1.25,
      },
    ],
    [t]
  );

  // ── Quick actions ──────────────────────────────────────────────────────────
  const actions = useMemo<QuickAction[]>(
    () => [
      {
        key: 'services',
        title: t('home.actions.browseServices'),
        icon: 'grid-outline',
        color: '#0B7A33',
        bgColor: '#E6F5EC',
        onPress: () => navigation.navigate('ServicesTab'),
      },
      {
        key: 'appointments',
        title: t('home.actions.myAppointments'),
        icon: 'time-outline',
        color: '#1565C0',
        bgColor: '#E3F2FD',
        onPress: () => navigation.navigate('AppointmentsTab'),
      },
      {
        key: 'voice',
        title: t('home.actions.voiceAssistant'),
        icon: 'mic',
        color: '#ffffffff',
        bgColor: '#d20c0cff',
        onPress: () => setVoiceOpen(true),
      },
      {
        key: 'support',
        title: t('home.actions.support'),
        icon: 'call-outline',
        color: '#00796B',
        bgColor: '#E0F2F1',
        onPress: () => navigateTo('ContactUs'),
      },
    ],
    [t, navigation, setVoiceOpen] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Auto-rotate carousel ───────────────────────────────────────────────────
  useEffect(() => {
    if (promos.length <= 1) return;
    const id = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = (prev + 1) % promos.length;
        try {
          carouselRef.current?.scrollToIndex({ index: next, animated: true });
        } catch {
          // ignore
        }
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [promos.length]);

  const carouselWidth = Math.max(0, width - spacing.lg * 2);
  const promoHeight = 200;

  // Pair actions into 2-column rows
  const actionRows = useMemo(() => {
    const rows: QuickAction[][] = [];
    for (let i = 0; i < actions.length; i += 2) rows.push(actions.slice(i, i + 2));
    return rows;
  }, [actions]);

  if (isLoading && !home) return <LoadingView />;
  if (error && !home) return <ErrorView message={error} onRetry={loadHome} />;

  // On iOS the native tab/stack containers block direction:rtl from the root View.
  // Apply it here so the home screen and all its children are RTL on iOS.
  const iosDir = Platform.OS === 'ios' ? ({ direction: isRtl ? 'rtl' : 'ltr' } as const) : undefined;

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, iosDir]}>
      <FlatList
        data={[]}
        renderItem={() => null}
        style={{ flex: 1, backgroundColor: colors.background }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + 88, // keep content clear of tab bar + mic button
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <>
              {/* ── Hero Carousel ────────────────────────────── */}
              <View
                style={{
                  borderRadius: 24,
                  overflow: 'hidden',
                  marginBottom: spacing.xl,
                  height: promoHeight,
                  width: carouselWidth,
                  alignSelf: 'center',
                  ...shadows.lg,
                }}
              >
                <FlatList
                  ref={(r) => { carouselRef.current = r; }}
                  data={promos}
                  horizontal
                  style={{ direction: 'ltr' }}
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(i) => i.key}
                  getItemLayout={(_, index) => ({
                    length: carouselWidth,
                    offset: carouselWidth * index,
                    index,
                  })}
                  onScrollToIndexFailed={(info) => {
                    carouselRef.current?.scrollToOffset({
                      offset: info.averageItemLength * info.index,
                      animated: true,
                    });
                  }}
                  onMomentumScrollEnd={(ev) => {
                    const x = ev.nativeEvent.contentOffset.x;
                    const idx = carouselWidth > 0 ? Math.round(x / carouselWidth) : 0;
                    setCarouselIndex(Math.max(0, Math.min(idx, promos.length - 1)));
                  }}
                  nestedScrollEnabled
                  renderItem={({ item }) => (
                    <View style={{
                      width: carouselWidth,
                      height: promoHeight,
                      backgroundColor: item.bgColor,
                    }}>

                      {/* Layer 1: Brand red wash — warm depth across all slides */}
                      <View style={[
                        StyleSheet.absoluteFillObject,
                        { backgroundColor: 'rgba(196,22,28,0.15)' },
                      ]} />

                      {/* Layer 2: Bottom vignette — grounds the card */}
                      <View style={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        height: 64,
                        backgroundColor: 'rgba(0,0,0,0.12)',
                      }} />

                      {/* ── Content ── */}

                      <View
                        style={{
                          flex: 1,
                          paddingVertical: spacing.lg,
                          paddingHorizontal: spacing.lg + 4,
                          paddingTop: spacing.lg + 10,
                          flexDirection: isRtl ? 'row-reverse' : 'row',
                          alignItems: 'flex-start',
                          gap: spacing.md,
                        }}
                      >

                        {/* Icon column */}
                        <View style={{
                          width: 64,
                          height: 64,
                          borderRadius: 20,
                          backgroundColor: 'rgba(255,255,255,0.18)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 2,
                          flexShrink: 0,
                        }}>
                          <Ionicons name={item.icon as any} size={32} color="#FFFFFF" />
                        </View>

                        {/* Text column */}
                        <View style={{ flex: 1, alignItems: isRtl ? 'flex-end' : 'flex-start' }}>
                          {/* Title */}
                          <Text
                            style={{
                              color: '#FFFFFF',
                              fontSize: typography.xl,
                              fontWeight: typography.bold,
                              letterSpacing: -0.5,
                              lineHeight: item.titleLineHeight,
                              marginBottom: item.titleSpacing,
                              textAlign: isRtl ? 'right' : 'left',
                            }}
                          >
                            {item.title}
                          </Text>
                          {/* Subtitle */}
                          <Text
                            style={{
                              color: 'rgba(255,255,255,0.88)',
                              fontSize: typography.sm,
                              lineHeight: typography.sm * 1.6,
                              flexShrink: 1,
                              textAlign: isRtl ? 'right' : 'left',
                            }}
                          >
                            {item.subtitle}
                          </Text>
                        </View>
                      </View>

                      {/* ── Pill dots row at bottom ── */}
                      <View style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 5,
                        paddingBottom: spacing.md,
                      }}>
                        {promos.map((p, idx) => (
                          <View
                            key={p.key}
                            style={{
                              height: 5,
                              width: idx === carouselIndex ? 24 : 5,
                              borderRadius: 3,
                              backgroundColor:
                                idx === carouselIndex
                                  ? '#FFFFFF'
                                  : 'rgba(255,255,255,0.38)',
                            }}
                          />
                        ))}
                      </View>

                    </View>
                  )}
                />
              </View>

              {/* ── Quick Actions Grid ──────────────────────── */}
              <View style={{ marginBottom: spacing.lg }}>
                {/* Section header */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: spacing.md,
                    gap: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 4,
                      height: 22,
                      borderRadius: 2,
                      backgroundColor: '#C4161C',
                      flexShrink: 0,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.bold,
                      color: colors.text,
                    }}
                  >
                    {t('home.quickActions')}
                  </Text>
                </View>

                {/* 2-column rows */}
                <View style={{ gap: spacing.md }}>
                  {actionRows.map((row, ri) => (
                    <View
                      key={ri}
                      style={{
                        flexDirection: isRtl ? 'row-reverse' : 'row',
                        gap: spacing.md,
                      }}
                    >
                      {row.map((item) => (
                        <ActionGridCard
                          key={item.key}
                          item={item}
                          colors={colors}
                        />
                      ))}
                      {/* Fill empty slot in last row if odd count */}
                      {row.length === 1 && <View style={{ flex: 1 }} />}
                    </View>
                  ))}
                </View>
              </View>

              {/* ── Section Divider ─────────────────────────── */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginVertical: spacing.xl,
                }}
              >
                {/* Title + red marker — flex: 1 so it never collides with the button */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    flex: 1,
                    marginEnd: spacing.sm,
                  }}
                >
                  <View
                    style={{
                      width: 4,
                      height: 22,
                      borderRadius: 2,
                      backgroundColor: '#C4161C',
                      flexShrink: 0,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: typography.base,
                      fontWeight: typography.bold,
                      color: colors.text,
                      flexShrink: 1,
                    }}
                    numberOfLines={1}
                  >
                    {t('home.featuredServices') ?? 'الخدمات الشائعة'}
                  </Text>
                </View>

                {/* View All button — flexShrink: 0 keeps it from being squeezed */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('ServicesTab')}
                  accessibilityRole="button"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    borderWidth: 1.5,
                    borderColor: '#9e9d9dff',
                    borderRadius: borderRadius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.xs,
                      fontWeight: typography.semibold,
                      color: '#C4161C',
                    }}
                  >
                    {t('home.viewAll') ?? 'عرض الكل'}
                  </Text>
                  <Ionicons
                    name={isRtl ? 'chevron-back' : 'chevron-forward'}
                    size={12}
                    color="#C4161C"
                  />
                </TouchableOpacity>
              </View>

              {/* ── Featured Service Cards ──────────────────── */}
              {featuredServices.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  {featuredServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      colors={colors}
                      onPress={() =>
                        navigateTo('ServiceDetails', { serviceId: service.id, expandFees: true })
                      }
                    />
                  ))}
                </View>
              ) : null}
          </>
        }
      />
      <VoiceFAB
        key={`home-fab-${fabSide}`}
        onPress={() => setVoiceOpen(true)}
        side={fabSide}
        bottomOffset={Math.max(insets.bottom - 30)}
      />
    </View>
  );
}