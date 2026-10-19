import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { MessageSquareWarning } from 'lucide-react-native';
import { adminApi, type AdminReview } from '@/api/admin';
import { errorMessage } from '@/api/client';
import { FilterBar, Pill } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Stars } from '@/components/ui/Rating';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { useAdminReviews, useRefreshAdmin } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDate } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

type Filter = 'hidden' | 'low' | 'all';
const FILTERS: Record<Filter, (r: AdminReview) => boolean> = {
  hidden: (r) => !r.visible,
  low: (r) => r.rating <= 2,
  all: () => true,
};

/** Modération des avis : publier ou masquer. */
export function AdminReviewsScreen(_props: RootScreenProps<'AdminReviews'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const reviews = useAdminReviews();
  const refresh = useRefreshAdmin();
  const [filter, setFilter] = useState<Filter>('all');

  const toggle = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) => adminApi.setReviewVisible(id, visible),
    onSuccess: (_d, { visible }) => {
      refresh();
      toast(visible ? t('admin.reviewShown') : t('admin.reviewHidden'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const all = reviews.data ?? [];
  const items = all.filter(FILTERS[filter]);

  return (
    <Screen muted>
      <Header title={t('admin.reviews')} />
      <FilterBar
        value={filter}
        onChange={setFilter}
        filters={(Object.keys(FILTERS) as Filter[]).map((k) => ({
          key: k,
          label: t(`admin.reviewFilter.${k}`),
          count: all.filter(FILTERS[k]).length,
        }))}
      />
      {reviews.isError && !reviews.data ? (
        <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => (
            <View className="mx-4 mb-2.5 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-bold text-ink dark:text-gray-100" numberOfLines={1}>
                    {item.productName ?? '—'}
                  </Text>
                  <Text className="text-xs text-ink-muted dark:text-gray-400">
                    {item.author} · {formatDate(item.createdAt, lang)}
                    {item.verified ? ` · ${t('admin.verifiedPurchase')}` : ''}
                  </Text>
                </View>
                <Pill label={item.visible ? t('admin.visible') : t('admin.hidden')} tone={item.visible ? 'green' : 'gray'} />
              </View>
              <View className="mt-2">
                <Stars value={item.rating} size={14} />
              </View>
              {item.comment ? <Text className="mt-2 text-sm text-ink dark:text-gray-200">{item.comment}</Text> : null}
              <Button
                title={item.visible ? t('admin.hideReview') : t('admin.showReview')}
                size="sm"
                variant={item.visible ? 'outline' : 'primary'}
                className="mt-3"
                loading={toggle.isPending && toggle.variables?.id === item.id}
                disabled={toggle.isPending}
                onPress={() => toggle.mutate({ id: item.id, visible: !item.visible })}
              />
            </View>
          )}
          ListEmptyComponent={
            reviews.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<MessageSquareWarning size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={reviews.isRefetching}
              onRefresh={() => reviews.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
