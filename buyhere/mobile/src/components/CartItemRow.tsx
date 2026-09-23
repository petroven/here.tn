import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react-native';
import type { CartLine } from '@/api/types';
import { useTheme } from '@/theme/useTheme';
import { Price } from './ui/Price';
import { QuantityStepper } from './ui/QuantityStepper';

type Props = {
  item: CartLine;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  busy?: boolean;
};

/** Ligne du panier : vignette, variante, prix, quantité et suppression. */
export function CartItemRow({ item, onQuantity, onRemove, busy }: Props) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const variant = [item.size, item.color].filter(Boolean).join(' · ');

  return (
    <View className={`mx-4 mb-3 flex-row gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-surface-dark-card ${busy ? 'opacity-60' : ''}`}>
      <Pressable onPress={() => navigation.navigate('ProductDetail', { idOrSlug: item.slug })}>
        <Image
          source={item.imageUrl ? { uri: item.imageUrl } : undefined}
          style={{ width: 88, height: 96, borderRadius: 14 }}
          contentFit="cover"
          transition={150}
        />
      </Pressable>
      <View className="flex-1 justify-between">
        <View>
          <View className="flex-row items-start gap-2">
            <Text className="flex-1 text-sm font-medium leading-5 text-ink dark:text-gray-100" numberOfLines={2}>
              {item.name}
            </Text>
            <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('cart.remove')}>
              <Trash2 size={18} color={colors.muted} />
            </Pressable>
          </View>
          {variant ? <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">{variant}</Text> : null}
          {!item.isAvailable ? <Text className="mt-0.5 text-xs font-semibold text-danger">{t('cart.unavailable')}</Text> : null}
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Price value={item.unitPrice} size="sm" />
          <QuantityStepper
            compact
            value={item.quantity}
            max={Math.max(1, Math.min(10, item.available))}
            onChange={onQuantity}
            disabled={busy}
          />
        </View>
      </View>
    </View>
  );
}
