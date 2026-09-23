import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, User } from '@/api/types';

/**
 * Session utilisateur. Les jetons sont conservés dans le trousseau sécurisé
 * (Keychain iOS / Keystore Android), jamais en AsyncStorage.
 */
const KEYS = { access: 'bh.accessToken', refresh: 'bh.refreshToken', user: 'bh.user' } as const;

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AuthResponse) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, rawUser] = await Promise.all([
        SecureStore.getItemAsync(KEYS.access),
        SecureStore.getItemAsync(KEYS.refresh),
        SecureStore.getItemAsync(KEYS.user),
      ]);
      set({ accessToken, refreshToken, user: rawUser ? (JSON.parse(rawUser) as User) : null });
    } finally {
      set({ hydrated: true });
    }
  },

  setSession: async ({ user, accessToken, refreshToken }) => {
    set({ user, accessToken, refreshToken });
    await Promise.all([
      SecureStore.setItemAsync(KEYS.access, accessToken),
      SecureStore.setItemAsync(KEYS.refresh, refreshToken),
      SecureStore.setItemAsync(KEYS.user, JSON.stringify(user)),
    ]);
  },

  setUser: async (user) => {
    set({ user });
    await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
  },

  clearSession: async () => {
    set({ user: null, accessToken: null, refreshToken: null });
    await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
  },
}));

export const useIsLoggedIn = () => useAuthStore((s) => !!s.accessToken && !!s.user);
