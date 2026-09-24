import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BRAND_CREAM, BRAND_DARK, LogoWordmark } from '@/components/Logo';

type Props = { ready: boolean; onFinish: () => void };

/**
 * Splash animé (prolonge le splash natif) : le logo « buyhere. » apparaît avec un
 * rebond, puis l'écran s'efface dès que l'app est prête.
 */
export function AnimatedSplash({ ready, onFinish }: Props) {
  const scale = useSharedValue(0.6);
  const logoOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 350 });
    scale.value = withSequence(withSpring(1.08, { damping: 8 }), withSpring(1));
  }, [logoOpacity, scale]);

  useEffect(() => {
    if (!ready) return;
    // Laisse l'animation d'entrée se terminer (~0,9 s) avant de disparaître.
    screenOpacity.value = withDelay(
      900,
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) runOnJS(onFinish)();
      }),
    );
  }, [ready, onFinish, screenOpacity]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: BRAND_DARK }, screenStyle]}>
      <View className="flex-1 items-center justify-center">
        {/* Même logo et même fond que le splash natif (app.json) : transition invisible. */}
        <Animated.View style={logoStyle} className="items-center">
          <LogoWordmark height={54} color={BRAND_CREAM} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
