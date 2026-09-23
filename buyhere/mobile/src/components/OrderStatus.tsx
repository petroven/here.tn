import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, CircleX, Clock, PackageCheck, Truck, type LucideIcon } from 'lucide-react-native';
import type { Order, OrderStatus } from '@/api/types';
import { useSettingsStore } from '@/store/settings';
import { formatDateTime } from '@/utils/format';
import { useTheme } from '@/theme/useTheme';

const STATUS_STYLES: Record<OrderStatus, { box: string; text: string }> = {
  PENDING: { box: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  CONFIRMED: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  SHIPPED: { box: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-700 dark:text-primary-300' },
  DELIVERED: { box: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
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

const STEPS: { status: OrderStatus; icon: LucideIcon }[] = [
  { status: 'PENDING', icon: Clock },
  { status: 'CONFIRMED', icon: Check },
  { status: 'SHIPPED', icon: Truck },
  { status: 'DELIVERED', icon: PackageCheck },
];

/**
 * Timeline de suivi : En attente → Confirmée → Expédiée → Livrée.
 * Chaque étape atteinte affiche sa date (issue de l'historique de statuts).
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

  const reachedIndex = STEPS.findIndex((s) => s.status === order.status);

  return (
    <View>
      {STEPS.map((step, i) => {
        const reached = i <= reachedIndex;
        const at = order.history.find((h) => h.status === step.status)?.at;
        const Icon = step.icon;
        const isLast = i === STEPS.length - 1;
        return (
          <View key={step.status} className="flex-row gap-3">
            <View className="items-center">
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  reached ? 'bg-primary' : 'bg-gray-200 dark:bg-surface-dark-muted'
                }`}
              >
                <Icon size={18} color={reached ? '#fff' : colors.subtle} />
              </View>
              {!isLast ? (
                <View className={`w-0.5 flex-1 ${i < reachedIndex ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} style={{ minHeight: 26 }} />
              ) : null}
            </View>
            <View className="flex-1 pb-5 pt-1.5">
              <Text className={`font-semibold ${reached ? 'text-ink dark:text-gray-100' : 'text-ink-subtle'}`}>
                {t(`orders.status.${step.status}`)}
              </Text>
              {at && reached ? <Text className="mt-0.5 text-xs text-ink-muted">{formatDateTime(at, lang)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
