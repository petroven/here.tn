import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Landmark } from 'lucide-react-native';
import { adminApi, type AdminTransfer } from '@/api/admin';
import { errorMessage } from '@/api/client';
import { FilterBar, Pill, type Tone } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { useAdminTransfers, useRefreshAdmin } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const tone = (status: string): Tone => (status === 'valide' ? 'green' : status === 'echec' ? 'red' : 'amber');
type Filter = 'todo' | 'all';
const isTodo = (p: AdminTransfer) => p.status === 'en_attente_validation';

/**
 * Virements bancaires des clients : à rapprocher du relevé de compte. Valider
 * marque la commande payée ; rejeter l'annule et remet le stock.
 */
export function AdminTransfersScreen({ navigation }: RootScreenProps<'AdminTransfers'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const transfers = useAdminTransfers();
  const refresh = useRefreshAdmin();
  const [filter, setFilter] = useState<Filter>('todo');

  const decide = useMutation({
    mutationFn: ({ id, ok }: { id: string; ok: boolean }) =>
      ok ? adminApi.validateTransfer(id) : adminApi.rejectTransfer(id),
    onSuccess: (_d, { ok }) => {
      refresh();
      toast(ok ? t('admin.transferValidated') : t('admin.transferRejected'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const all = transfers.data ?? [];
  const items = filter === 'todo' ? all.filter(isTodo) : all;

  return (
    <Screen muted>
      <Header title={t('admin.transfers')} />
      <FilterBar
        value={filter}
        onChange={setFilter}
        filters={[
          { key: 'todo', label: t('admin.queueFilter.todo'), count: all.filter(isTodo).length },
          { key: 'all', label: t('admin.queueFilter.all') },
        ]}
      />
      {transfers.isError && !transfers.data ? (
        <ErrorState error={transfers.error} onRetry={() => transfers.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          ListHeaderComponent={
            filter === 'todo' && items.length ? (
              <Text className="mx-4 mb-3 text-xs leading-5 text-ink-muted dark:text-gray-400">
                {t('admin.transfersHint')}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View className="mx-4 mb-2.5 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-lg font-extrabold text-ink dark:text-gray-100">
                    {formatPrice(item.amount, lang)}
                  </Text>
                  <Text
                    className="text-sm font-semibold text-primary"
                    onPress={item.orderId ? () => navigation.navigate('AdminOrder', { orderId: item.orderId! }) : undefined}
                  >
                    {item.orderNumber ?? '—'}
                    {item.storeName ? ` · ${item.storeName}` : ''}
                  </Text>
                  <Text className="text-xs text-ink-muted dark:text-gray-400">
                    {item.customer?.name || '—'}
                    {item.customer?.phone ? ` · ${item.customer.phone}` : ''} · {formatDateTime(item.createdAt, lang)}
                  </Text>
                </View>
                <Pill label={t(`admin.transferStatus.${item.status}`, { defaultValue: item.status })} tone={tone(item.status)} />
              </View>
              <Text className="mt-2 text-xs text-ink dark:text-gray-200" selectable>
                {t('admin.transferRef')} : <Text className="font-bold">{item.reference || '—'}</Text>
              </Text>
              {isTodo(item) ? (
                <View className="mt-3 flex-row gap-2">
                  <Button
                    title={t('admin.validateTransfer')}
                    size="sm"
                    className="flex-1"
                    disabled={decide.isPending}
                    loading={decide.isPending && decide.variables?.id === item.id && decide.variables.ok}
                    onPress={() =>
                      confirm(
                        t('admin.validateTransfer'),
                        t('admin.validateTransferText', { amount: formatPrice(item.amount, lang) }),
                        { confirm: t('common.confirm'), cancel: t('common.cancel') },
                        () => decide.mutate({ id: item.id, ok: true }),
                        false,
                      )
                    }
                  />
                  <Button
                    title={t('admin.reject')}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={decide.isPending}
                    onPress={() =>
                      confirm(
                        t('admin.rejectTransfer'),
                        t('admin.rejectTransferText'),
                        { confirm: t('admin.reject'), cancel: t('common.cancel') },
                        () => decide.mutate({ id: item.id, ok: false }),
                      )
                    }
                  />
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            transfers.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<Landmark size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={transfers.isRefetching}
              onRefresh={() => transfers.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
