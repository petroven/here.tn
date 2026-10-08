import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react-native';
import { isAwaitingPayment, needsAction, type SellerOrder } from '@/api/vendor';
import { SellerOrderBadge } from '@/components/seller/SellerOrderBadge';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useRefreshSeller, useSellerDashboard } from '@/hooks/useSeller';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

type Filter = 'todo' | 'shipping' | 'done' | 'all';

const FILTERS: Record<Filter, (o: SellerOrder) => boolean> = {
  todo: needsAction,
  shipping: (o) => ['expediee', 'en_cours_livraison'].includes(o.status),
  done: (o) => ['livree', 'annulee', 'retour', 'litige', 'retournee'].includes(o.status),
  all: () => true,
};

/** Commandes reçues par la boutique, « À traiter » d'abord. */
export function SellerOrdersScreen({ navigation }: RootScreenProps<'SellerOrders'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const [filter, setFilter] = useState<Filter>('todo');
  const dashboard = useSellerDashboard();
  const refresh = useRefreshSeller();

  const orders = useMemo(() => (dashboard.data?.orders ?? []).filter(FILTERS[filter]), [dashboard.data, filter]);
  const count = (f: Filter) => (dashboard.data?.orders ?? []).filter(FILTERS[f]).length;

  return (
    <Screen muted>
      <Header title={t('seller.orders')} />
      <View className="bg-white py-2.5 dark:bg-surface-dark">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <Chip
              key={f}
              label={`${t(`seller.orderFilter.${f}`)} (${count(f)})`}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      </View>

      {dashboard.isError && !dashboard.data ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('SellerOrderDetail', { orderId: item.id })}
              className="mx-4 mb-2.5 rounded-2xl bg-white p-4 active:opacity-80 dark:bg-surface-dark-card"
              accessibilityRole="button"
            >
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-bold text-ink dark:text-gray-100">{item.number}</Text>
                  <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">
                    {item.customer?.name ?? t('seller.guest')} · {formatDateTime(item.createdAt, lang)}
                  </Text>
                </View>
                <SellerOrderBadge status={item.status} />
              </View>
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-sm text-ink-muted dark:text-gray-400">
                  {t('orders.items', { count: item.itemCount })} ·{' '}
                  {t(`seller.payment.${item.paymentMethod}`, { defaultValue: item.paymentMethod })}
                </Text>
                <Text className="font-bold text-ink dark:text-gray-100">{formatPrice(item.total, lang)}</Text>
              </View>
              {item.awaitingCustomerConfirmation && item.status === 'en_attente' ? (
                <Text className="mt-2 text-xs font-semibold text-amber-600">{t('seller.awaitingConfirmation')}</Text>
              ) : null}
              {isAwaitingPayment(item) ? (
                <Text className="mt-2 text-xs font-semibold text-ink-muted">{t('seller.awaitingPayment')}</Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            dashboard.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<ShoppingBag size={40} color={colors.primary} />}
                title={t('seller.noOrders')}
                text={t('seller.noOrdersText')}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={dashboard.isRefetching}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
