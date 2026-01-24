import React, { useEffect, useMemo, useRef } from 'react';
import { FlatList, I18nManager, Pressable, StyleSheet, Text, TextInput, View, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { TabsParamList } from '../../../navigation/types';
import { useServicesStore } from '../store/useServicesStore';
import { ServiceCard } from '../components/ServiceCard';
import { LoadingView } from '../../../shared/ui/LoadingView';
import { ErrorView } from '../../../shared/ui/ErrorView';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyView } from '../../../shared/ui/EmptyView';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, borderRadius, iconSizes, shadows } from '../../../shared/theme/tokens';
import { useThemeColors } from '../../../shared/theme/useTheme';
import { getServiceDisplayName } from '../utils/localization';

type Props = BottomTabScreenProps<TabsParamList, 'ServicesTab'>;

export function ServicesListScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  const styles = useMemo(() => createStyles(colors), [colors]);

  const load = useServicesStore((s) => s.load);
  const isLoading = useServicesStore((s) => s.isLoading);
  const error = useServicesStore((s) => s.error);
  const search = useServicesStore((s) => s.search);
  const category = useServicesStore((s) => s.category);
  const page = useServicesStore((s) => s.page);
  const totalPages = useServicesStore((s) => s.totalPages);
  const setSearch = useServicesStore((s) => s.setSearch);
  const setCategory = useServicesStore((s) => s.setCategory);
  const setPage = useServicesStore((s) => s.setPage);

  const [searchDraft, setSearchDraft] = React.useState(search);

  // Subscribe to raw state only; derive lists with useMemo to avoid React 19 getSnapshot issues.
  const rawServices = useServicesStore((s) => s.services);

  const listRef = useRef<FlatList<any>>(null);

  useEffect(() => {
    load();
  }, [load, page, search]);

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  const enabledServices = useMemo(() => {
    return rawServices.filter((s) => s.isEnabled);
  }, [rawServices]);

  const services = useMemo(() => {
    const trimmed = search.trim();
    const bySearch = trimmed
      ? enabledServices.filter((s) =>
          getServiceDisplayName(s, i18n.language).toLowerCase().includes(trimmed.toLowerCase())
        )
      : enabledServices;

    if (category === 'ALL') return bySearch;
    return bySearch.filter((s) => s.category === category);
  }, [enabledServices, search, category, i18n.language]);

  const categories = useMemo(() => {
    const uniq = Array.from(new Set(enabledServices.map((s) => s.category).filter(Boolean))).sort();
    return ['ALL', ...uniq];
  }, [enabledServices]);

  const categoryLabel = (c: string) => {
    if (c === 'ALL') return t('services.categoryAll');
    switch (c) {
      case 'IDENTITY':
        return t('services.categories.identity');
      case 'TRANSPORT':
        return t('services.categories.transport');
      case 'PERMITS':
        return t('services.categories.permits');
      default:
        return c;
    }
  };

  const listHeader = useMemo(
    () => (
      <>
      <View style={[styles.headerSection, { marginTop: -insets.top - spacing.md }]}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=400&fit=crop' }}
          style={[styles.headerBackground, { width: '100%' }]}
          imageStyle={styles.headerImageStyle}
          resizeMode="cover"
        >
          <View style={styles.headerOverlay} />
          <View style={[styles.headerContent, { paddingTop: insets.top + spacing.xl }]}>
            <Text style={styles.headerTitle}>{t('services.title')}</Text>
            <Text style={styles.headerDescription}>{t('services.description')}</Text>
          </View>
        </ImageBackground>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={iconSizes.md} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          value={searchDraft}
          onChangeText={setSearchDraft}
          returnKeyType="search"
          onSubmitEditing={() => setSearch(searchDraft)}
          placeholder={t('services.searchPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={t('services.searchPlaceholder')}
        />
        {searchDraft.length > 0 && (
          <Pressable
            onPress={() => {
              setSearchDraft('');
              setSearch('');
            }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={iconSizes.md} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {categories.length > 1 ? (
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyExtractor={(item) => item}
          renderItem={({ item: c }) => {
            const label = categoryLabel(c);
            const selected = category === c;
            return (
              <Pressable
                key={c}
                onPress={() => setCategory(c)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
              </Pressable>
            );
          }}
        />
      ) : null}
      </>
    ),
    [
      categories,
      category,
      colors.textTertiary,
      insets.top,
      searchDraft,
      setCategory,
      setSearch,
      styles,
      t,
    ]
  );

  if (isLoading) return <LoadingView />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  const visiblePages = getVisiblePages(page, totalPages, 5);
  const showPagination = totalPages > 1;

  return (
    <Screen>
      <FlatList
        ref={listRef}
        data={services}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          showPagination ? (
            <View style={styles.paginationWrap}>
              <Pressable
                onPress={() => {
                  if (page <= 1) return;
                  setPage(page - 1);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                accessibilityRole="button"
                accessibilityLabel="Previous"
                style={[styles.pageNavButton, page <= 1 && styles.pageNavButtonDisabled]}
              >
                <Ionicons
                  name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
                  size={20}
                  color={page <= 1 ? colors.textTertiary : colors.text}
                />
              </Pressable>

              {visiblePages.map((p) => {
                const selected = p === page;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      if (p === page) return;
                      setPage(p);
                      listRef.current?.scrollToOffset({ offset: 0, animated: true });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Page ${p}`}
                    style={[styles.pageButton, selected && styles.pageButtonSelected]}
                  >
                    <Text style={[styles.pageText, selected && styles.pageTextSelected]}>{p}</Text>
                  </Pressable>
                );
              })}

              <Pressable
                onPress={() => {
                  if (page >= totalPages) return;
                  setPage(page + 1);
                  listRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                accessibilityRole="button"
                accessibilityLabel="Next"
                style={[styles.pageNavButton, page >= totalPages && styles.pageNavButtonDisabled]}
              >
                <Ionicons
                  name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={20}
                  color={page >= totalPages ? colors.textTertiary : colors.text}
                />
              </Pressable>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ServiceCard
            service={item}
            onPress={() => navigation.getParent()?.navigate('ServiceDetails' as any, { serviceId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyView 
            icon="grid-outline" 
            title={t('services.emptyTitle')} 
            description={t('services.emptyDesc')} 
          />
        }
      />
    </Screen>
  );
}

function getVisiblePages(current: number, total: number, maxButtons = 5) {
  if (total <= 1) return [1];
  const safeMax = Math.max(1, Math.floor(maxButtons));
  if (total <= safeMax) return Array.from({ length: total }, (_, i) => i + 1);

  const half = Math.floor(safeMax / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + safeMax - 1);
  start = Math.max(1, end - safeMax + 1);

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  headerSection: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
    width: '100%',
    alignSelf: 'center',
  },
  headerBackground: {
    width: '100%',
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  headerImageStyle: {
    opacity: 0.3,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  headerContent: {
    padding: spacing.xl,
    alignItems: 'center',
    zIndex: 1,
  },
  headerTitle: {
    fontSize: typography.xxxl,
    fontWeight: typography.bold,
    color: colors.textInverse,
    marginBottom: spacing.md,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerDescription: {
    fontSize: typography.base,
    color: colors.textInverse,
    lineHeight: typography.base * typography.relaxed,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  chips: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.md,
  },
  chipText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.textInverse,
    fontWeight: typography.bold,
  },
  searchIcon: {
    marginEnd: spacing.sm,
  },
  search: {
    flex: 1,
    fontSize: typography.base,
    color: colors.text,
    paddingVertical: spacing.md,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
  },
  clearButton: {
    padding: spacing.xs,
  },
  list: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  paginationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pageText: {
    fontSize: typography.base,
    color: colors.text,
    fontWeight: typography.semibold,
  },
  pageTextSelected: {
    color: colors.textInverse,
    fontWeight: typography.bold,
  },
  pageNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNavButtonDisabled: {
    opacity: 0.5,
  },
  });
}
