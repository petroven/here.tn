import { Pressable, Text, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useTheme } from '@/theme/useTheme';

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  compact?: boolean;
};

/** Sélecteur de quantité − / + borné. */
export function QuantityStepper({ value, min = 1, max = 10, onChange, disabled, compact }: Props) {
  const { colors } = useTheme();
  const size = compact ? 'h-8 w-8' : 'h-10 w-10';
  const btn = `${size} items-center justify-center rounded-xl bg-surface-muted active:bg-gray-200 dark:bg-surface-dark-muted`;

  return (
    <View className={`flex-row items-center gap-2 ${disabled ? 'opacity-50' : ''}`}>
      <Pressable
        className={`${btn} ${value <= min ? 'opacity-40' : ''}`}
        disabled={disabled || value <= min}
        onPress={() => onChange(value - 1)}
        accessibilityRole="button"
        accessibilityLabel="Diminuer"
        hitSlop={4}
      >
        <Minus size={16} color={colors.text} />
      </Pressable>
      <Text className="min-w-[28px] text-center text-base font-semibold text-ink dark:text-gray-100">{value}</Text>
      <Pressable
        className={`${btn} ${value >= max ? 'opacity-40' : ''}`}
        disabled={disabled || value >= max}
        onPress={() => onChange(value + 1)}
        accessibilityRole="button"
        accessibilityLabel="Augmenter"
        hitSlop={4}
      >
        <Plus size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}
