import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * URL de l'API — la même que le site web (server/, préfixe /api) : mêmes
 * comptes, produits, boutiques et commandes. Priorité : variable
 * EXPO_PUBLIC_API_URL (fichier .env, ex. https://here-tn.onrender.com/api),
 * sinon l'IP de la machine de dev détectée par Expo (fonctionne sur un
 * téléphone réel via Expo Go), sinon localhost / 10.0.2.2 (émulateur Android).
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri; // ex. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:5000/api`;

  return Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';
}

export const API_URL = resolveApiUrl();

/** Origine du serveur (sans /api) : les images envoyées par les vendeurs sont servies en /uploads/... */
export const API_ORIGIN = API_URL.replace(/\/api$/, '');

/**
 * Site web (pages d'aide et conditions). En production, l'API et le site sont
 * servis par le même service : l'origine de l'API suffit. EXPO_PUBLIC_WEB_URL
 * permet de pointer ailleurs (ex. le serveur Vite en développement).
 */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL || API_ORIGIN).replace(/\/$/, '');

/** Schéma de retour après paiement Konnect / Flouci (cf. app.json "scheme"). */
export const PAYMENT_RETURN_URL = 'buyhere://payment-return';

/** Même contact que le pied de page du site. */
export const SUPPORT_PHONE = '+216 27 991 953';
