import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settings';
import { formatPrice } from '@/utils/format';

type Props = {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponCode?: string | null;
};

/** Bloc de totaux (panier, checkout, détail de commande). */
export function OrderSummary({ subtotal, discount, shippingFee, total, couponCode }: Props) {
  const { t } = useTranslation();
  const lang = useSettingsStore((s) => s.language);

  const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-ink-muted dark:text-gray-400">{label}</Text>
      <Text className={`text-sm font-medium ${accent ? 'text-success' : 'text-ink dark:text-gray-100'}`}>{value}</Text>
    </View>
  );

  return (
    <View>
      <Row label={t('cart.subtotal')} value={formatPrice(subtotal, lang)} />
      {discount > 0 ? (
        <Row
          label={`${t('cart.discount')}${couponCode ? ` (${couponCode})` : ''}`}
          value={formatPrice(-discount, lang)}
          accent
        />
      ) : null}
      <Row
        label={t('cart.shipping')}
        value={shippingFee === 0 ? t('cart.free') : formatPrice(shippingFee, lang)}
        accent={shippingFee === 0}
      />
      <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
        <Text className="text-base font-bold text-ink dark:text-gray-100">{t('cart.total')}</Text>
        <Text className="text-lg font-extrabold text-primary">{formatPrice(total, lang)}</Text>
      </View>
    </View>
  );
}
