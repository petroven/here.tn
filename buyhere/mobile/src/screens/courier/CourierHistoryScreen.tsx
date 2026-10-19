import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { History, PackageCheck, Star, XCircle } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useCourierHistory, useCourierStats } from '@/hooks/useCourier';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

/** Courses terminées (livrées ou en échec), gains cumulés et note moyenne. */
export function CourierHistoryScreen(_props: RootScreenProps<'CourierHistory'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const history = useCourierHistory();
  const stats = useCourierStats();

  return (
    <Screen muted>
      <Header title={t('courier.history')} />
      {history.isError && !history.data ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <FlatList
          data={history.data?.courses ?? []}
          keyExtractor={(c) => c.id}
          contentContainerClassName="p-4 pb-10 flex-grow"
          ListHeaderComponent={
            <View className="mb-4 gap-2.5">
              <View className="rounded-3xl bg-ink p-5">
                <Text className="text-sm text-white/70">{t('courier.totalEarnings')}</Text>
                <Text className="mt-1 text-3xl font-extrabold text-white">
                  {formatPrice(history.data?.earnings ?? 0, lang)}
                </Text>
                <Text className="mt-1 text-xs text-white/60">{t('courier.earningsNote')}</Text>
              </View>
              <View className="flex-row gap-2.5">
                <View className="flex-1 rounded-2xl bg-white p-3.5 dark:bg-surface-dark-card">
                  <Text className="text-xs text-ink-muted dark:text-gray-400">{t('courier.deliveries')}</Text>
                  <Text className="mt-1 text-lg font-extrabold text-ink dark:text-gray-100">
                    {stats.data?.deliveries ?? 0}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-white p-3.5 dark:bg-surface-dark-card">
                  <Text className="text-xs text-ink-muted dark:text-gray-400">{t('courier.rating')}</Text>
                  <View className="mt-1 flex-row items-center gap-1">
                    <Star size={16} color={colors.star} fill={colors.star} />
                    <Text className="text-lg font-extrabold text-ink dark:text-gray-100">
                      {(stats.data?.rating ?? 0).toFixed(1)} / 5
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const ok = item.status === 'livree';
            return (
              <View className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
                {ok ? <PackageCheck size={22} color={colors.success} /> : <XCircle size={22} color={colors.danger} />}
                <View className="flex-1">
                  <Text className="font-bold text-ink dark:text-gray-100">{item.orderNumber}</Text>
                  <Text className="text-xs text-ink-muted dark:text-gray-400" numberOfLines={1}>
                    {formatDateTime(item.deliveredAt ?? item.updatedAt, lang)}
                    {item.dropoff.address ? ` · ${item.dropoff.address}` : ''}
                  </Text>
                </View>
                <Text className={`text-sm font-bold ${ok ? 'text-success' : 'text-danger'}`}>
                  {ok ? `+${formatPrice(item.fee, lang)}` : t('courier.status.echec')}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            history.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<History size={40} color={colors.primary} />}
                title={t('courier.noHistory')}
                text={t('courier.noHistoryText')}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={history.isRefetching}
              onRefresh={() => {
                history.refetch();
                stats.refetch();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
