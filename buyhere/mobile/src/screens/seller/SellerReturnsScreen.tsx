import { useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react-native';
import { returnsApi } from '@/api/account';
import { errorMessage } from '@/api/client';
import type { ReturnRequest, ReturnStatus } from '@/api/types';
import { sellerApi } from '@/api/vendor';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { useRefreshSeller } from '@/hooks/useSeller';
import { useIsAdmin } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDate, formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

type Filter = 'todo' | 'all';
const OPEN: ReturnStatus[] = ['demande', 'approuve'];
// L'admin voit tous les retours et tranche aussi les litiges (vendeur muet ou en désaccord).
const OPEN_ADMIN: ReturnStatus[] = ['litige', 'demande', 'approuve'];

function ReturnItem({ item, admin }: { item: ReturnRequest; admin: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const refresh = useRefreshSeller();
  const [refusing, setRefusing] = useState(false);
  const [comment, setComment] = useState('');

  const decide = useMutation({
    mutationFn: ({ status, note }: { status: 'approuve' | 'refuse' | 'rembourse'; note?: string }) =>
      sellerApi.decideReturn(item.id, status, note),
    onSuccess: () => {
      refresh();
      setRefusing(false);
      toast(t('seller.returnUpdated'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const overdue = item.status === 'demande' && item.vendorDeadline && new Date(item.vendorDeadline) < new Date();

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-bold text-ink dark:text-gray-100">{t('returns.rma', { id: item.id })}</Text>
          <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">
            {t('orders.order', { number: item.orderNumber })}
            {item.customerName ? ` · ${item.customerName}` : ''} · {formatDate(item.createdAt, lang)}
          </Text>
        </View>
        <Text className="text-xs font-bold text-primary">{t(`returns.status.${item.status}`)}</Text>
      </View>

      <Text className="mt-3 text-sm text-ink dark:text-gray-200">
        <Text className="font-semibold">{t(`returns.reason.${item.reasonCategory}`)} — </Text>
        {item.reason}
      </Text>
      <Text className="mt-1 text-xs text-ink-muted dark:text-gray-400">
        {item.reasonCategory === 'changement_avis' ? t('returns.feesClient') : t('seller.feesStore')}
        {item.refundAmount !== null
          ? ` · ${t('seller.refundAmount', { amount: formatPrice(item.refundAmount, lang) })}`
          : ''}
      </Text>

      {item.photos.length ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {item.photos.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
          ))}
        </View>
      ) : null}

      {item.status === 'demande' && item.vendorDeadline ? (
        <Text className={`mt-3 text-xs font-semibold ${overdue ? 'text-danger' : 'text-amber-600'}`}>
          {t('seller.answerBefore', { date: formatDateTime(item.vendorDeadline, lang) })}
        </Text>
      ) : null}
      {item.status === 'litige' ? (
        <Text className={`mt-3 text-xs ${admin ? 'font-semibold text-danger' : 'text-ink-muted dark:text-gray-400'}`}>
          {admin ? t('admin.disputeToSettle') : t('seller.mediation')}
        </Text>
      ) : null}
      {admin && item.storeName ? (
        <Text className="mt-2 text-xs text-ink-muted dark:text-gray-400">{t('admin.storeLabel', { name: item.storeName })}</Text>
      ) : null}
      {item.sellerComment ? (
        <Text className="mt-2 text-xs text-ink-muted dark:text-gray-400">
          {admin ? t('admin.sellerComment') : t('seller.yourComment')} : {item.sellerComment}
        </Text>
      ) : null}

      {/* Décisions possibles */}
      {(item.status === 'demande' || (admin && item.status === 'litige')) && !refusing ? (
        <View className="mt-4 flex-row gap-2">
          <Button
            title={t('seller.accept')}
            size="sm"
            className="flex-1"
            loading={decide.isPending && decide.variables?.status === 'approuve'}
            onPress={() => decide.mutate({ status: 'approuve' })}
          />
          <Button
            title={t('seller.refuse')}
            size="sm"
            variant="outline"
            className="flex-1"
            onPress={() => setRefusing(true)}
          />
        </View>
      ) : null}
      {refusing ? (
        <View className="mt-4 gap-2">
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('seller.refuseReason')}
            placeholderTextColor={colors.subtle}
            multiline
            className="min-h-20 rounded-2xl bg-surface-muted p-3 text-sm text-ink dark:bg-surface-dark-muted dark:text-gray-100"
            accessibilityLabel={t('seller.refuseReason')}
          />
          <View className="flex-row gap-2">
            <Button
              title={t('common.cancel')}
              size="sm"
              variant="ghost"
              className="flex-1"
              onPress={() => setRefusing(false)}
            />
            <Button
              title={t('seller.confirmRefuse')}
              size="sm"
              variant="danger"
              className="flex-1"
              disabled={comment.trim().length < 5}
              loading={decide.isPending}
              onPress={() => decide.mutate({ status: 'refuse', note: comment.trim() })}
            />
          </View>
        </View>
      ) : null}
      {item.status === 'approuve' ? (
        <Button
          title={t('seller.refund')}
          size="sm"
          className="mt-4"
          loading={decide.isPending}
          onPress={() =>
            confirm(
              t('seller.refund'),
              t('seller.refundConfirm'),
              { confirm: t('common.confirm'), cancel: t('common.cancel') },
              () => decide.mutate({ status: 'rembourse' }),
            )
          }
        />
      ) : null}
    </View>
  );
}

/** Demandes de retour de la boutique : réponse sous 48 h, puis remboursement. */
export function SellerReturnsScreen(_props: RootScreenProps<'SellerReturns'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const admin = useIsAdmin();
  const [filter, setFilter] = useState<Filter>('todo');
  const returns = useQuery({ queryKey: ['returns'], queryFn: returnsApi.list });
  const open = admin ? OPEN_ADMIN : OPEN;
  const items = (returns.data ?? [])
    .filter((r) => filter === 'all' || open.includes(r.status))
    // Litiges en tête pour l'admin.
    .sort((a, b) => (admin ? Number(b.status === 'litige') - Number(a.status === 'litige') : 0));

  return (
    <Screen muted>
      <Header title={admin ? t('admin.returns') : t('seller.returns')} />
      <View className="flex-row gap-2 bg-white px-4 py-2.5 dark:bg-surface-dark">
        <Chip label={t('seller.returnFilter.todo')} selected={filter === 'todo'} onPress={() => setFilter('todo')} />
        <Chip label={t('seller.returnFilter.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
      </View>
      {returns.isError && !returns.data ? (
        <ErrorState error={returns.error} onRetry={() => returns.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => <ReturnItem item={item} admin={admin} />}
          ListEmptyComponent={
            returns.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<RotateCcw size={40} color={colors.primary} />} title={t('seller.noReturns')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={returns.isRefetching}
              onRefresh={() => returns.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
