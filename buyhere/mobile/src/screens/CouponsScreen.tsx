import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TicketPercent } from 'lucide-react-native';
import { cartApi } from '@/api/endpoints';
import { couponsApi } from '@/api/account';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { qk } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDate, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

/** Codes promo en cours (mêmes que la page « Coupons » du site). */
export function CouponsScreen(_props: RootScreenProps<'Coupons'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const coupons = useQuery({
    queryKey: ['coupons'],
    queryFn: couponsApi.active,
  });

  const use = async (code: string) => {
    await cartApi.rememberCoupon(code);
    qc.invalidateQueries({ queryKey: qk.cart });
    toast(t('coupons.applied', { code }));
  };

  return (
    <Screen muted>
      <Header title={t('coupons.title')} />
      {coupons.isError && !coupons.data ? (
        <ErrorState error={coupons.error} onRetry={() => coupons.refetch()} />
      ) : (
        <FlatList
          data={coupons.data ?? []}
          keyExtractor={(c) => c.code}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => (
            <View className="mx-4 mb-3 flex-row overflow-hidden rounded-2xl bg-white dark:bg-surface-dark-card">
              <View className="w-24 items-center justify-center bg-primary px-2 py-4">
                <Text className="text-2xl font-extrabold text-white">
                  {item.type === 'pourcentage' ? `-${item.value}%` : `-${formatPrice(item.value, lang)}`}
                </Text>
              </View>
              <View className="flex-1 p-3.5">
                <Text className="text-lg font-extrabold tracking-widest text-ink dark:text-gray-100" selectable>
                  {item.code}
                </Text>
                <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">
                  {item.minimum > 0 ? `${t('coupons.minimum', { amount: formatPrice(item.minimum, lang) })} · ` : ''}
                  {t('coupons.until', {
                    date: formatDate(item.expiresAt, lang),
                  })}
                </Text>
                <Button
                  title={t('coupons.use')}
                  variant="secondary"
                  size="sm"
                  className="mt-2.5 self-start"
                  onPress={() => use(item.code)}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            coupons.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<TicketPercent size={40} color={colors.primary} />}
                title={t('coupons.empty')}
                text={t('coupons.emptyText')}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={coupons.isRefetching}
              onRefresh={() => coupons.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
