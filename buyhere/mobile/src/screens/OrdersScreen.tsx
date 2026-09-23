import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react-native';
import type { OrderStatus } from '@/api/types';
import { OrderCard } from '@/components/OrderCard';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { flattenPages, useOrders } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

const FILTERS: (OrderStatus | undefined)[] = [undefined, 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

/** Historique des commandes, filtrable par statut, avec scroll infini. */
export function OrdersScreen({ navigation }: RootScreenProps<'Orders'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const orders = useOrders(status);
  const items = flattenPages(orders.data);

  return (
    <Screen muted>
      <Header title={t('orders.title')} />
      <View className="bg-white py-2.5 dark:bg-surface-dark">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
          {FILTERS.map((s) => (
            <Chip
              key={s ?? 'all'}
              label={s ? t(`orders.status.${s}`) : t('orders.all')}
              selected={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </ScrollView>
      </View>

      {orders.isError && items.length === 0 ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <OrderCard order={item} onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })} />
          )}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          ListEmptyComponent={
            orders.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<Package size={40} color={colors.primary} />}
                title={t('orders.empty')}
                text={t('orders.emptyText')}
                action={{ label: t('cart.startShopping'), onPress: () => navigation.navigate('Main', { screen: 'Home' }) }}
              />
            )
          }
          onEndReached={() => orders.hasNextPage && !orders.isFetchingNextPage && orders.fetchNextPage()}
          ListFooterComponent={orders.isFetchingNextPage ? <ActivityIndicator color={colors.primary} className="py-4" /> : null}
          refreshControl={
            <RefreshControl
              refreshing={orders.isRefetching && !orders.isFetchingNextPage}
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
