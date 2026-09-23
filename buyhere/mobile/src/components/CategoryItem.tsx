import { Pressable, Text, View } from 'react-native';
import {
  Dumbbell,
  LayoutGrid,
  Shirt,
  Smartphone,
  Sofa,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import type { Category } from '@/api/types';
import { useTheme } from '@/theme/useTheme';

/** Correspondance nom d'icône (renvoyé par l'API) → composant Lucide. */
const ICONS: Record<string, LucideIcon> = {
  shirt: Shirt,
  smartphone: Smartphone,
  sparkles: Sparkles,
  sofa: Sofa,
  dumbbell: Dumbbell,
};

export function CategoryIcon({ name, size = 26 }: { name: string | null; size?: number }) {
  const { colors } = useTheme();
  const Icon = (name && ICONS[name]) || LayoutGrid;
  return <Icon size={size} color={colors.primary} strokeWidth={1.8} />;
}

/** Pastille ronde de catégorie (accueil). */
export function CategoryItem({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="w-[72px] items-center active:opacity-80" accessibilityRole="button">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30">
        <CategoryIcon name={category.icon} />
      </View>
      <Text className="mt-1.5 text-center text-xs font-medium text-ink dark:text-gray-200" numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
}
