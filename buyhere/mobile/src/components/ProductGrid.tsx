import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View, useWindowDimensions } from 'react-native';
import type { ProductCard as ProductCardType } from '@/api/types';
import { useTheme } from '@/theme/useTheme';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from './ui/Skeleton';

const H_PADDING = 16;
const GAP = 12;

type Props = {
  products: ProductCardType[];
  loading: boolean;
  fetchingMore?: boolean;
  refreshing?: boolean;
  onEndReached?: () => void;
  onRefresh?: () => void;
  header?: ReactElement | null;
  empty?: ReactElement | null;
};

/** Grille 2 colonnes avec scroll infini, pull-to-refresh et squelettes. */
export function ProductGrid({
  products,
  loading,
  fetchingMore,
  refreshing = false,
  onEndReached,
  onRefresh,
  header,
  empty,
}: Props) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const cardWidth = (width - H_PADDING * 2 - GAP) / 2;

  return (
    <FlatList
      data={loading ? [] : products}
      keyExtractor={(p) => p.id}
      numColumns={2}
      columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: H_PADDING }}
      renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
      ListHeaderComponent={header}
      ListEmptyComponent={loading ? <ProductGridSkeleton /> : empty}
      ListFooterComponent={
        fetchingMore ? (
          <View className="py-6">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View className="h-6" />
        )
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
      contentContainerStyle={{ paddingTop: 8, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={7}
    />
  );
}

/** Rangée horizontale de cartes (sections de l'accueil). */
export function ProductRow({ products }: { products: ProductCardType[] }) {
  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <ProductCard product={item} width={150} />}
      ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
      contentContainerStyle={{ paddingHorizontal: H_PADDING }}
      showsHorizontalScrollIndicator={false}
    />
  );
}
