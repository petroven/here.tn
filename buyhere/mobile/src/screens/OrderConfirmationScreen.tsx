import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOrder } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settings';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

/** Confirmation de commande avec animation de validation. */
export function OrderConfirmationScreen({ route, navigation }: RootScreenProps<'OrderConfirmation'>) {
  const { t } = useTranslation();
  const lang = useSettingsStore((s) => s.language);
  const { data: order } = useOrder(route.params.orderId);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 120 });
  }, [scale]);

  const badge = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View style={badge} className="mb-8 h-28 w-28 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
            <Check size={44} color="#fff" strokeWidth={3} />
          </View>
        </Animated.View>

        <Text className="text-center text-2xl font-extrabold text-ink dark:text-gray-100">{t('confirmation.title')}</Text>
        {order ? (
          <>
            <Text className="mt-3 text-center text-base leading-6 text-ink-muted dark:text-gray-400">
              {t('confirmation.text', { number: order.number })}
            </Text>
            <Text className="mt-2 text-center text-base font-semibold text-ink dark:text-gray-200">
              {order.paymentStatus === 'PAID'
                ? t('confirmation.paidText')
                : order.paymentMethod === 'CASH_ON_DELIVERY'
                  ? t('confirmation.codText', { amount: formatPrice(order.total, lang) })
                  : t('checkout.paymentPending')}
            </Text>
          </>
        ) : (
          <Skeleton className="mt-4 h-12 w-64" />
        )}
      </View>

      <View className="gap-3 px-6 pb-6">
        <Button
          title={t('confirmation.track')}
          size="lg"
          onPress={() => navigation.replace('OrderDetail', { orderId: route.params.orderId })}
        />
        <Button
          title={t('confirmation.continue')}
          variant="outline"
          size="lg"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Home' } }] })}
        />
      </View>
    </SafeAreaView>
  );
}
