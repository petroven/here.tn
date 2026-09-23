import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, MapPinPlus, Smartphone } from 'lucide-react-native';
import { ordersApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { PaymentMethod } from '@/api/types';
import { AddressCard } from '@/components/AddressCard';
import { OrderSummary } from '@/components/OrderSummary';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toast';
import { qk, useAddresses, useCart } from '@/hooks/queries';
import { PAYMENT_RETURN_URL } from '@/config';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Checkout : adresse de livraison, mode de paiement et récapitulatif.
 * Paiement en ligne : la page Konnect/Flouci s'ouvre dans un navigateur
 * in-app puis l'API vérifie le paiement au retour.
 */
export function CheckoutScreen({ navigation }: RootScreenProps<'Checkout'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const cart = useCart();
  const addresses = useAddresses();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [note, setNote] = useState('');

  // Sélectionne l'adresse par défaut (ou la première) à chaque rechargement de la
  // liste : après un ajout ou un choix dans « Mes adresses », elle devient la sélection.
  useEffect(() => {
    const list = addresses.data ?? [];
    setAddressId(list.length ? (list.find((a) => a.isDefault) ?? list[0]).id : null);
  }, [addresses.data]);

  const placeOrder = useMutation({
    mutationFn: () => ordersApi.create({ addressId: addressId!, paymentMethod: method, note: note.trim() || undefined }),
    onSuccess: async ({ order, payUrl }) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: qk.unread });

      if (order.paymentMethod !== 'CASH_ON_DELIVERY') {
        if (payUrl) {
          await WebBrowser.openAuthSessionAsync(payUrl, PAYMENT_RETURN_URL);
          // Quelle que soit la façon dont le navigateur a été fermé, on vérifie côté serveur.
          const status = await ordersApi.verifyPayment(order.id).catch(() => null);
          if (status?.paymentStatus !== 'PAID') toast(t('checkout.paymentFailed'));
        } else {
          toast(t('checkout.paymentFailed'));
        }
      }
      navigation.reset({
        index: 1,
        routes: [{ name: 'Main', params: { screen: 'Home' } }, { name: 'OrderConfirmation', params: { orderId: order.id } }],
      });
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const payments: { value: PaymentMethod; title: string; text: string; icon: ReactNode; sandbox?: boolean }[] = [
    { value: 'CASH_ON_DELIVERY', title: t('checkout.cod'), text: t('checkout.codText'), icon: <Banknote size={22} color={colors.primary} /> },
    { value: 'KONNECT', title: t('checkout.konnect'), text: t('checkout.konnectText'), icon: <CreditCard size={22} color={colors.primary} />, sandbox: true },
    { value: 'FLOUCI', title: t('checkout.flouci'), text: t('checkout.flouciText'), icon: <Smartphone size={22} color={colors.primary} />, sandbox: true },
  ];

  const data = cart.data;
  const selectedAddress = addresses.data?.find((a) => a.id === addressId);
  const Section = ({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) => (
    <View className="mx-4 mb-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-bold text-ink dark:text-gray-100">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );

  return (
    <Screen muted>
      <Header title={t('checkout.title')} />
      <ScrollView contentContainerClassName="pt-3 pb-6" keyboardShouldPersistTaps="handled">
        {/* Adresse */}
        <Section
          title={t('checkout.address')}
          right={
            addresses.data?.length ? (
              <Pressable onPress={() => navigation.navigate('Addresses', { selectMode: true })} hitSlop={8}>
                <Text className="font-semibold text-primary">{t('checkout.change')}</Text>
              </Pressable>
            ) : null
          }
        >
          {addresses.isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : selectedAddress ? (
            <View className="gap-2">
              {(addresses.data ?? []).length > 1
                ? (addresses.data ?? []).map((a) => (
                    <AddressCard key={a.id} address={a} selected={a.id === addressId} onPress={() => setAddressId(a.id)} />
                  ))
                : <AddressCard address={selectedAddress} selected />}
            </View>
          ) : (
            <View>
              <Text className="mb-3 text-sm text-ink-muted dark:text-gray-400">{t('checkout.noAddress')}</Text>
              <Button
                title={t('checkout.addAddress')}
                variant="secondary"
                icon={<MapPinPlus size={18} color={colors.primary} />}
                onPress={() => navigation.navigate('AddressForm')}
              />
            </View>
          )}
        </Section>

        {/* Paiement */}
        <Section title={t('checkout.payment')}>
          <View className="gap-2.5">
            {payments.map((p) => {
              const active = method === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setMethod(p.value)}
                  className={`flex-row items-center gap-3 rounded-2xl border p-3.5 ${
                    active ? 'border-primary bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'
                  }`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-white dark:bg-surface-dark-muted">{p.icon}</View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-semibold text-ink dark:text-gray-100">{p.title}</Text>
                      {p.sandbox ? (
                        <View className="rounded bg-amber-100 px-1.5 py-0.5 dark:bg-amber-900/40">
                          <Text className="text-2xs font-bold text-amber-700 dark:text-amber-300">{t('checkout.sandbox')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">{p.text}</Text>
                  </View>
                  <View className={`h-5 w-5 items-center justify-center rounded-full border-2 ${active ? 'border-primary' : 'border-gray-300'}`}>
                    {active ? <View className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Récapitulatif */}
        <Section title={t('checkout.summary')}>
          {data?.items.map((item) => (
            <View key={item.id} className="mb-3 flex-row items-center gap-3">
              <Image source={item.imageUrl ? { uri: item.imageUrl } : undefined} style={{ width: 48, height: 48, borderRadius: 10 }} />
              <View className="flex-1">
                <Text className="text-sm text-ink dark:text-gray-100" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-ink-muted">
                  {[item.size, item.color].filter(Boolean).join(' · ')}
                  {item.size || item.color ? ' · ' : ''}× {item.quantity}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-ink dark:text-gray-100">{formatPrice(item.lineTotal, lang)}</Text>
            </View>
          ))}
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('checkout.notePlaceholder')}
            placeholderTextColor={colors.subtle}
            maxLength={500}
            multiline
            className="mb-4 mt-1 min-h-[60px] rounded-xl bg-surface-muted p-3 text-sm text-ink dark:bg-surface-dark-muted dark:text-gray-100"
            style={{ textAlignVertical: 'top' }}
            accessibilityLabel={t('checkout.note')}
          />
          {data ? <OrderSummary {...data} /> : null}
        </Section>
      </ScrollView>

      <View className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-surface-dark">
        <Button
          title={data ? `${t('checkout.placeOrder')} · ${formatPrice(data.total, lang)}` : t('checkout.placeOrder')}
          size="lg"
          disabled={!addressId || !data || data.items.length === 0}
          loading={placeOrder.isPending}
          onPress={() => placeOrder.mutate()}
        />
      </View>
    </Screen>
  );
}
