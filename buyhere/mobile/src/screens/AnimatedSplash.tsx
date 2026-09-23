import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ShoppingBag } from 'lucide-react-native';

type Props = { ready: boolean; onFinish: () => void };

/**
 * Splash animé (prolonge le splash natif orange) : le logo apparaît avec un
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
    <Animated.View style={[{ flex: 1, backgroundColor: '#FF6B00' }, screenStyle]}>
      <View className="flex-1 items-center justify-center">
        <Animated.View style={logoStyle} className="items-center">
          <View className="h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-lg">
            <ShoppingBag size={48} color="#FF6B00" strokeWidth={2.2} />
          </View>
          <Text className="mt-5 text-4xl font-extrabold tracking-tight text-white">BuyHere</Text>
          <Text className="mt-1 text-sm font-medium text-white/85">Achetez malin, partout en Tunisie</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
