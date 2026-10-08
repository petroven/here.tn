import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { TicketPercent } from 'lucide-react-native';
import { cartApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { qk } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Cible des liens promotionnels (buyhere://promotion/ETE2026) : le code est
 * mémorisé dans le panier, puis revalidé au récapitulatif comme un code
 * saisi à la main.
 */
export function PromotionScreen({ route, navigation }: RootScreenProps<'Promotion'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const code = route.params.code.trim().toUpperCase();

  useEffect(() => {
    cartApi
      .rememberCoupon(code)
      .then(() => qc.invalidateQueries({ queryKey: qk.cart }))
      .catch(() => undefined);
  }, [code, qc]);

  return (
    <Screen>
      <Header title={t('promotion.title')} />
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-5 h-20 w-20 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
          <TicketPercent size={38} color={colors.primary} />
        </View>
        <Text className="text-center text-sm text-ink-muted dark:text-gray-400">{t('promotion.yourCode')}</Text>
        <Text className="mt-1 text-3xl font-black tracking-widest text-ink dark:text-gray-100">{code}</Text>
        <Text className="mt-3 text-center text-sm leading-5 text-ink-muted dark:text-gray-400">{t('promotion.saved')}</Text>
        <View className="mt-8 w-full gap-3">
          <Button
            title={t('promotion.shopDeals')}
            size="lg"
            onPress={() => navigation.replace('CategoryProducts', { title: t('promotion.deals'), filters: { onSale: true } })}
          />
          <Button title={t('promotion.goToCart')} variant="outline" onPress={() => navigation.navigate('Main', { screen: 'Cart' })} />
        </View>
      </View>
    </Screen>
  );
}
