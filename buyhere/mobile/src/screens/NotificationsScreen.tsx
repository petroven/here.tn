import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Megaphone, Package, type LucideIcon } from 'lucide-react-native';
import { notificationsApi } from '@/api/endpoints';
import type { AppNotification } from '@/api/types';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { flattenPages, qk, useNotifications } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { timeAgo } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const ICONS: Record<AppNotification['type'], LucideIcon> = { ORDER: Package, PROMO: Megaphone, SYSTEM: Bell };

/** Centre de notifications : suivi de commandes et promotions. */
export function NotificationsScreen({ navigation }: RootScreenProps<'Notifications'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const notifications = useNotifications();
  const items = flattenPages(notifications.data);
  const unread = notifications.data?.pages[0]?.unread ?? 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.notifications });
    qc.invalidateQueries({ queryKey: qk.unread });
  };
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });
  const markOne = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });

  // Le badge de la cloche est remis à jour en quittant l'écran.
  useEffect(() => navigation.addListener('blur', () => qc.invalidateQueries({ queryKey: qk.unread })), [navigation, qc]);

  const open = (n: AppNotification) => {
    if (!n.readAt) markOne.mutate(n.id);
    if (n.data?.orderId) navigation.navigate('OrderDetail', { orderId: n.data.orderId });
  };

  return (
    <Screen muted>
      <Header
        title={t('notifications.title')}
        right={
          unread > 0 ? (
            <Pressable onPress={() => markAll.mutate()} hitSlop={8} className="pe-2" accessibilityLabel={t('notifications.markAllRead')}>
              <Text className="text-xs font-semibold text-primary">{t('notifications.markAllRead')}</Text>
            </Pressable>
          ) : null
        }
      />
      {notifications.isError && items.length === 0 ? (
        <ErrorState error={notifications.error} onRetry={() => notifications.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => {
            const Icon = ICONS[item.type];
            return (
              <Pressable
                onPress={() => open(item)}
                className={`mx-4 mb-2.5 flex-row gap-3 rounded-2xl p-4 ${
                  item.readAt ? 'bg-white dark:bg-surface-dark-card' : 'bg-primary-50 dark:bg-primary-900/20'
                }`}
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-surface-dark-muted">
                  <Icon size={19} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 font-semibold text-ink dark:text-gray-100">{item.title}</Text>
                    {!item.readAt ? <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" /> : null}
                  </View>
                  <Text className="mt-0.5 text-sm leading-5 text-ink-muted dark:text-gray-400">{item.body}</Text>
                  <Text className="mt-1.5 text-xs text-ink-subtle">{timeAgo(item.createdAt, lang)}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            notifications.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<Bell size={40} color={colors.primary} />} title={t('notifications.empty')} text={t('notifications.emptyText')} />
            )
          }
          onEndReached={() => notifications.hasNextPage && !notifications.isFetchingNextPage && notifications.fetchNextPage()}
          ListFooterComponent={notifications.isFetchingNextPage ? <ActivityIndicator color={colors.primary} className="py-4" /> : null}
          refreshControl={
            <RefreshControl
              refreshing={notifications.isRefetching && !notifications.isFetchingNextPage}
              onRefresh={() => notifications.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
