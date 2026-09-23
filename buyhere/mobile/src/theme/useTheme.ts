import { useColorScheme } from 'nativewind';

export const BRAND = '#FF6B00';

const light = {
  primary: BRAND,
  text: '#1F2937',
  muted: '#6B7280',
  subtle: '#9CA3AF',
  background: '#FFFFFF',
  card: '#FFFFFF',
  surface: '#F5F6F8',
  border: '#E5E7EB',
  skeleton: '#E9EBEF',
  star: '#F5A623',
  danger: '#DC2626',
  success: '#16A34A',
};

const dark: typeof light = {
  primary: BRAND,
  text: '#F3F4F6',
  muted: '#9CA3AF',
  subtle: '#6B7280',
  background: '#0F1115',
  card: '#1A1D23',
  surface: '#23272F',
  border: '#2D323B',
  skeleton: '#2A2E36',
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
