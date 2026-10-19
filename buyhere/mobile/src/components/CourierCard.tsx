import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bike, Car, Clock, MapPin, MessageCircle, Phone, Star, Truck, type LucideIcon } from 'lucide-react-native';
import type { Courier } from '@/api/types';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { timeAgo } from '@/utils/format';

const VEHICLE_ICONS: Record<NonNullable<Courier['vehicle']>, LucideIcon> = {
  moto: Bike,
  velo: Bike,
  voiture: Car,
  camionnette: Truck,
};

/** Numéro tunisien local (8 chiffres) → format international pour l'appel / WhatsApp. */
function internationalPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 8 ? `216${digits}` : digits;
}

/**
 * Livreur assigné : nom, véhicule, note, dernière position connue, distance
 * restante, estimation d'arrivée, et boutons pour le joindre. La distance et
 * l'heure d'arrivée sont des estimations (vol d'oiseau, vitesse moyenne du
 * véhicule) calculées par le serveur.
 */
export function CourierCard({ courier }: { courier: Courier }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const VehicleIcon = courier.vehicle ? VEHICLE_ICONS[courier.vehicle] : Bike;
  const phone = courier.phone ? internationalPhone(courier.phone) : null;

  return (
    <View>
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
          <VehicleIcon size={22} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink dark:text-gray-100">{courier.name}</Text>
          <View className="mt-0.5 flex-row flex-wrap items-center gap-x-2">
            {courier.vehicle ? (
              <Text className="text-xs text-ink-muted dark:text-gray-400">{t(`orders.courier.vehicle.${courier.vehicle}`)}</Text>
            ) : null}
            {courier.rating ? (
              <View className="flex-row items-center gap-0.5">
                <Star size={11} color={colors.primary} fill={colors.primary} />
                <Text className="text-xs text-ink-muted dark:text-gray-400">{courier.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <Text className="mt-3 text-sm font-semibold text-primary">
        {courier.stage === 'en_cours' ? t('orders.courier.onTheWay') : t('orders.courier.pickingUp')}
      </Text>

      <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
        {courier.distanceKm !== null ? (
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color={colors.subtle} />
            <Text className="text-sm text-ink dark:text-gray-200">{t('orders.courier.distance', { km: courier.distanceKm })}</Text>
          </View>
        ) : null}
        {courier.etaMinutes !== null ? (
          <View className="flex-row items-center gap-1">
            <Clock size={14} color={colors.subtle} />
            <Text className="text-sm text-ink dark:text-gray-200">{t('orders.courier.eta', { minutes: courier.etaMinutes })}</Text>
          </View>
        ) : null}
      </View>
      {courier.position?.updatedAt ? (
        <Text className="mt-1 text-xs text-ink-subtle">{t('orders.courier.positionUpdated', { ago: timeAgo(courier.position.updatedAt, lang) })}</Text>
      ) : (
        <Text className="mt-1 text-xs text-ink-subtle">{t('orders.courier.noPosition')}</Text>
      )}

      {phone ? (
        <View className="mt-4 flex-row gap-2">
          <Pressable
            onPress={() => Linking.openURL(`tel:+${phone}`)}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3"
            accessibilityRole="button"
            accessibilityLabel={t('orders.courier.call')}
          >
            <Phone size={16} color="#fff" />
            <Text className="font-semibold text-white">{t('orders.courier.call')}</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(`https://wa.me/${phone}`)}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-primary py-3"
            accessibilityRole="button"
            accessibilityLabel={t('orders.courier.whatsapp')}
          >
            <MessageCircle size={16} color={colors.primary} />
            <Text className="font-semibold text-primary">{t('orders.courier.whatsapp')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
