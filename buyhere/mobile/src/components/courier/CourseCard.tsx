import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Banknote, MapPin, Navigation, Wallet } from 'lucide-react-native';
import type { Course, CourseStatus } from '@/api/courier';
import { Button } from '@/components/ui/Button';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';

const STYLES: Record<CourseStatus, { box: string; text: string }> = {
  en_attente: { box: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  assignee: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  en_cours: { box: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-700 dark:text-primary-300' },
  livree: { box: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  echec: { box: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
};

export function CourseBadge({ status }: { status: CourseStatus }) {
  const { t } = useTranslation();
  const style = STYLES[status] ?? STYLES.en_attente;
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${style.box}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{t(`courier.status.${status}`)}</Text>
    </View>
  );
}

/** Itinéraire Google Maps (application ou navigateur) vers des coordonnées ou une adresse. */
export function openDirections(target: { latitude: number; longitude: number } | string | null) {
  if (!target) return;
  const destination = typeof target === 'string' ? target : `${target.latitude},${target.longitude}`;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
}

export function callPhone(phone: string | null) {
  if (phone) Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
}

/** Course dans une liste : trajet, distance, gain, et « Accepter » si elle est libre. */
export function CourseCard({
  course,
  onOpen,
  onAccept,
  accepting,
}: {
  course: Course;
  onOpen: () => void;
  onAccept?: () => void;
  accepting?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);

  return (
    <Pressable
      onPress={onOpen}
      className="mb-2.5 rounded-2xl bg-white p-4 active:opacity-80 dark:bg-surface-dark-card"
      accessibilityRole="button"
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">{course.trackingId}</Text>
          <Text className="mt-0.5 font-bold text-ink dark:text-gray-100">{course.orderNumber}</Text>
        </View>
        <CourseBadge status={course.status} />
      </View>

      <View className="mt-3 gap-1.5">
        <View className="flex-row items-start gap-2">
          <MapPin size={15} color={colors.primary} />
          <Text className="flex-1 text-sm text-ink-muted dark:text-gray-300" numberOfLines={2}>
            <Text className="font-semibold text-ink dark:text-gray-100">{course.pickup.name || t('courier.store')}</Text>
            {course.pickup.address ? ` — ${course.pickup.address}` : ''}
          </Text>
        </View>
        <View className="flex-row items-start gap-2">
          <MapPin size={15} color={colors.success} />
          <Text className="flex-1 text-sm text-ink-muted dark:text-gray-300" numberOfLines={2}>
            {course.dropoff.address || t('courier.noAddress')}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Navigation size={13} color={colors.subtle} />
            <Text className="text-xs font-bold text-ink dark:text-gray-100">
              {course.distanceKm != null ? `${course.distanceKm.toFixed(1)} km` : t('courier.distanceUnknown')}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Wallet size={13} color={colors.subtle} />
            <Text className="text-xs font-bold text-ink dark:text-gray-100">{formatPrice(course.fee, lang)}</Text>
          </View>
          {course.cashToCollect > 0 ? (
            <View className="flex-row items-center gap-1">
              <Banknote size={13} color={colors.star} />
              <Text className="text-xs font-bold text-amber-600">
                {t('courier.collectShort', { amount: formatPrice(course.cashToCollect, lang) })}
              </Text>
            </View>
          ) : null}
        </View>
        {onAccept ? (
          <Button title={t('courier.accept')} size="sm" fullWidth={false} loading={accepting} onPress={onAccept} />
        ) : null}
      </View>
    </Pressable>
  );
}
