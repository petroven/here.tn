import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import type { Order } from '@/api/types';
import { useSettingsStore } from '@/store/settings';
import { formatDate, formatPrice } from '@/utils/format';
import { OrderStatusBadge } from './OrderStatus';

/** Carte d'une commande dans « Mes commandes ». */
export function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const { t } = useTranslation();
  const lang = useSettingsStore((s) => s.language);
  const thumbs = order.items.slice(0, 3);
  const more = order.items.length - thumbs.length;

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-3 rounded-2xl bg-white p-4 shadow-sm active:opacity-90 dark:bg-surface-dark-card"
      accessibilityRole="button"
    >
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-bold text-ink dark:text-gray-100">{t('orders.order', { number: order.number })}</Text>
          <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">
            {t('orders.placedOn', { date: formatDate(order.createdAt, lang) })}
          </Text>
        </View>
        <OrderStatusBadge status={order.status} />
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        {thumbs.map((item) => (
          <Image
            key={item.id}
            source={item.imageUrl ? { uri: item.imageUrl } : undefined}
            style={{ width: 52, height: 52, borderRadius: 12 }}
            contentFit="cover"
          />
        ))}
        {more > 0 ? (
          <View className="h-[52px] w-[52px] items-center justify-center rounded-xl bg-surface-muted dark:bg-surface-dark-muted">
            <Text className="font-semibold text-ink-muted">+{more}</Text>
          </View>
        ) : null}
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
        <Text className="text-sm text-ink-muted dark:text-gray-400">{t('orders.items', { count: order.itemCount })}</Text>
        <Text className="font-bold text-ink dark:text-gray-100">{formatPrice(order.total, lang)}</Text>
      </View>
    </Pressable>
  );
}
