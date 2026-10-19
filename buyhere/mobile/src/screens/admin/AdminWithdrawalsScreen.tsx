import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Banknote } from 'lucide-react-native';
import { adminApi, type AdminWithdrawal, type WithdrawalStatus } from '@/api/admin';
import { errorMessage } from '@/api/client';
import { FilterBar, Pill, type Tone } from '@/components/admin/AdminUi';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { PromptModal } from '@/components/ui/PromptModal';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { useAdminWithdrawals, useRefreshAdmin } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const TONE: Record<WithdrawalStatus, Tone> = { demande: 'amber', approuve: 'blue', verse: 'green', rejete: 'red' };
type Filter = 'todo' | 'done' | 'all';

/** Demandes de retrait des vendeurs : accepter, marquer versé (virement fait) ou refuser. */
export function AdminWithdrawalsScreen(_props: RootScreenProps<'AdminWithdrawals'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const withdrawals = useAdminWithdrawals();
  const refresh = useRefreshAdmin();
  const [filter, setFilter] = useState<Filter>('todo');
  const [rejecting, setRejecting] = useState<AdminWithdrawal | null>(null);

  const decide = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'approuve' | 'verse' | 'rejete'; reason?: string }) =>
      adminApi.decideWithdrawal(id, status, reason),
    onSuccess: () => {
      setRejecting(null);
      refresh();
      toast(t('admin.saved'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const isTodo = (w: AdminWithdrawal) => w.status === 'demande' || w.status === 'approuve';
  const all = withdrawals.data ?? [];
  const items = all.filter((w) => (filter === 'all' ? true : filter === 'todo' ? isTodo(w) : !isTodo(w)));

  return (
    <Screen muted>
      <Header title={t('admin.withdrawals')} />
      <FilterBar
        value={filter}
        onChange={setFilter}
        filters={(['todo', 'done', 'all'] as Filter[]).map((k) => ({
          key: k,
          label: t(`admin.queueFilter.${k}`),
          count: k === 'todo' ? all.filter(isTodo).length : undefined,
        }))}
      />
      {withdrawals.isError && !withdrawals.data ? (
        <ErrorState error={withdrawals.error} onRetry={() => withdrawals.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(w) => w.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => {
            const pending = decide.isPending && decide.variables?.id === item.id;
            return (
              <View className="mx-4 mb-2.5 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-lg font-extrabold text-ink dark:text-gray-100">
                      {formatPrice(item.amount, lang)}
                    </Text>
                    <Text className="text-sm font-semibold text-ink dark:text-gray-200">{item.storeName}</Text>
                    <Text className="text-xs text-ink-muted dark:text-gray-400">
                      {formatDateTime(item.createdAt, lang)}
                      {item.vendorEmail ? ` · ${item.vendorEmail}` : ''}
                    </Text>
                  </View>
                  <Pill label={t(`seller.withdrawStatus.${item.status}`)} tone={TONE[item.status]} />
                </View>
                <Text className="mt-2 text-xs text-ink-muted dark:text-gray-400" selectable>
                  IBAN : {item.iban || '—'}
                </Text>
                {item.rejectionReason ? (
                  <Text className="mt-1 text-xs text-danger">{item.rejectionReason}</Text>
                ) : null}
                {item.status === 'demande' ? (
                  <View className="mt-3 flex-row gap-2">
                    <Button
                      title={t('admin.approve')}
                      size="sm"
                      className="flex-1"
                      loading={pending && decide.variables?.status === 'approuve'}
                      disabled={decide.isPending}
                      onPress={() => decide.mutate({ id: item.id, status: 'approuve' })}
                    />
                    <Button
                      title={t('admin.reject')}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={decide.isPending}
                      onPress={() => setRejecting(item)}
                    />
                  </View>
                ) : null}
                {item.status === 'approuve' ? (
                  <View className="mt-3 flex-row gap-2">
                    <Button
                      title={t('admin.markPaid')}
                      size="sm"
                      className="flex-1"
                      loading={pending && decide.variables?.status === 'verse'}
                      disabled={decide.isPending}
                      onPress={() =>
                        confirm(
                          t('admin.markPaid'),
                          t('admin.markPaidText', { amount: formatPrice(item.amount, lang), store: item.storeName }),
                          { confirm: t('common.confirm'), cancel: t('common.cancel') },
                          () => decide.mutate({ id: item.id, status: 'verse' }),
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
                      onPress={() => setRejecting(item)}
                    />
                  </View>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            withdrawals.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<Banknote size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={withdrawals.isRefetching}
              onRefresh={() => withdrawals.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
      {rejecting ? (
        <PromptModal
          title={t('admin.rejectWithdrawal')}
          message={t('admin.rejectWithdrawalText')}
          placeholder={t('admin.reasonPlaceholder')}
          confirmLabel={t('admin.reject')}
          minLength={5}
          destructive
          loading={decide.isPending}
          onConfirm={(reason) => decide.mutate({ id: rejecting.id, status: 'rejete', reason })}
          onClose={() => setRejecting(null)}
        />
      ) : null}
    </Screen>
  );
}
