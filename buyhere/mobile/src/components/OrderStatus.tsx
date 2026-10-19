import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, CircleX, RotateCcw } from 'lucide-react-native';
import type { Order, OrderStatus } from '@/api/types';
import { useSettingsStore } from '@/store/settings';
import { formatDateTime } from '@/utils/format';
import { useTheme } from '@/theme/useTheme';

const STATUS_STYLES: Record<OrderStatus, { box: string; text: string }> = {
  PENDING: { box: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  CONFIRMED: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  PREPARING: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  SHIPPED: { box: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-700 dark:text-primary-300' },
  OUT_FOR_DELIVERY: { box: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-700 dark:text-primary-300' },
  DELIVERED: { box: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  RETURN_REQUESTED: { box: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
  REFUNDED: { box: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  CANCELLED: { box: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
};

/** Badge coloré du statut de commande. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  const style = STATUS_STYLES[status];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${style.box}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{t(`orders.status.${status}`)}</Text>
    </View>
  );
}

const STEPS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

/**
 * Suivi de livraison :
 *
 *   ✓ Commande passée
 *   ✓ Confirmée
 *   ✓ Préparation
 *   ✓ Expédiée
 *   ● En livraison      ← étape en cours
 *   ○ Livrée
 *
 * Chaque étape franchie affiche sa date (historique du serveur). Une
 * commande retournée/remboursée garde le parcours complet, précédé d'un
 * bandeau ; une commande annulée n'affiche que le bandeau.
 */
export function OrderTimeline({ order }: { order: Order }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);

  if (order.status === 'CANCELLED') {
    const at = order.history.find((h) => h.status === 'CANCELLED')?.at;
    return (
      <View className="flex-row items-center gap-3 rounded-2xl bg-gray-100 p-4 dark:bg-surface-dark-muted">
        <CircleX size={24} color={colors.danger} />
        <View>
          <Text className="font-semibold text-ink dark:text-gray-100">{t('orders.cancelled')}</Text>
          {at ? <Text className="text-xs text-ink-muted">{formatDateTime(at, lang)}</Text> : null}
        </View>
      </View>
    );
  }

  const afterDelivery = order.status === 'RETURN_REQUESTED' || order.status === 'REFUNDED';
  const currentIndex = afterDelivery ? STEPS.length - 1 : STEPS.indexOf(order.status);
  const returnAt = order.history.filter((h) => h.status === order.status).at(-1)?.at;

  return (
    <View>
      {afterDelivery ? (
        <View className="mb-4 flex-row items-center gap-3 rounded-2xl bg-orange-50 p-3 dark:bg-orange-900/20">
          <RotateCcw size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-semibold text-ink dark:text-gray-100">{t(`orders.status.${order.status}`)}</Text>
            <Text className="text-xs text-ink-muted dark:text-gray-400">
              {order.status === 'REFUNDED' ? t('orders.refundedText') : t('orders.returnText')}
            </Text>
            {returnAt ? <Text className="mt-0.5 text-xs text-ink-subtle">{formatDateTime(returnAt, lang)}</Text> : null}
          </View>
        </View>
      ) : null}

      {STEPS.map((step, i) => {
        // La dernière étape atteinte est « en cours », sauf la livraison
        // elle-même qui clôt le parcours.
        const done = i < currentIndex || (i === currentIndex && step === 'DELIVERED');
        const current = i === currentIndex && step !== 'DELIVERED';
        const at = order.history.find((h) => h.status === step)?.at;
        const isLast = i === STEPS.length - 1;
        return (
          <View
            key={step}
            className="flex-row gap-3"
            accessible
            accessibilityLabel={`${t(`orders.status.${step}`)} : ${done ? t('orders.stepDone') : current ? t('orders.stepCurrent') : t('orders.stepUpcoming')}`}
          >
            <View className="items-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${
                  done
                    ? 'bg-primary'
                    : current
                      ? 'border-2 border-primary bg-white dark:bg-surface-dark-card'
                      : 'border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-surface-dark-card'
                }`}
              >
                {done ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                {current ? <View className="h-3 w-3 rounded-full bg-primary" /> : null}
              </View>
              {!isLast ? (
                <View className={`w-0.5 flex-1 ${i < currentIndex ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} style={{ minHeight: 22 }} />
              ) : null}
            </View>
            <View className="flex-1 pb-4 pt-1">
              <Text
                className={`${current ? 'font-bold text-primary' : 'font-semibold'} ${
                  done ? 'text-ink dark:text-gray-100' : current ? '' : 'text-ink-subtle'
                }`}
              >
                {t(`orders.step.${step}`)}
              </Text>
              {at && (done || current) ? <Text className="mt-0.5 text-xs text-ink-muted">{formatDateTime(at, lang)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
