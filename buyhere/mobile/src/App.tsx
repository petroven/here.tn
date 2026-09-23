import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { reloadAppAsync } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { ApiError } from '@/api/client';
import { initI18n, ensureDirection } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { RootNavigator } from '@/navigation/RootNavigator';
import { AnimatedSplash } from '@/screens/AnimatedSplash';

// Garde l'écran de démarrage natif jusqu'au chargement des préférences.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Pas de nouvelle tentative sur les erreurs métier (4xx) : seulement réseau / 5xx.
      retry: (count, err) =>
        count < 2 && !(err instanceof ApiError && err.status !== undefined && err.status < 500),
    },
  },
});

/** Attend la réhydratation des préférences persistées (AsyncStorage). */
function useSettingsHydrated() {
  const [hydrated, setHydrated] = useState(useSettingsStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useSettingsStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

export default function App() {
  const settingsHydrated = useSettingsHydrated();
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const language = useSettingsStore((s) => s.language);
  const theme = useSettingsStore((s) => s.theme);
  const { colorScheme, setColorScheme } = useColorScheme();
  const [splashDone, setSplashDone] = useState(false);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // Langue + sens d'écriture : redémarre une fois si le RTL enregistré ne correspond pas.
  useEffect(() => {
    if (!settingsHydrated) return;
    initI18n(language);
    if (ensureDirection(language)) {
      reloadAppAsync().catch(() => setI18nReady(true));
      return;
    }
    setI18nReady(true);
  }, [settingsHydrated, language]);

  // Thème : Système / Clair / Sombre
  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  const ready = settingsHydrated && authHydrated && i18nReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          {ready && splashDone ? (
            <RootNavigator />
          ) : (
            <AnimatedSplash ready={ready} onFinish={() => setSplashDone(true)} />
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
