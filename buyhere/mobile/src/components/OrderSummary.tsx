import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settings';
import { formatPrice } from '@/utils/format';

type Props = {
  subtotal: number;
  discount: number;
  /** null : dépend de l'adresse, calculé au moment du paiement. */
  shippingFee: number | null;
  total: number;
  couponCode?: string | null;
  /** Part réglée avec le solde du portefeuille (déjà déduite de total). */
  walletUsed?: number;
  /** Timbre fiscal (déjà inclus dans total). */
  stampDuty?: number;
  /** TVA comprise dans le total (prix TTC) ; null/absent : non affichée. */
  vat?: number | null;
  /** Nombre de timbres (un par boutique / facture), pour le libellé. */
  stampCount?: number;
};

const Row = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <View className="flex-row justify-between py-1">
    <Text className="text-sm text-ink-muted dark:text-gray-400">{label}</Text>
    <Text className={`text-sm font-medium ${accent ? 'text-success' : 'text-ink dark:text-gray-100'}`}>{value}</Text>
  </View>
);

/** Bloc de totaux (panier, checkout, détail de commande). */
export function OrderSummary({
  subtotal,
  discount,
  shippingFee,
  total,
  couponCode,
  walletUsed = 0,
  stampDuty = 0,
  vat = null,
  stampCount = 1,
}: Props) {
  const { t } = useTranslation();
  const lang = useSettingsStore((s) => s.language);

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
        value={
          shippingFee === null
            ? t('cart.shippingAtCheckout')
            : shippingFee === 0
              ? t('cart.free')
              : formatPrice(shippingFee, lang)
        }
        accent={shippingFee === 0}
      />
      {walletUsed > 0 ? <Row label={t('cart.walletUsed')} value={formatPrice(-walletUsed, lang)} accent /> : null}
      {stampDuty > 0 ? (
        <Row
          label={stampCount > 1 ? t('cart.stampDutyMulti', { count: stampCount }) : t('cart.stampDuty')}
          value={formatPrice(stampDuty, lang)}
        />
      ) : null}
      <View className="mt-2 flex-row justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
        <Text className="text-base font-bold text-ink dark:text-gray-100">
          {stampDuty > 0 || vat !== null ? t('cart.totalTtc') : t('cart.total')}
        </Text>
        <Text className="text-lg font-extrabold text-primary">{formatPrice(total, lang)}</Text>
      </View>
      {vat !== null ? (
        <View className="flex-row justify-between pt-1">
          <Text className="text-xs text-ink-subtle">{t('cart.vatIncluded')}</Text>
          <Text className="text-xs text-ink-subtle">{formatPrice(vat, lang)}</Text>
        </View>
      ) : null}
    </View>
  );
}
