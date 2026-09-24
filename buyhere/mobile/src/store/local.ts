import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './auth';
import type { Address } from '@/api/types';

/**
 * Données gardées sur le téléphone, comme le site web le fait dans le
 * navigateur : l'API web n'a ni panier ni carnet d'adresses côté serveur
 * (le panier du site vit dans localStorage, l'adresse est saisie à chaque
 * commande). Chaque compte a son propre espace sur l'appareil.
 */

export type StoredCartLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type StoredCart = { lines: StoredCartLine[]; couponCode: string | null };

const scope = () => useAuthStore.getState().user?.id ?? 'guest';
const key = (name: string) => `bh.web.${name}.${scope()}`;

async function read<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write<T>(name: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key(name), JSON.stringify(value));
}

export const localCart = {
  get: () => read<StoredCart>('cart', { lines: [], couponCode: null }),
  save: (cart: StoredCart) => write('cart', cart),
};

export const localAddresses = {
  get: () => read<Address[]>('addresses', []),
  save: (addresses: Address[]) => write('addresses', addresses),
};
