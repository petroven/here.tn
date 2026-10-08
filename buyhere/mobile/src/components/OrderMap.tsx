import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Clock, ExternalLink } from 'lucide-react-native';
import type { MapPoint, OrderMap as OrderMapData } from '@/api/types';
import { formatRoute, LiveMap, type MapMarker, type RouteInfo } from '@/components/map/LiveMap';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';

function openInMaps(p: MapPoint) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`);
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text className="text-xs font-medium text-ink dark:text-gray-200" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Suivi de commande sur la carte : boutique, adresse de livraison et livreur
 * en direct, avec l'itinéraire routier et l'heure d'arrivée estimée.
 */
export function OrderMap({ map }: { map: OrderMapData }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const markers: MapMarker[] = [
    ...(map.pickup ? [{ id: 'pickup', kind: 'pickup' as const, ...map.pickup, label: map.storeName ?? '' }] : []),
    ...(map.dropoff
      ? [{ id: 'dropoff', kind: 'dropoff' as const, ...map.dropoff, label: t('orders.map.dropoff') }]
      : []),
    ...(map.courier ? [{ id: 'courier', kind: 'courier' as const, ...map.courier }] : []),
  ];
  // Livreur en route : son trajet jusqu'à vous ; sinon, de la boutique jusqu'à vous.
  const from = map.courier ?? map.pickup;
  const route = from && map.dropoff ? [from, map.dropoff] : [];

  const approx = map.dropoff?.precision && map.dropoff.precision !== 'adresse';
  const target = map.courier ?? map.dropoff ?? map.pickup;
  // Heure d'arrivée figée à la réception de l'itinéraire (relu quand le livreur bouge).
  const [arrivalAt, setArrivalAt] = useState<number | null>(null);
  const onRoute = (info: RouteInfo | null) => {
    setRouteInfo(info);
    setArrivalAt(info ? Date.now() + info.durationMin * 60_000 : null);
  };
  const arrival =
    map.courier && arrivalAt
      ? new Date(arrivalAt).toLocaleTimeString(lang === 'ar' ? 'ar-TN' : 'fr-TN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  return (
    <View>
      {map.courier && routeInfo ? (
        <View className="mb-3 flex-row items-center gap-3 rounded-2xl bg-primary-50 p-3 dark:bg-primary-900/30">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Clock size={18} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-ink-muted dark:text-gray-300">{t('orders.map.arrival')}</Text>
            <Text className="text-lg font-extrabold text-ink dark:text-gray-100">
              {arrival} <Text className="text-sm font-semibold text-ink-muted">· {formatRoute(routeInfo, lang)}</Text>
            </Text>
          </View>
        </View>
      ) : null}

      <LiveMap
        title={t('orders.map.title')}
        markers={markers}
        route={route}
        height={260}
        followCourier={!!map.courier}
        onRoute={onRoute}
      />

      <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1.5">
        {map.pickup ? <Legend color="#1E1B18" label={map.storeName || t('orders.map.store')} /> : null}
        {map.dropoff ? <Legend color="#16A34A" label={t('orders.map.dropoff')} /> : null}
        {map.courier ? <Legend color={colors.primary} label={t('orders.map.courier')} /> : null}
      </View>
      <Text className="mt-2 text-xs leading-5 text-ink-muted dark:text-gray-400">
        {approx
          ? t('orders.map.approx', { zone: t(`orders.map.zone.${map.dropoff?.precision}`) })
          : map.dropoff
            ? t('orders.map.estimated')
            : t('orders.map.locating')}
      </Text>
      {target ? (
        <Pressable
          onPress={() => openInMaps(target)}
          className="mt-2 flex-row items-center gap-1.5 self-start py-1"
          accessibilityRole="link"
        >
          <ExternalLink size={14} color={colors.primary} />
          <Text className="text-sm font-semibold text-primary">{t('orders.map.openMaps')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
