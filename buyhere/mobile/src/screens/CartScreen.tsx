import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Tag, Truck, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { CartItemRow } from '@/components/CartItemRow';
import { OrderSummary } from '@/components/OrderSummary';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import {
  useApplyCoupon,
  useCart,
  useClearCart,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartItem,
} from '@/hooks/queries';
import { useIsLoggedIn } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { TabScreenProps } from '@/navigation/types';

/** Panier : quantités, suppression, code promo, progression livraison gratuite et total. */
export function CartScreen({ navigation }: TabScreenProps<'Cart'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const loggedIn = useIsLoggedIn();
  const cart = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const clear = useClearCart();
  const applyCoupon = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const [code, setCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const busyItem = update.isPending ? update.variables?.itemId : remove.isPending ? remove.variables : undefined;

  const header = (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
      <Text className="text-2xl font-extrabold text-ink dark:text-gray-100">{t('cart.title')}</Text>
      {cart.data && cart.data.items.length > 0 ? (
        <Pressable
          hitSlop={8}
          onPress={() =>
            confirm(t('cart.clear'), t('cart.clearConfirm'), { confirm: t('common.confirm'), cancel: t('common.cancel') }, () =>
              clear.mutate(),
            )
          }
        >
          <Text className="font-semibold text-ink-muted dark:text-gray-400">{t('cart.clear')}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (!loggedIn) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={<ShoppingBag size={40} color={colors.primary} />}
          title={t('auth.loginRequired')}
          text={t('auth.loginRequiredText')}
          action={{ label: t('auth.login'), onPress: () => navigation.navigate('Login', { redirect: 'back' }) }}
        />
      </Screen>
    );
  }

  if (cart.isLoading) {
    return (
      <Screen muted>
        {header}
        <ListItemSkeleton />
        <ListItemSkeleton />
        <ListItemSkeleton />
      </Screen>
    );
  }

  if (cart.isError || !cart.data) {
    return (
      <Screen>
        {header}
        <ErrorState error={cart.error} onRetry={() => cart.refetch()} />
      </Screen>
    );
  }

  const data = cart.data;
  if (data.items.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={<ShoppingBag size={40} color={colors.primary} />}
          title={t('cart.empty')}
          text={t('cart.emptyText')}
          action={{ label: t('cart.startShopping'), onPress: () => navigation.navigate('Home') }}
        />
      </Screen>
    );
  }

  const hasUnavailable = data.items.some((i) => !i.isAvailable);

  const onApply = () => {
    if (!code.trim()) return;
    setCouponError(null);
    applyCoupon.mutate(code.trim(), {
      onSuccess: () => setCode(''),
      onError: (err) => setCouponError(errorMessage(err, t('common.networkError'))),
    });
  };

  return (
    <Screen muted>
      {header}
      <FlatList
        data={data.items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            busy={busyItem === item.id}
            onQuantity={(quantity) =>
              update.mutate({ itemId: item.id, quantity }, { onError: (e) => toast(errorMessage(e, t('common.networkError'))) })
            }
            onRemove={() => remove.mutate(item.id)}
          />
        )}
        ListHeaderComponent={
          // Frais de livraison : fixés par gouvernorat, connus au paiement
          <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-2xl bg-white p-3.5 dark:bg-surface-dark-card">
            <Truck size={18} color={colors.primary} />
            <Text className="flex-1 text-sm font-medium text-ink dark:text-gray-200">{t('cart.shippingInfo')}</Text>
          </View>
        }
        ListFooterComponent={
          <View className="mx-4 mt-1 gap-3 pb-6">
            {/* Code promo */}
            <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <Text className="mb-2.5 font-semibold text-ink dark:text-gray-100">{t('cart.promoCode')}</Text>
              {data.couponCode && !data.couponError ? (
                <View className="flex-row items-center justify-between rounded-xl bg-green-50 px-3 py-2.5 dark:bg-green-900/30">
                  <View className="flex-row items-center gap-2">
                    <Tag size={16} color={colors.success} />
                    <Text className="font-bold text-success">{data.couponCode}</Text>
                  </View>
                  <Pressable onPress={() => removeCoupon.mutate()} hitSlop={10} accessibilityLabel={t('cart.remove')}>
                    <X size={18} color={colors.muted} />
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <TextInput
                    value={code}
                    onChangeText={(v) => setCode(v.toUpperCase())}
                    placeholder={t('cart.promoPlaceholder')}
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    onSubmitEditing={onApply}
                    className="h-11 flex-1 rounded-xl bg-surface-muted px-3.5 text-base text-ink dark:bg-surface-dark-muted dark:text-gray-100"
                  />
                  <Button title={t('cart.apply')} size="sm" fullWidth={false} className="h-11" loading={applyCoupon.isPending} onPress={onApply} />
                </View>
              )}
              {couponError || data.couponError ? (
                <Text className="mt-2 text-sm text-danger">{couponError ?? data.couponError}</Text>
              ) : null}
            </View>

            <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <OrderSummary {...data} />
            </View>
          </View>
        }
        contentContainerClassName="pb-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <View className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-surface-dark">
        <Button
          title={`${t('cart.checkout')} · ${formatPrice(data.total, lang)}`}
          size="lg"
          disabled={hasUnavailable}
          onPress={() => navigation.navigate('Checkout')}
        />
      </View>
    </Screen>
  );
}
