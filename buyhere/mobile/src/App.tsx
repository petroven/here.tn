import '@/theme/interop';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
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
import { BRAND_DARK } from '@/components/Logo';
import { StartupErrorBoundary } from '@/components/StartupErrorBoundary';

// Développement : les erreurs affichées dans le terminal Expo incluent leur
// pile d'appels (sinon seul le message apparaît, introuvable).
if (__DEV__) {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const err = args.find((a): a is Error => a instanceof Error);
    if (err?.stack) originalError(...args, '\nPile :', err.stack.split('\n').slice(0, 12).join('\n'));
    else originalError(...args);
  };
}

// Garde l'écran de démarrage natif jusqu'au chargement des préférences.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Pas de nouvelle tentative sur les erreurs métier (4xx) : seulement réseau / 5xx.
      retry: (count, err) => count < 2 && !(err instanceof ApiError && err.status !== undefined && err.status < 500),
    },
  },
});

/** Attend la réhydratation des préférences persistées (AsyncStorage). */
function useSettingsHydrated() {
  const [hydrated, setHydrated] = useState(useSettingsStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useSettingsStore.persist.onFinishHydration(() => setHydrated(true));
    // Rattrape une réhydratation terminée avant l'abonnement (synchro avec le store).
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  // Animation d'ouverture : au démarrage, à chaque rechargement, et au retour
  // dans l'app après un passage en arrière-plan. Affichée par-dessus la
  // navigation (l'écran en cours est conservé).
  const [splashDone, setSplashDone] = useState(false);
  const [splashKey, setSplashKey] = useState(0);
  const backgroundSince = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundSince.current = Date.now();
      } else if (state === 'active' && backgroundSince.current !== null) {
        // Au moins 1,5 s dehors : un simple dialogue système ne relance pas l'animation.
        const away = Date.now() - backgroundSince.current;
        backgroundSince.current = null;
        if (away >= 1500) {
          setSplashKey((k) => k + 1);
          setSplashDone(false);
        }
      }
    });
    return () => sub.remove();
  }, []);
  const [i18nReady, setI18nReady] = useState(false);
  // Sécurité : si le chargement des préférences, de la session ou de la langue
  // ne se termine jamais (stockage bloqué…), l'app s'ouvre quand même après 8 s.
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  // Langue + sens d'écriture : redémarre une fois si le RTL enregistré ne correspond pas.
  useEffect(() => {
    if (!settingsHydrated) return;
    initI18n(language);
    if (ensureDirection(language)) {
      reloadAppAsync().catch(() => setI18nReady(true));
      // Expo Go peut tarder à relancer : on continue sans attendre (textes déjà traduits).
      const id = setTimeout(() => setI18nReady(true), 2500);
      return () => clearTimeout(id);
    }
    // Langue initialisée (système externe i18next) : l'app peut s'afficher.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setI18nReady(true);
  }, [settingsHydrated, language]);

  // Thème : Système / Clair / Sombre
  useEffect(() => {
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  const ready = forceReady || (settingsHydrated && authHydrated && i18nReady);

  // Sécurité : si le stockage ne répond jamais, l'app s'ouvre quand même après 10 s.
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setForceReady(true), 10000);
    return () => clearTimeout(id);
  }, [ready]);

  // Limite absolue : l'animation d'ouverture ne bloque jamais l'app plus de 6 s.
  useEffect(() => {
    if (!ready || splashDone) return;
    const id = setTimeout(() => setSplashDone(true), 6000);
    return () => clearTimeout(id);
  }, [ready, splashDone, splashKey]);


  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <StartupErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            {ready ? <RootNavigator /> : null}
            {!splashDone ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: ready ? undefined : BRAND_DARK, zIndex: 1000, elevation: 1000 }]}>
                {/* Démarre seulement une fois l'écran natif masqué : sinon il en cache le début. */}
                {ready ? <AnimatedSplash key={splashKey} onFinish={() => setSplashDone(true)} /> : null}
              </View>
            ) : null}
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StartupErrorBoundary>
  );
}
