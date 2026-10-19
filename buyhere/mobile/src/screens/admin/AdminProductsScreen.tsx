import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Boxes } from 'lucide-react-native';
import { adminApi, type AdminProduct, type ProductStatus } from '@/api/admin';
import { errorMessage } from '@/api/client';
import { FilterBar, matches, Pill, type Tone } from '@/components/admin/AdminUi';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { useAdminProducts, useRefreshAdmin } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const TONE: Record<ProductStatus, Tone> = { actif: 'green', en_attente: 'amber', inactif: 'gray' };
const STATUSES: ProductStatus[] = ['actif', 'en_attente', 'inactif'];
type Filter = 'all' | 'lowStock' | ProductStatus;

/** Modération du catalogue : mise en ligne, mise en attente, retrait ; alerte de stock faible. */
export function AdminProductsScreen({ navigation }: RootScreenProps<'AdminProducts'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const products = useAdminProducts(filter === 'lowStock');
  const refresh = useRefreshAdmin();
  const threshold = products.data?.lowStockThreshold ?? 5;

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProductStatus }) => adminApi.setProductStatus(id, status),
    onSuccess: () => {
      refresh();
      toast(t('admin.saved'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const items = useMemo(
    () =>
      (products.data?.items ?? [])
        .filter((p) => (filter === 'all' || filter === 'lowStock' ? true : p.status === filter))
        .filter((p) => matches(query, p.name, p.storeName, p.categoryName)),
    [products.data, filter, query],
  );

  const chooseStatus = (p: AdminProduct) =>
    Alert.alert(p.name, t('admin.productStatusTitle'), [
      ...STATUSES.filter((s) => s !== p.status).map((s) => ({
        text: t(`admin.productAction.${s}`),
        style: (s === 'inactif' ? 'destructive' : 'default') as 'destructive' | 'default',
        onPress: () => setStatus.mutate({ id: p.id, status: s }),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);

  return (
    <Screen muted>
      <Header title={t('admin.products')} />
      <FilterBar
        query={query}
        onQuery={setQuery}
        placeholder={t('admin.searchProducts')}
        value={filter}
        onChange={setFilter}
        filters={[
          { key: 'all', label: t('admin.productFilter.all') },
          { key: 'lowStock', label: t('admin.productFilter.lowStock', { threshold }) },
          ...STATUSES.map((s) => ({ key: s, label: t(`seller.productStatus.${s}`) })),
        ]}
      />
      {products.isError && !products.data ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          initialNumToRender={12}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('ProductDetail', { idOrSlug: item.id })}
              onLongPress={() => chooseStatus(item)}
              className="mx-4 mb-2.5 flex-row gap-3 rounded-2xl bg-white p-3 active:opacity-80 dark:bg-surface-dark-card"
              accessibilityRole="button"
            >
              <Image
                source={item.imageUrl ? { uri: item.imageUrl } : undefined}
                style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: colors.border }}
                contentFit="cover"
              />
              <View className="flex-1">
                <Text className="font-semibold text-ink dark:text-gray-100" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-xs text-ink-muted dark:text-gray-400" numberOfLines={1}>
                  {item.storeName ?? '—'} · {formatPrice(item.price, lang)}
                </Text>
                <View className="mt-1.5 flex-row items-center gap-2">
                  <Pill label={t(`seller.productStatus.${item.status}`)} tone={TONE[item.status]} />
                  <Text
                    className={`text-xs font-semibold ${item.stock === 0 ? 'text-danger' : item.stock <= threshold ? 'text-amber-600' : 'text-ink-muted'}`}
                  >
                    {item.stock === 0 ? t('seller.outOfStock') : t('seller.stockCount', { count: item.stock })}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => chooseStatus(item)}
                className="self-center rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700"
                accessibilityRole="button"
                accessibilityLabel={t('admin.productStatusTitle')}
              >
                <Text className="text-xs font-bold text-ink dark:text-gray-100">{t('admin.status')}</Text>
              </Pressable>
            </Pressable>
          )}
          ListEmptyComponent={
            products.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<Boxes size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
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
