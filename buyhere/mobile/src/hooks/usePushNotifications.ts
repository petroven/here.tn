import { useEffect } from 'react';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { meApi } from '@/api/endpoints';
import { useIsLoggedIn } from '@/store/auth';
import { navigationRef } from '@/navigation/navigationRef';
import { qk } from './queries';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Les notifications push ne fonctionnent pas dans Expo Go (Android : erreur
 * levée depuis le SDK 53, avertissement dès l'import du module). Le module
 * n'est donc chargé que dans un development build ou une version store.
 */
const Notifications: NotificationsModule | null = isRunningInExpoGo()
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-notifications') as NotificationsModule);

// Affiche les notifications reçues même quand l'app est au premier plan.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Demande la permission, récupère le token Expo et l'enregistre côté API.
 * Renvoie null si indisponible (Expo Go, simulateur, permission refusée).
 */
async function registerForPush(N: NotificationsModule): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    // Canal requis avant la demande de permission (Android 13+).
    await N.setNotificationChannelAsync('default', {
      name: 'BuyHere',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#C4532C',
    });
  }

  const current = await N.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await N.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  try {
    const { data } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch {
    return null; // hors ligne ou projet EAS non configuré : l'app fonctionne sans push
  }
}

/** Enregistre l'appareil une fois connecté et ouvre la commande au tap d'une notification. */
export function usePushNotifications() {
  const loggedIn = useIsLoggedIn();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loggedIn || !Notifications) return;
    registerForPush(Notifications)
      .then((token) => (token ? meApi.setPushToken(token) : undefined))
      .catch(() => undefined);
  }, [loggedIn]);

  useEffect(() => {
    if (!Notifications) return;
    // Notification reçue app ouverte : rafraîchit le badge et la liste.
    const received = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: qk.unread });
      qc.invalidateQueries({ queryKey: qk.notifications });
      qc.invalidateQueries({ queryKey: ['orders'] });
    });
    // Tap sur une notification : navigue vers la commande concernée.
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!navigationRef.isReady()) return;
      const orderId = response.notification.request.content.data?.orderId;
      if (typeof orderId === 'string') navigationRef.navigate('OrderDetail', { orderId });
      else navigationRef.navigate('Notifications');
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [qc]);
}
