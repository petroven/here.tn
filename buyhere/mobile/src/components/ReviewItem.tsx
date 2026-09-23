import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { Review } from '@/api/types';
import { useSettingsStore } from '@/store/settings';
import { formatDate } from '@/utils/format';
import { Stars } from './ui/Rating';

/** Avis client : avatar/initiale, nom abrégé, note, date et commentaire. */
export function ReviewItem({ review }: { review: Review }) {
  const lang = useSettingsStore((s) => s.language);
  return (
    <View className="border-b border-gray-100 py-4 dark:border-gray-800">
      <View className="flex-row items-center gap-3">
        {review.avatarUrl ? (
          <Image source={{ uri: review.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
        ) : (
          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40">
            <Text className="font-bold text-primary-700 dark:text-primary-300">{review.author.charAt(0)}</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="font-semibold text-ink dark:text-gray-100">{review.author}</Text>
          <Text className="text-xs text-ink-subtle">{formatDate(review.createdAt, lang)}</Text>
        </View>
        <Stars value={review.rating} size={13} />
      </View>
      {review.comment ? (
        <Text className="mt-2 text-sm leading-5 text-ink-muted dark:text-gray-300">{review.comment}</Text>
      ) : null}
    </View>
  );
}
