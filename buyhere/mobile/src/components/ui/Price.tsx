import { Text, View } from 'react-native';
import { formatPrice } from '@/utils/format';
import { useSettingsStore } from '@/store/settings';

type Props = {
  value: number; // millimes
  compareAt?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

const sizes = {
  sm: { main: 'text-sm', old: 'text-xs' },
  md: { main: 'text-base', old: 'text-xs' },
  lg: { main: 'text-xl', old: 'text-sm' },
  xl: { main: 'text-2xl', old: 'text-base' },
};

/** Prix en TND (« 49,900 DT »), avec l'ancien prix barré en cas de promotion. */
export function Price({ value, compareAt, size = 'md', className = '' }: Props) {
  const lang = useSettingsStore((s) => s.language);
  const onSale = !!compareAt && compareAt > value;
  const s = sizes[size];

  return (
    <View className={`flex-row flex-wrap items-baseline gap-x-1.5 ${className}`}>
      <Text className={`font-bold ${s.main} ${onSale ? 'text-primary' : 'text-ink dark:text-gray-100'}`}>
        {formatPrice(value, lang)}
      </Text>
      {onSale ? (
        <Text className={`${s.old} text-ink-subtle line-through`}>{formatPrice(compareAt, lang)}</Text>
      ) : null}
    </View>
  );
}
