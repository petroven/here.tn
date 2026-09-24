import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, User } from '@/api/types';

/**
 * Session utilisateur. Le jeton est conservé dans le trousseau sécurisé
 * (Keychain iOS / Keystore Android), jamais en AsyncStorage.
 * L'API web délivre un seul JWT valable 7 jours (pas de refresh token) :
 * à son expiration, l'utilisateur se reconnecte.
 * Clés « bh.web.* » : les sessions de l'ancienne API mobile sont ignorées.
 */
const KEYS = { access: 'bh.web.accessToken', user: 'bh.web.user' } as const;

type AuthState = {
  user: User | null;
  accessToken: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AuthResponse) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const [accessToken, rawUser] = await Promise.all([
        SecureStore.getItemAsync(KEYS.access),
        SecureStore.getItemAsync(KEYS.user),
      ]);
      set({ accessToken, user: rawUser ? (JSON.parse(rawUser) as User) : null });
    } finally {
      set({ hydrated: true });
    }
  },

  setSession: async ({ user, accessToken }) => {
    set({ user, accessToken });
    await Promise.all([
      SecureStore.setItemAsync(KEYS.access, accessToken),
      SecureStore.setItemAsync(KEYS.user, JSON.stringify(user)),
    ]);
  },

  setUser: async (user) => {
    set({ user });
    await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
  },

  clearSession: async () => {
    set({ user: null, accessToken: null });
    await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
  },
}));

export const useIsLoggedIn = () => useAuthStore((s) => !!s.accessToken && !!s.user);
