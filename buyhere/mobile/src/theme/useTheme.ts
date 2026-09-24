import { useColorScheme } from 'nativewind';

/** Terre de Nabeul — couleur de marque du site web. */
export const BRAND = '#C4532C';

const light = {
  primary: BRAND,
  text: '#1E1B18',
  muted: '#8C8378',
  subtle: '#B8B0A3',
  background: '#FBF8F3',
  card: '#FFFFFF',
  surface: '#F4ECDF',
  border: '#E2D9CB',
  skeleton: '#EFE7DA',
  star: '#F5A623',
  danger: '#DC2626',
  success: '#16A34A',
};

const dark: typeof light = {
  primary: '#D87350',
  text: '#F4ECDF',
  muted: '#B8B0A3',
  subtle: '#8C8378',
  background: '#141210',
  card: '#1E1B18',
  surface: '#2A2622',
  border: '#38322C',
  skeleton: '#2F2A25',
  star: '#F5A623',
  danger: '#F87171',
  success: '#4ADE80',
};

export type ThemeColors = typeof light;

/**
 * Couleurs du thème courant en hexadécimal, pour les props qui n'acceptent
 * pas de className (icônes Lucide, StatusBar, navigation, placeholders...).
 */
export function useTheme() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return { isDark, colors: isDark ? dark : light };
}
