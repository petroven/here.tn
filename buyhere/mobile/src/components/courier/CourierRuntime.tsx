import { useCallback, useEffect, useState } from 'react';
import { Modal, Text, Vibration, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Bike, MapPin, Navigation, Wallet } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { courierApi, type CourseOffer } from '@/api/courier';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import {
  courierKeys,
  useAppActive,
  useCourierLocation,
  useCourierStats,
  useIsCourier,
  useRefreshCourier,
} from '@/hooks/useCourier';
import { navigationRef } from '@/navigation/navigationRef';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';

// Comme le site : position envoyée au plus toutes les 30 s pendant le service.
const POSITION_EVERY_MS = 30_000;
// L'offre expire en 60 s par défaut côté serveur : un sondage de 5 s laisse le temps de répondre.
const OFFER_POLL_MS = 5_000;

/** Suivi GPS tant que le livreur n'est pas « hors ligne » et que l'app est ouverte. */
function useCourierPosition(onDuty: boolean) {
  const setLocation = useCourierLocation((s) => s.set);

  useEffect(() => {
    if (!onDuty) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    let lastSent = 0;

    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setLocation({ permission: granted ? 'granted' : 'denied' });
      if (!granted) return;

      const send = ({ coords }: Location.LocationObject) => {
        // Position locale à chaque point (carte en direct) ; serveur au plus toutes les 30 s.
        setLocation({ coords: { latitude: coords.latitude, longitude: coords.longitude } });
        const now = Date.now();
        if (now - lastSent < POSITION_EVERY_MS) return; // iOS ignore timeInterval
        lastSent = now;
        courierApi
          .sendPosition(coords.latitude, coords.longitude)
          .then(() => setLocation({ lastSentAt: now }))
          .catch(() => undefined); // réessayé au prochain point
      };

      const sub = await Location.watchPositionAsync(
        // Points fréquents pour la carte en direct ; le serveur reste limité à 1 envoi / 30 s.
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 15 },
        send,
      );
      if (cancelled) sub.remove();
      else subscription = sub;
    })().catch(() => setLocation({ permission: 'denied' }));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [onDuty, setLocation]);
}

function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

/** Fenêtre « Nouvelle course » avec compte à rebours (cascade du serveur). */
function OfferModal({ offer, onClose }: { offer: CourseOffer; onClose: (notificationId: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const refresh = useRefreshCourier();
  const [left, setLeft] = useState(() => secondsLeft(offer.expiresAt));
  const [busy, setBusy] = useState<'accept' | 'refuse' | null>(null);

  useEffect(() => {
    Vibration.vibrate([0, 300, 150, 300]);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const s = secondsLeft(offer.expiresAt);
      setLeft(s);
      if (s === 0) onClose(offer.notificationId);
    }, 1000);
    return () => clearInterval(id);
  }, [offer, onClose]);

  const respond = async (accept: boolean) => {
    setBusy(accept ? 'accept' : 'refuse');
    try {
      if (accept) {
        await courierApi.acceptOffer(offer.notificationId);
        toast(t('courier.accepted'));
        if (navigationRef.isReady()) navigationRef.navigate('CourierCourse', { courseId: offer.courseId });
      } else {
        await courierApi.refuseOffer(offer.notificationId);
      }
    } catch (err) {
      toast(errorMessage(err, t('common.networkError')));
    } finally {
      setBusy(null);
      refresh();
      onClose(offer.notificationId);
    }
  };

  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => respond(false)}>
      <View className="flex-1 items-center justify-center bg-black/70 p-5">
        <View className="w-full max-w-sm items-center rounded-3xl bg-white p-6 dark:bg-surface-dark-card">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/40">
            <Bike size={30} color={colors.primary} />
          </View>
          <Text className="mt-3 text-lg font-extrabold text-ink dark:text-gray-100">{t('courier.offerTitle')}</Text>
          <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">{t('courier.offerHint')}</Text>
          <Text
            className="mt-3 text-5xl font-extrabold text-primary"
            accessibilityLabel={t('courier.secondsLeft', { count: left })}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {left}s
          </Text>

          <View className="mt-4 w-full gap-2 rounded-2xl bg-surface-page p-4 dark:bg-surface-dark-muted">
            <View className="flex-row items-start gap-2">
              <MapPin size={15} color={colors.primary} />
              <Text className="flex-1 text-sm text-ink dark:text-gray-200">
                <Text className="font-bold">{t('courier.pickup')} : </Text>
                {offer.pickupAddress || t('courier.noAddress')}
              </Text>
            </View>
            <View className="flex-row items-start gap-2">
              <MapPin size={15} color={colors.success} />
              <Text className="flex-1 text-sm text-ink dark:text-gray-200">
                <Text className="font-bold">{t('courier.dropoff')} : </Text>
                {offer.dropoffAddress || t('courier.noAddress')}
              </Text>
            </View>
            <View className="mt-1 flex-row gap-5">
              <View className="flex-row items-center gap-1.5">
                <Navigation size={14} color={colors.subtle} />
                <Text className="text-sm font-bold text-ink dark:text-gray-100">
                  {offer.distanceKm != null ? `${offer.distanceKm.toFixed(1)} km` : t('courier.distanceUnknown')}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <Wallet size={14} color={colors.subtle} />
                <Text className="text-sm font-bold text-ink dark:text-gray-100">{formatPrice(offer.fee, lang)}</Text>
              </View>
            </View>
          </View>

          <View className="mt-5 w-full flex-row gap-2">
            <View className="flex-1">
              <Button
                title={t('courier.refuse')}
                variant="outline"
                loading={busy === 'refuse'}
                disabled={busy !== null}
                onPress={() => respond(false)}
              />
            </View>
            <View className="flex-1">
              <Button
                title={t('courier.accept')}
                loading={busy === 'accept'}
                disabled={busy !== null}
                onPress={() => respond(true)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Service de fond du livreur, monté une fois dans la navigation :
 *  - envoie la position GPS pendant le service (sans elle, le serveur ne
 *    propose aucune course : les livreurs sans position sont écartés) ;
 *  - sonde l'offre en attente (/livreur/notifications/pending) et l'affiche
 *    par-dessus n'importe quel écran. Le push « Nouvelle course » réveille
 *    l'app quand elle est en arrière-plan.
 */
export function CourierRuntime() {
  const isCourier = useIsCourier();
  const appActive = useAppActive();
  const stats = useCourierStats();
  const onDuty = isCourier && appActive && !!stats.data && stats.data.status !== 'hors_ligne';
  // Offres déjà traitées ou expirées : ne pas les rouvrir au sondage suivant.
  const [handled, setHandled] = useState<string[]>([]);
  const close = useCallback((id: string) => setHandled((h) => (h.includes(id) ? h : [...h, id])), []);

  useCourierPosition(onDuty);

  const offer = useQuery({
    queryKey: courierKeys.offer,
    queryFn: courierApi.pendingOffer,
    enabled: onDuty,
    refetchInterval: OFFER_POLL_MS,
  });

  const current = offer.data;
  if (!onDuty || !current || handled.includes(current.notificationId) || secondsLeft(current.expiresAt) === 0) {
    return null;
  }

  return <OfferModal key={current.notificationId} offer={current} onClose={close} />;
}
