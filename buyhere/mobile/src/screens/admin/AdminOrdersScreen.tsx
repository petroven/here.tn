import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react-native';
import type { AdminOrder } from '@/api/admin';
import { FilterBar, matches } from '@/components/admin/AdminUi';
import { SellerOrderBadge } from '@/components/seller/SellerOrderBadge';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAdminOrders } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

type Filter = 'open' | 'shipping' | 'issues' | 'done' | 'all';

const FILTERS: Record<Filter, (o: AdminOrder) => boolean> = {
  open: (o) => ['en_attente', 'payee', 'preparation'].includes(o.status),
  shipping: (o) => ['expediee', 'en_cours_livraison'].includes(o.status),
  issues: (o) => ['retour', 'litige'].includes(o.status),
  done: (o) => ['livree', 'annulee', 'retournee'].includes(o.status),
  all: () => true,
};

/** Toutes les commandes de la marketplace, avec recherche (numéro, client, boutique). */
export function AdminOrdersScreen({ navigation }: RootScreenProps<'AdminOrders'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const orders = useAdminOrders();
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');

  const all = orders.data ?? [];
  const items = useMemo(
    () =>
      (orders.data ?? [])
        .filter(FILTERS[filter])
        .filter((o) => matches(query, o.number, o.customer.name, o.customer.email, o.customer.phone, o.storeName)),
    [orders.data, filter, query],
  );

  return (
    <Screen muted>
      <Header title={t('admin.orders')} />
      <FilterBar
        query={query}
        onQuery={setQuery}
        placeholder={t('admin.searchOrders')}
        value={filter}
        onChange={setFilter}
        filters={(Object.keys(FILTERS) as Filter[]).map((k) => ({
          key: k,
          label: t(`admin.orderFilter.${k}`),
          count: all.filter(FILTERS[k]).length,
        }))}
      />
      {orders.isError && !orders.data ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          initialNumToRender={15}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('AdminOrder', { orderId: item.id })}
              className="mx-4 mb-2.5 rounded-2xl bg-white p-4 active:opacity-80 dark:bg-surface-dark-card"
              accessibilityRole="button"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-bold text-ink dark:text-gray-100">{item.number}</Text>
                  <Text className="text-xs text-ink-muted dark:text-gray-400" numberOfLines={1}>
                    {item.customer.name}
                    {item.customer.guest ? ` (${t('admin.guest')})` : ''} · {item.storeName ?? '—'}
                  </Text>
                </View>
                <SellerOrderBadge status={item.status} />
              </View>
              <View className="mt-2 flex-row items-center justify-between">
                <Text className="text-xs text-ink-muted dark:text-gray-400">{formatDateTime(item.createdAt, lang)}</Text>
                <Text className="font-bold text-ink dark:text-gray-100">{formatPrice(item.total, lang)}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            orders.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<ShoppingBag size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={orders.isRefetching}
              onRefresh={() => orders.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
