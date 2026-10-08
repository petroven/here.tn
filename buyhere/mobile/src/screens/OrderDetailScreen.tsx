import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, MessageCircle, RotateCcw } from 'lucide-react-native';
import { returnsApi, shareInvoice } from '@/api/account';
import { useStartChat } from '@/hooks/useStartChat';
import { ordersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { OrderStatusBadge, OrderTimeline } from '@/components/OrderStatus';
import { CourierCard } from '@/components/CourierCard';
import { OrderMap } from '@/components/OrderMap';
import { OrderSummary } from '@/components/OrderSummary';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { qk, useOrder } from '@/hooks/queries';
import { PAYMENT_RETURN_URL } from '@/config';
import { useSettingsStore } from '@/store/settings';
import { useIsLoggedIn } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPhone, formatPrice } from '@/utils/format';
import { governorateLabel } from '@/utils/governorates';
import type { RootScreenProps } from '@/navigation/types';

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="mx-4 mb-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
    <Text className="mb-3 text-base font-bold text-ink dark:text-gray-100">{title}</Text>
    {children}
  </View>
);

/** Détail d'une commande : suivi de statut, articles, adresse, paiement, annulation. */
export function OrderDetailScreen({ route, navigation }: RootScreenProps<'OrderDetail'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const loggedIn = useIsLoggedIn();
  const order = useOrder(route.params.orderId);
  const o = order.data;
  const chat = useStartChat();
  const [downloading, setDownloading] = useState(false);
  // Une seule demande de retour par commande (règle du site).
  const returns = useQuery({
    queryKey: ['returns'],
    queryFn: returnsApi.list,
    enabled: loggedIn && o?.status === 'DELIVERED',
  });
  const existingReturn = returns.data?.find((r) => r.orderId === route.params.orderId);

  const downloadInvoice = async () => {
    if (!o) return;
    setDownloading(true);
    try {
      await shareInvoice(o.id, o.number, lang);
    } catch (err) {
      toast(errorMessage(err, t('common.networkError')));
    } finally {
      setDownloading(false);
    }
  };

  // Ouvert par un lien (notification, buyhere://commande/12) sans être
  // connecté : on passe par la connexion, qui revient ensuite ici.
  useEffect(() => {
    if (!loggedIn) navigation.navigate('Login', { redirect: 'back' });
  }, [loggedIn, navigation]);

  // Pendant la livraison, la position et l'heure d'arrivée du livreur sont
  // relues toutes les 30 s tant que l'écran est ouvert.
  const enLivraison = !!o?.courier;
  const { refetch } = order;
  useEffect(() => {
    if (!enLivraison) return undefined;
    const id = setInterval(() => refetch(), 30_000);
    return () => clearInterval(id);
  }, [enLivraison, refetch]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: qk.order(route.params.orderId) });
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(route.params.orderId),
    onSuccess: (updated) => {
      qc.setQueryData(qk.order(updated.id), updated);
      refreshAll();
      toast(t('orders.cancelled'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const pay = useMutation({
    mutationFn: async () => {
      const { payUrl } = await ordersApi.pay(route.params.orderId);
      await WebBrowser.openAuthSessionAsync(payUrl, PAYMENT_RETURN_URL);
      return ordersApi.verifyPayment(route.params.orderId);
    },
    onSuccess: (status) => {
      refreshAll();
      if (status.paymentStatus !== 'PAID') toast(t('checkout.paymentFailed'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  if (order.isError) {
    return (
      <Screen>
        <Header title={t('orders.details')} />
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </Screen>
    );
  }

  const canCancel = o && (o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PREPARING');
  const canPay =
    o &&
    (o.paymentMethod === 'KONNECT' || o.paymentMethod === 'FLOUCI') &&
    o.paymentStatus !== 'PAID' &&
    o.status !== 'CANCELLED';

  return (
    <Screen muted>
      <Header title={o ? o.number : t('orders.details')} />
      {!o ? (
        <View className="pt-3">
          <Skeleton className="mx-4 mb-3 h-48 rounded-2xl" />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="pt-3 pb-8"
          refreshControl={
            <RefreshControl
              refreshing={order.isRefetching}
              onRefresh={() => order.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View className="mx-4 mb-3 flex-row items-center justify-between">
            <Text className="text-sm text-ink-muted dark:text-gray-400">{formatDateTime(o.createdAt, lang)}</Text>
            <OrderStatusBadge status={o.status} />
          </View>

          <Card title={t('orders.tracking')}>
            <OrderTimeline order={o} />
          </Card>

          {/* Hors du composant Card (recréé à chaque rendu) : la carte ne doit
              pas se recharger à chaque relecture de la position du livreur. */}
          {o.map && !['DELIVERED', 'CANCELLED', 'REFUNDED', 'RETURN_REQUESTED'].includes(o.status) ? (
            <View className="mx-4 mb-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <Text className="mb-3 text-base font-bold text-ink dark:text-gray-100">{t('orders.map.title')}</Text>
              <OrderMap map={o.map} />
            </View>
          ) : null}

          {o.courier ? (
            <Card title={t('orders.courier.title')}>
              <CourierCard courier={o.courier} />
            </Card>
          ) : null}

          <Card title={t('orders.items', { count: o.itemCount })}>
            {o.items.map((item) => (
              <Pressable
                key={item.id}
                disabled={!item.productId}
                onPress={() =>
                  item.productId &&
                  navigation.navigate('ProductDetail', {
                    idOrSlug: item.productId,
                  })
                }
                className="mb-3 flex-row items-center gap-3"
              >
                <Image
                  source={item.imageUrl ? { uri: item.imageUrl } : undefined}
                  style={{ width: 56, height: 56, borderRadius: 12 }}
                />
                <View className="flex-1">
                  <Text className="text-sm text-ink dark:text-gray-100" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-ink-muted">
                    {[item.size, item.color].filter(Boolean).join(' · ')}
                    {item.size || item.color ? ' · ' : ''}× {item.quantity}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-ink dark:text-gray-100">
                  {formatPrice(item.lineTotal, lang)}
                </Text>
              </Pressable>
            ))}
            <View className="mt-1 border-t border-gray-100 pt-3 dark:border-gray-800">
              <OrderSummary {...o} />
            </View>
          </Card>

          <Card title={t('orders.shippingTo')}>
            {o.shippingAddress.fullName ? (
              <Text className="mb-1 font-semibold text-ink dark:text-gray-100">{o.shippingAddress.fullName}</Text>
            ) : null}
            <Text className="text-sm text-ink-muted dark:text-gray-400">
              {[o.shippingAddress.street, o.shippingAddress.city, governorateLabel(o.shippingAddress.governorate, lang)]
                .filter(Boolean)
                .join(', ')}
            </Text>
            {o.shippingAddress.phone ? (
              <Text className="text-sm text-ink-muted dark:text-gray-400" style={{ writingDirection: 'ltr' }}>
                {formatPhone(o.shippingAddress.phone)}
              </Text>
            ) : null}
            {o.trackingId ? (
              <Text className="mt-2 text-sm text-ink-muted dark:text-gray-400">
                {t('orders.trackingNumber')} :{' '}
                <Text className="font-bold text-ink dark:text-gray-100">{o.trackingId}</Text>
              </Text>
            ) : null}
          </Card>

          <Card title={t('orders.paymentMethod')}>
            <View className="flex-row items-center justify-between">
              <Text className="text-ink dark:text-gray-100">{t(`orders.payment.${o.paymentMethod}`)}</Text>
              <Text
                className={`font-semibold ${o.paymentStatus === 'PAID' ? 'text-success' : 'text-ink-muted dark:text-gray-400'}`}
              >
                {t(`orders.paymentStatus.${o.paymentStatus}`)}
              </Text>
            </View>
          </Card>

          <View className="mx-4 mt-2 gap-3">
            {o.status === 'DELIVERED' && !existingReturn && !returns.isLoading ? (
              <Button
                title={t('returns.request')}
                variant="secondary"
                icon={<RotateCcw size={18} color={colors.primary} />}
                onPress={() =>
                  navigation.navigate('ReturnRequest', {
                    orderId: o.id,
                    orderNumber: o.number,
                  })
                }
              />
            ) : null}
            {existingReturn || o.status === 'RETURN_REQUESTED' || o.status === 'REFUNDED' ? (
              <Button
                title={t('returns.follow')}
                variant="secondary"
                icon={<RotateCcw size={18} color={colors.primary} />}
                onPress={() => navigation.navigate('Returns')}
              />
            ) : null}
            {o.store?.vendorId ? (
              <Button
                title={t('messages.contactStore')}
                variant="outline"
                loading={chat.opening}
                icon={<MessageCircle size={18} color={colors.text} />}
                onPress={() => chat.start(o.store!.vendorId, o.store!.name, t('orders.order', { number: o.number }))}
              />
            ) : null}
            <Button
              title={t('orders.invoice')}
              variant="outline"
              loading={downloading}
              icon={<FileDown size={18} color={colors.text} />}
              onPress={downloadInvoice}
            />
            {canPay ? (
              <Button title={t('orders.payNow')} size="lg" loading={pay.isPending} onPress={() => pay.mutate()} />
            ) : null}
            {canCancel ? (
              <Button
                title={t('orders.cancel')}
                variant="outline"
                loading={cancel.isPending}
                onPress={() =>
                  confirm(
                    t('orders.cancel'),
                    t('orders.cancelConfirm'),
                    { confirm: t('common.yes'), cancel: t('common.no') },
                    () => cancel.mutate(),
                  )
                }
              />
            ) : null}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
