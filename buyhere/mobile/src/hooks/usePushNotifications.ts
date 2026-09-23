import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { meApi } from '@/api/endpoints';
import { useIsLoggedIn } from '@/store/auth';
import { navigationRef } from '@/navigation/navigationRef';
import { qk } from './queries';

// Affiche les notifications reçues même quand l'app est au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Demande la permission, récupère le token Expo et l'enregistre côté API.
 * Renvoie null si indisponible (simulateur, permission refusée, Expo Go
 * Android — les push distants exigent un development build depuis le SDK 53).
 */
async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    // Canal requis avant la demande de permission (Android 13+).
    await Notifications.setNotificationChannelAsync('default', {
      name: 'BuyHere',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B00',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch (err) {
    console.warn('[push] token indisponible :', err);
    return null;
  }
}

/** Enregistre l'appareil une fois connecté et ouvre la commande au tap d'une notification. */
export function usePushNotifications() {
  const loggedIn = useIsLoggedIn();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loggedIn) return;
    registerForPush()
      .then((token) => (token ? meApi.setPushToken(token) : undefined))
      .catch(() => undefined);
  }, [loggedIn]);

  useEffect(() => {
    // Notification reçue app ouverte : rafraîchit le badge et la liste.
    const received = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: qk.unread });
      qc.invalidateQueries({ queryKey: qk.notifications });
      qc.invalidateQueries({ queryKey: ['orders'] });
    });
    // Tap sur une notification : navigue vers la commande concernée.
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const orderId = response.notification.request.content.data?.orderId;
      if (typeof orderId === 'string' && navigationRef.isReady()) {
        navigationRef.navigate('OrderDetail', { orderId });
      } else if (navigationRef.isReady()) {
        navigationRef.navigate('Notifications');
      }
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [qc]);
}
