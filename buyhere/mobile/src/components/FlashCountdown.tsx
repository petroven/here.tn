import { Text, View } from 'react-native';
import { useCountdown } from '@/hooks/useCountdown';

/** Compte à rebours HH:MM:SS des offres flash. */
export function FlashCountdown({ endsAt }: { endsAt: string | null }) {
  const { hours, minutes, seconds, expired } = useCountdown(endsAt);
  if (!endsAt || expired) return null;

  const Box = ({ value }: { value: string }) => (
    <View className="min-w-[26px] items-center rounded-md bg-ink px-1 py-0.5 dark:bg-gray-100">
      <Text className="text-xs font-bold text-white dark:text-ink">{value}</Text>
    </View>
  );

  return (
    <View className="flex-row items-center gap-1" style={{ direction: 'ltr' }} accessibilityLabel={`${hours}:${minutes}:${seconds}`}>
      <Box value={hours} />
      <Text className="font-bold text-ink dark:text-gray-100">:</Text>
      <Box value={minutes} />
      <Text className="font-bold text-ink dark:text-gray-100">:</Text>
      <Box value={seconds} />
    </View>
  );
}
