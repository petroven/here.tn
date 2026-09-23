import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '@/api/types';

export type ThemePreference = 'system' | 'light' | 'dark';

type SettingsState = {
  language: Language;
  theme: ThemePreference;
  onboardingDone: boolean;
  recentSearches: string[];
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  completeOnboarding: () => void;
  addRecentSearch: (q: string) => void;
  clearRecentSearches: () => void;
};

/** Préférences non sensibles, persistées en AsyncStorage. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'fr',
      theme: 'system',
      onboardingDone: false,
      recentSearches: [],
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      completeOnboarding: () => set({ onboardingDone: true }),
      addRecentSearch: (q) =>
        set((s) => ({
          recentSearches: [q, ...s.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8),
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    { name: 'bh.settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
