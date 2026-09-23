import { Pressable, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/theme/useTheme';

/** Note compacte : ★ 4,5 (12) */
export function RatingBadge({ rating, count }: { rating: number; count?: number }) {
  const { colors } = useTheme();
  if (!count) return null;
  return (
    <View className="flex-row items-center gap-1">
      <Star size={12} color={colors.star} fill={colors.star} />
      <Text className="text-xs font-medium text-ink dark:text-gray-200">{rating.toFixed(1).replace('.', ',')}</Text>
      {count !== undefined ? <Text className="text-xs text-ink-subtle">({count})</Text> : null}
    </View>
  );
}

type StarsProps = {
  value: number;
  size?: number;
  onChange?: (value: number) => void; // si fourni : sélection interactive
};

/** Rangée de 5 étoiles, en lecture seule ou sélectionnable. */
export function Stars({ value, size = 16, onChange }: StarsProps) {
  const { colors } = useTheme();
  return (
    <View className="flex-row gap-1" accessibilityRole={onChange ? 'adjustable' : 'image'} accessibilityLabel={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star size={size} color={filled ? colors.star : colors.subtle} fill={filled ? colors.star : 'transparent'} />
        );
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityLabel={`${n}/5`}>
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}
