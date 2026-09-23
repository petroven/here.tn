import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * URL de l'API. Priorité : variable EXPO_PUBLIC_API_URL (fichier .env),
 * sinon l'IP de la machine de dev détectée par Expo (fonctionne sur un
 * téléphone réel via Expo Go), sinon localhost / 10.0.2.2 (émulateur Android).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri; // ex. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();

/** Schéma de retour après paiement Konnect / Flouci (cf. app.json "scheme"). */
export const PAYMENT_RETURN_URL = 'buyhere://payment-return';

export const SUPPORT_PHONE = '+216 70 000 000';
