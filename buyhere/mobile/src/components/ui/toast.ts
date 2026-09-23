import { Alert, Platform, ToastAndroid } from 'react-native';

/**
 * Message court de confirmation : toast natif sur Android, alerte discrète sur iOS.
 * Suffisant pour une v1 sans dépendance supplémentaire.
 */
export function toast(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert('', message);
}

/** Boîte de confirmation (action destructive). */
export function confirm(
  title: string,
  message: string,
  labels: { confirm: string; cancel: string },
  onConfirm: () => void,
  destructive = true,
) {
  Alert.alert(title, message, [
    { text: labels.cancel, style: 'cancel' },
    { text: labels.confirm, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
