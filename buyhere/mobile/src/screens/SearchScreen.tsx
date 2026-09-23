import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { Clock, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { catalogApi } from '@/api/endpoints';
import type { ProductFilters } from '@/api/types';
import { FiltersSheet, activeFilterCount } from '@/components/FiltersSheet';
import { ProductGrid } from '@/components/ProductGrid';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { flattenPages, useFavoriteIds, useProducts, withFavorites } from '@/hooks/queries';
import { useDebounce } from '@/hooks/useDebounce';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import type { TabScreenProps } from '@/navigation/types';

/**
 * Recherche : suggestions pendant la frappe, historique récent,
 * puis résultats en grille avec filtres (prix, catégorie, note) et tri.
 */
export function SearchScreen({ route, navigation }: TabScreenProps<'Search'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const inputRef = useRef<TextInput>(null);
  const { recentSearches, addRecentSearch, clearRecentSearches } = useSettingsStore();

  const [text, setText] = useState(route.params?.initialQuery ?? '');
  const [filters, setFilters] = useState<ProductFilters>({ sort: 'newest', q: route.params?.initialQuery });
  const [showFilters, setShowFilters] = useState(false);
  const [typing, setTyping] = useState(false);
  const debounced = useDebounce(text.trim(), 300);

  // Focus automatique quand on arrive depuis la barre de l'accueil.
  useEffect(() => {
    if (isFocused && route.params?.focus) {
      const id = setTimeout(() => inputRef.current?.focus(), 250);
      navigation.setParams({ focus: false });
      return () => clearTimeout(id);
    }
  }, [isFocused, route.params?.focus, navigation]);

  const suggestions = useQuery({
    queryKey: ['suggestions', debounced],
    queryFn: () => catalogApi.suggestions(debounced),
    enabled: typing && debounced.length >= 2,
  });

  const hasSearch = !!filters.q || activeFilterCount(filters) > 0;
  const products = useProducts(filters, hasSearch);
  const { data: favIds } = useFavoriteIds();
  const items = useMemo(() => withFavorites(flattenPages(products.data), favIds), [products.data, favIds]);
  const total = products.data?.pages[0]?.total ?? 0;
  const filterCount = activeFilterCount(filters);

  const submit = (q: string) => {
    const query = q.trim();
    setText(query);
    setTyping(false);
    inputRef.current?.blur();
    if (query) addRecentSearch(query);
    setFilters((f) => ({ ...f, q: query || undefined }));
  };

  const clear = () => {
    setText('');
    setTyping(false);
    setFilters((f) => ({ ...f, q: undefined }));
  };

  return (
    <Screen>
      {/* Barre de recherche + bouton filtres */}
      <View className="flex-row items-center gap-2 px-4 pb-3 pt-2">
        <View className="h-12 flex-1 flex-row items-center gap-2 rounded-2xl bg-surface-muted px-3.5 dark:bg-surface-dark-muted">
          <Search size={19} color={colors.muted} />
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setTyping(true);
            }}
            onFocus={() => setTyping(true)}
            onSubmitEditing={() => submit(text)}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.subtle}
            returnKeyType="search"
            autoCorrect={false}
            className="h-full flex-1 text-base text-ink dark:text-gray-100"
            accessibilityRole="search"
          />
          {text ? (
            <Pressable onPress={clear} hitSlop={10} accessibilityLabel={t('search.clear')}>
              <X size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setShowFilters(true)}
          className="h-12 w-12 items-center justify-center rounded-2xl bg-primary"
          accessibilityRole="button"
          accessibilityLabel={t('search.filters')}
        >
          <SlidersHorizontal size={20} color="#fff" />
          {filterCount > 0 ? (
            <View className="absolute -end-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-ink dark:bg-white">
              <Text className="text-2xs font-bold text-white dark:text-ink">{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {typing && (debounced.length >= 2 || !hasSearch) ? (
        // Suggestions pendant la frappe, sinon historique
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-4 pb-6">
          {debounced.length >= 2 ? (
            <>
              <Text className="mb-2 mt-1 text-xs font-bold uppercase text-ink-subtle">{t('search.suggestions')}</Text>
              {(suggestions.data ?? []).map((s) => (
                <Pressable
                  key={s.slug}
                  onPress={() => submit(s.name)}
                  className="flex-row items-center gap-3 border-b border-gray-100 py-3.5 dark:border-gray-800"
                >
                  <Search size={16} color={colors.subtle} />
                  <Text className="flex-1 text-ink dark:text-gray-100" numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : recentSearches.length > 0 ? (
            <>
              <View className="mb-2 mt-1 flex-row items-center justify-between">
                <Text className="text-xs font-bold uppercase text-ink-subtle">{t('search.recent')}</Text>
                <Pressable onPress={clearRecentSearches} hitSlop={8}>
                  <Text className="text-sm font-semibold text-primary">{t('search.clear')}</Text>
                </Pressable>
              </View>
              {recentSearches.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => submit(q)}
                  className="flex-row items-center gap-3 border-b border-gray-100 py-3.5 dark:border-gray-800"
                >
                  <Clock size={16} color={colors.subtle} />
                  <Text className="flex-1 text-ink dark:text-gray-100">{q}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
        </ScrollView>
      ) : !hasSearch ? (
        <EmptyState
          icon={<PackageSearch size={40} color={colors.primary} />}
          title={t('search.title')}
          text={t('home.searchPlaceholder')}
        />
      ) : products.isError && items.length === 0 ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <ProductGrid
          products={items}
          loading={products.isLoading}
          fetchingMore={products.isFetchingNextPage}
          refreshing={products.isRefetching && !products.isFetchingNextPage}
          onRefresh={() => products.refetch()}
          onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
          header={
            products.isLoading ? null : (
              <Text className="mb-2 px-4 text-sm text-ink-muted dark:text-gray-400">
                {t('search.results', { count: total })}
              </Text>
            )
          }
          empty={
            <EmptyState
              icon={<PackageSearch size={40} color={colors.primary} />}
              title={t('search.noResults')}
              text={t('search.noResultsText')}
            />
          }
        />
      )}

      <FiltersSheet
        visible={showFilters}
        value={filters}
        onClose={() => setShowFilters(false)}
        onApply={(f) => {
          setTyping(false);
          setFilters(f);
        }}
      />
    </Screen>
  );
}
