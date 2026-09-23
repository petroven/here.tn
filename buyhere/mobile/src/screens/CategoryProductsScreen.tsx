import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowUpDown, PackageSearch, SlidersHorizontal } from 'lucide-react-native';
import type { ProductFilters } from '@/api/types';
import { FiltersSheet, SORT_OPTIONS, activeFilterCount } from '@/components/FiltersSheet';
import { ProductGrid } from '@/components/ProductGrid';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { flattenPages, useFavoriteIds, useProducts, withFavorites } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Liste produits d'une catégorie (ou d'une sélection : flash, populaires...)
 * en grille 2 colonnes avec scroll infini, tri rapide et filtres.
 */
export function CategoryProductsScreen({ route }: RootScreenProps<'CategoryProducts'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { slug, title } = route.params;
  const [filters, setFilters] = useState<ProductFilters>({
    sort: 'newest',
    ...route.params.filters,
    category: slug ?? route.params.filters?.category,
  });
  const [showFilters, setShowFilters] = useState(false);

  const products = useProducts(filters);
  const { data: favIds } = useFavoriteIds();
  const items = useMemo(() => withFavorites(flattenPages(products.data), favIds), [products.data, favIds]);
  const total = products.data?.pages[0]?.total ?? 0;
  const filterCount = activeFilterCount(filters, !!slug);

  return (
    <Screen>
      <Header title={title} />

      {/* Tri rapide + accès aux filtres */}
      <View className="flex-row items-center gap-2 border-b border-gray-100 py-2.5 dark:border-gray-800">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 ps-4 pe-2">
          <Chip
            label={t('search.filters') + (filterCount ? ` (${filterCount})` : '')}
            icon={<SlidersHorizontal size={14} color={filterCount ? colors.primary : colors.text} />}
            selected={filterCount > 0}
            onPress={() => setShowFilters(true)}
          />
          {SORT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={t(o.key)}
              icon={filters.sort === o.value ? <ArrowUpDown size={13} color={colors.primary} /> : undefined}
              selected={filters.sort === o.value}
              onPress={() => setFilters((f) => ({ ...f, sort: o.value }))}
            />
          ))}
        </ScrollView>
      </View>

      {products.isError && items.length === 0 ? (
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
              <Text className="mb-2 mt-1 px-4 text-sm text-ink-muted dark:text-gray-400">
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
        hideCategory={!!slug}
        onClose={() => setShowFilters(false)}
        onApply={setFilters}
      />
    </Screen>
  );
}

