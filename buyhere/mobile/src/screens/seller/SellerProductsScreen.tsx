import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Camera, Minus, Package, Plus, Search } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { sellerApi, type SellerProduct, type StockFilter } from '@/api/vendor';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { useRefreshSeller, useSellerProducts } from '@/hooks/useSeller';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Catalogue de la boutique : recherche, filtres de stock (faible / rupture),
 * ajustement rapide du stock (journalisé côté serveur) et accès à l'édition.
 */
export function SellerProductsScreen({ route, navigation }: RootScreenProps<'SellerProducts'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const [filter, setFilter] = useState<StockFilter>(route.params?.filter ?? 'tous');
  const [query, setQuery] = useState('');
  const products = useSellerProducts(filter);
  const refresh = useRefreshSeller();
  const threshold = products.data?.lowStockThreshold ?? 5;

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data?.items ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products.data, query]);

  const adjust = useMutation({
    mutationFn: ({ product, variation }: { product: SellerProduct; variation: number }) =>
      sellerApi.adjustStock(product.id, { variation }),
    onSuccess: refresh,
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const stockTone = (stock: number) =>
    stock === 0 ? 'text-danger' : stock <= threshold ? 'text-amber-600' : 'text-success';

  return (
    <Screen muted>
      <Header
        title={t('seller.products')}
        right={
          <View className="me-2 flex-row gap-2">
            <Pressable
              onPress={() => navigation.navigate('SellerQuickAdd')}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30"
              accessibilityRole="button"
              accessibilityLabel={t('seller.quick.entry')}
            >
              <Camera size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('SellerProductForm', {})}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary"
              accessibilityRole="button"
              accessibilityLabel={t('seller.addProduct')}
            >
              <Plus size={20} color="#fff" />
            </Pressable>
          </View>
        }
      />
      <View className="gap-2.5 bg-white px-4 py-2.5 dark:bg-surface-dark">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('seller.searchProducts')}
          leftIcon={<Search size={18} color={colors.subtle} />}
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {(['tous', 'faible', 'rupture'] as StockFilter[]).map((f) => (
            <Chip
              key={f}
              label={f === 'faible' ? t('seller.stockFilter.faible', { threshold }) : t(`seller.stockFilter.${f}`)}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      </View>

      {products.isError && !products.data ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => {
            const simple = item.variants.length === 0;
            return (
              <Pressable
                onPress={() => navigation.navigate('SellerProductForm', { productId: item.id })}
                className="mx-4 mb-2.5 flex-row gap-3 rounded-2xl bg-white p-3 active:opacity-80 dark:bg-surface-dark-card"
                accessibilityRole="button"
              >
                <Image
                  source={item.images[0] ? { uri: item.images[0] } : undefined}
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: colors.border }}
                  contentFit="cover"
                />
                <View className="flex-1">
                  <Text className="font-semibold text-ink dark:text-gray-100" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-sm font-bold text-primary">{formatPrice(item.price, lang)}</Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <Text className={`text-xs font-semibold ${stockTone(item.stock)}`}>
                      {item.stock === 0 ? t('seller.outOfStock') : t('seller.stockCount', { count: item.stock })}
                    </Text>
                    {item.status !== 'actif' ? (
                      <Text className="rounded bg-gray-100 px-1.5 py-0.5 text-2xs text-ink-muted dark:bg-surface-dark-muted">
                        {t(`seller.productStatus.${item.status}`)}
                      </Text>
                    ) : null}
                    {!simple ? (
                      <Text className="text-2xs text-ink-subtle">
                        {t('seller.variantsCount', { count: item.variants.length })}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {simple ? (
                  <View className="items-center justify-center gap-1.5">
                    <Pressable
                      onPress={() => adjust.mutate({ product: item, variation: 1 })}
                      disabled={adjust.isPending}
                      className="h-8 w-8 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30"
                      accessibilityRole="button"
                      accessibilityLabel={t('seller.stockPlus', { name: item.name })}
                      hitSlop={4}
                    >
                      <Plus size={16} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => adjust.mutate({ product: item, variation: -1 })}
                      disabled={adjust.isPending || item.stock < 1}
                      className={`h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-surface-dark-muted ${item.stock < 1 ? 'opacity-40' : ''}`}
                      accessibilityRole="button"
                      accessibilityLabel={t('seller.stockMinus', { name: item.name })}
                      hitSlop={4}
                    >
                      <Minus size={16} color={colors.text} />
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            products.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<Package size={40} color={colors.primary} />}
                title={filter === 'tous' ? t('seller.noProducts') : t('seller.noProductsFilter')}
                text={filter === 'tous' ? t('seller.noProductsText') : undefined}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={products.isRefetching}
              onRefresh={() => products.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
