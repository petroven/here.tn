import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileDown, Phone } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { isAwaitingPayment, nextShippingSteps, sellerApi, type ShippingStep } from '@/api/vendor';
import { SellerOrderBadge } from '@/components/seller/SellerOrderBadge';
import { InfoRow, SellerCard } from '@/components/seller/SellerCard';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { sellerKeys, useRefreshSeller, useSellerDashboard } from '@/hooks/useSeller';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Détail d'une commande reçue : client, articles, montants (commission et
 * net), chronologie, et l'étape suivante (préparation → expédition →
 * livraison). Les étapes impossibles ne sont pas proposées ; le serveur
 * refuse de toute façon un retour en arrière.
 */
export function SellerOrderDetailScreen({ route }: RootScreenProps<'SellerOrderDetail'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const dashboard = useSellerDashboard();
  const refresh = useRefreshSeller();
  const { orderId } = route.params;
  const order = dashboard.data?.orders.find((o) => o.id === orderId);
  const history = useQuery({ queryKey: sellerKeys.history(orderId), queryFn: () => sellerApi.orderHistory(orderId) });
  const [sharing, setSharing] = useState(false);

  const advance = useMutation({
    mutationFn: (step: ShippingStep) => sellerApi.advanceShipping(orderId, step),
    onSuccess: () => {
      refresh();
      history.refetch();
      toast(t('seller.statusUpdated'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const shareAwb = async () => {
    if (!order) return;
    setSharing(true);
    try {
      await sellerApi.shareAwb(order.id, order.number);
    } catch (err) {
      toast(errorMessage(err, t('common.networkError')));
    } finally {
      setSharing(false);
    }
  };

  if (dashboard.isError && !dashboard.data) {
    return (
      <Screen>
        <Header title={t('seller.orders')} />
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen muted>
        <Header title={t('seller.orders')} />
        <Skeleton className="m-4 h-64 rounded-2xl" />
      </Screen>
    );
  }

  const steps = nextShippingSteps(order);
  const blockedByPayment = isAwaitingPayment(order);
  return (
    <Screen muted>
      <Header title={order.number} />
      <ScrollView contentContainerClassName="p-4 pb-10">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm text-ink-muted dark:text-gray-400">{formatDateTime(order.createdAt, lang)}</Text>
          <SellerOrderBadge status={order.status} />
        </View>

        {/* Action suivante */}
        {steps.length ? (
          <SellerCard title={t('seller.nextStep')}>
            {blockedByPayment ? (
              <Text className="text-sm text-ink-muted dark:text-gray-400">{t('seller.awaitingPaymentText')}</Text>
            ) : (
              <View className="gap-2.5">
                {order.awaitingCustomerConfirmation ? (
                  <Text className="text-xs font-semibold text-amber-600">{t('seller.awaitingConfirmationText')}</Text>
                ) : null}
                {steps.map((step, i) => (
                  <Button
                    key={step}
                    title={t(`seller.step.${step}`)}
                    variant={i === 0 ? 'primary' : 'outline'}
                    disabled={advance.isPending || (step !== 'en_preparation' && order.awaitingCustomerConfirmation)}
                    loading={advance.isPending && advance.variables === step}
                    onPress={() =>
                      i === 0
                        ? advance.mutate(step)
                        : confirm(
                            t(`seller.step.${step}`),
                            t('seller.skipConfirm'),
                            { confirm: t('common.confirm'), cancel: t('common.cancel') },
                            () => advance.mutate(step),
                          )
                    }
                  />
                ))}
              </View>
            )}
          </SellerCard>
        ) : null}

        <SellerCard title={t('seller.customer')}>
          <Text className="font-semibold text-ink dark:text-gray-100">{order.customer?.name ?? t('seller.guest')}</Text>
          <Text className="mt-1 text-sm text-ink-muted dark:text-gray-400">{order.address}</Text>
          {order.customer?.phone ? (
            <Pressable
              onPress={() => Linking.openURL(`tel:${order.customer!.phone}`)}
              className="mt-3 flex-row items-center gap-2 self-start rounded-xl border border-primary px-3 py-2"
              accessibilityRole="button"
            >
              <Phone size={15} color={colors.primary} />
              <Text className="font-semibold text-primary" style={{ writingDirection: 'ltr' }}>
                {order.customer.phone}
              </Text>
            </Pressable>
          ) : null}
        </SellerCard>

        <SellerCard title={t('orders.items', { count: order.itemCount })}>
          {order.items.map((item) => (
            <View key={item.id} className="mb-3 flex-row items-center gap-3">
              <Image
                source={item.imageUrl ? { uri: item.imageUrl } : undefined}
                style={{ width: 48, height: 48, borderRadius: 10 }}
              />
              <View className="flex-1">
                <Text className="text-sm text-ink dark:text-gray-100" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-xs text-ink-muted">× {item.quantity}</Text>
              </View>
              <Text className="text-sm font-semibold text-ink dark:text-gray-100">
                {formatPrice(item.unitPrice * item.quantity, lang)}
              </Text>
            </View>
          ))}
          <View className="mt-1 border-t border-gray-100 pt-2 dark:border-gray-800">
            <InfoRow label={t('cart.subtotal')} value={formatPrice(order.subtotal, lang)} />
            <InfoRow label={t('cart.shipping')} value={formatPrice(order.shippingFee, lang)} />
            {order.stampDuty > 0 ? (
              <InfoRow label={t('cart.stampDuty')} value={formatPrice(order.stampDuty, lang)} />
            ) : null}
            <InfoRow label={t('seller.paidByCustomer')} value={formatPrice(order.total, lang)} />
            <InfoRow label={t('seller.commission')} value={formatPrice(-order.commission, lang)} />
            <InfoRow label={t('seller.net')} value={formatPrice(order.net, lang)} strong />
          </View>
        </SellerCard>

        <SellerCard title={t('seller.shipping')}>
          <InfoRow
            label={t('seller.paymentLabel')}
            value={t(`seller.payment.${order.paymentMethod}`, { defaultValue: order.paymentMethod })}
          />
          {order.tracking ? (
            <>
              <InfoRow label={t('orders.trackingNumber')} value={order.tracking.trackingId} />
              {order.tracking.awb ? <InfoRow label="AWB" value={order.tracking.awb} /> : null}
              <Button
                title={t('seller.awb')}
                variant="outline"
                className="mt-3"
                loading={sharing}
                icon={<FileDown size={18} color={colors.text} />}
                onPress={shareAwb}
              />
            </>
          ) : null}
        </SellerCard>

        <SellerCard title={t('seller.history')}>
          {(history.data ?? []).map((h) => (
            <View key={h.id} className="mb-2 flex-row gap-3">
              <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
              <View className="flex-1">
                <Text className="text-sm text-ink dark:text-gray-100">
                  {h.event && h.comment ? h.comment : t(`seller.status.${h.status}`, { defaultValue: h.status })}
                </Text>
                <Text className="text-xs text-ink-muted">
                  {formatDateTime(h.at, lang)}
                  {!h.event && h.comment ? ` · ${h.comment}` : ''}
                </Text>
              </View>
            </View>
          ))}
          {history.isLoading ? <Skeleton className="h-16 w-full rounded-xl" /> : null}
        </SellerCard>
      </ScrollView>
    </Screen>
  );
}
