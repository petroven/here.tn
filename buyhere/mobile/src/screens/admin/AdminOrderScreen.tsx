import { useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Phone, ShoppingBag } from 'lucide-react-native';
import { adminApi, nextOrderStatuses, type OrderStatusFr } from '@/api/admin';
import { errorMessage } from '@/api/client';
import { InfoRow, SellerCard } from '@/components/seller/SellerCard';
import { SellerOrderBadge } from '@/components/seller/SellerOrderBadge';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { PromptModal } from '@/components/ui/PromptModal';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { useAdminOrderHistory, useAdminOrders, useRefreshAdmin } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Commande vue par l'admin : client, boutique, chronologie complète et
 * changement de statut manuel (commentaire obligatoire, même machine d'états
 * que le site ; une annulation remet le stock).
 */
export function AdminOrderScreen({ route }: RootScreenProps<'AdminOrder'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const { orderId } = route.params;
  const orders = useAdminOrders();
  const history = useAdminOrderHistory(orderId);
  const refresh = useRefreshAdmin();
  const [target, setTarget] = useState<OrderStatusFr | null>(null);
  const order = orders.data?.find((o) => o.id === orderId);

  const change = useMutation({
    mutationFn: ({ status, comment }: { status: OrderStatusFr; comment: string }) =>
      adminApi.setOrderStatus(orderId, status, comment),
    onSuccess: () => {
      setTarget(null);
      refresh();
      toast(t('admin.saved'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  if (!order) {
    return (
      <Screen muted>
        <Header title={t('admin.order')} />
        {orders.isError && !orders.data ? (
          <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
        ) : orders.isLoading ? (
          <View className="p-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
          </View>
        ) : (
          <EmptyState icon={<ShoppingBag size={40} color={colors.primary} />} title={t('admin.notFound')} />
        )}
      </Screen>
    );
  }

  const next = nextOrderStatuses(order.status);

  return (
    <Screen muted>
      <Header title={order.number} />
      <ScrollView contentContainerClassName="p-4 pb-10">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm text-ink-muted dark:text-gray-400">{formatDateTime(order.createdAt, lang)}</Text>
          <SellerOrderBadge status={order.status} />
        </View>

        <SellerCard title={t('admin.customer')}>
          <InfoRow
            label={t('admin.name')}
            value={order.customer.name + (order.customer.guest ? ` (${t('admin.guest')})` : '')}
          />
          <InfoRow label={t('auth.email')} value={order.customer.email || '—'} />
          <InfoRow label={t('auth.phone')} value={order.customer.phone || '—'} />
          <Text className="mt-2 text-sm text-ink dark:text-gray-200">{order.address}</Text>
          {order.customer.phone ? (
            <Button
              title={t('courier.call')}
              size="sm"
              variant="outline"
              className="mt-3"
              icon={<Phone size={15} color={colors.text} />}
              onPress={() => Linking.openURL(`tel:${order.customer.phone}`)}
            />
          ) : null}
        </SellerCard>

        <SellerCard title={t('admin.order')}>
          <InfoRow label={t('admin.store')} value={order.storeName ?? '—'} />
          <InfoRow label={t('cart.total')} value={formatPrice(order.total, lang)} strong />
        </SellerCard>

        <SellerCard title={t('admin.changeStatus')}>
          {next.length ? (
            <>
              <Text className="mb-3 text-xs leading-5 text-ink-muted dark:text-gray-400">
                {t('admin.changeStatusHint')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {next.map((s) => (
                  <Chip key={s} label={t(`seller.status.${s}`)} onPress={() => setTarget(s)} />
                ))}
              </View>
            </>
          ) : (
            <Text className="text-sm text-ink-muted dark:text-gray-400">{t('admin.finalStatus')}</Text>
          )}
        </SellerCard>

        <SellerCard title={t('admin.history')}>
          {history.isLoading ? <Skeleton className="h-16 w-full rounded-xl" /> : null}
          {(history.data ?? []).map((h, i, list) => (
            <View key={h.id} className="flex-row gap-3">
              <View className="items-center">
                <View
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${i === list.length - 1 ? 'bg-primary' : 'bg-gray-300'}`}
                />
                {i < list.length - 1 ? <View className="w-px flex-1 bg-gray-200 dark:bg-gray-700" /> : null}
              </View>
              <View className="flex-1 pb-4">
                <Text className="text-sm font-semibold text-ink dark:text-gray-100">
                  {t(`seller.status.${h.to}`, { defaultValue: h.to })}
                </Text>
                <Text className="text-xs text-ink-muted dark:text-gray-400">
                  {formatDateTime(h.createdAt, lang)}
                  {h.author ? ` · ${h.author}` : ''}
                </Text>
                {h.comment ? <Text className="mt-0.5 text-xs text-ink dark:text-gray-300">{h.comment}</Text> : null}
              </View>
            </View>
          ))}
        </SellerCard>
      </ScrollView>

      {target ? (
        <PromptModal
          title={t('admin.changeStatusTo', { status: t(`seller.status.${target}`) })}
          message={target === 'annulee' ? t('admin.cancelWarning') : t('admin.commentRequired')}
          placeholder={t('admin.commentPlaceholder')}
          confirmLabel={t('common.confirm')}
          minLength={3}
          destructive={target === 'annulee'}
          loading={change.isPending}
          onConfirm={(comment) => change.mutate({ status: target, comment })}
          onClose={() => setTarget(null)}
        />
      ) : null}
    </Screen>
  );
}
