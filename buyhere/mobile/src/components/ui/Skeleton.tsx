import { useEffect } from 'react';
import { View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/useTheme';

type Props = { className?: string; style?: ViewStyle };

/** Bloc gris pulsant affiché pendant le chargement. */
export function Skeleton({ className = '', style }: Props) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={`rounded-xl ${className}`}
      style={[{ backgroundColor: colors.skeleton }, style, animated]}
    />
  );
}

/** Squelette d'une carte produit (même gabarit que ProductCard). */
export function ProductCardSkeleton({ width }: { width: number }) {
  return (
    <View style={{ width }} className="mb-4">
      <Skeleton style={{ width, height: width * 1.15 }} className="rounded-2xl" />
      <Skeleton className="mt-2.5 h-3.5 w-11/12" />
      <Skeleton className="mt-1.5 h-3.5 w-7/12" />
      <Skeleton className="mt-2.5 h-4 w-5/12" />
    </View>
  );
}

/** Grille 2 colonnes de squelettes. */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  const { width } = useWindowDimensions();
  const cardWidth = (width - 16 * 2 - 12) / 2;
  return (
    <View className="flex-row flex-wrap justify-between px-4 pt-2">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} width={cardWidth} />
      ))}
    </View>
  );
}

/** Rangée horizontale de squelettes (carrousels de l'accueil). */
export function ProductRowSkeleton() {
  return (
    <View className="flex-row gap-3 px-4">
      {[0, 1, 2].map((i) => (
        <ProductCardSkeleton key={i} width={150} />
      ))}
    </View>
  );
}

/** Squelette d'une ligne de liste (commandes, notifications, adresses). */
export function ListItemSkeleton() {
  return (
    <View className="mx-4 mb-3 flex-row items-center gap-3 rounded-2xl bg-white p-3 dark:bg-surface-dark-card">
      <Skeleton className="h-14 w-14 rounded-xl" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-3.5 w-8/12" />
        <Skeleton className="h-3 w-5/12" />
      </View>
    </View>
  );
}
