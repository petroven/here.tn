import { useEffect, useRef } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BRAND_CREAM, BRAND_RUST, LogoWordmark } from '@/components/Logo';

type Props = { onFinish: () => void };

/**
 * Animation d'ouverture « buyhere. » — copie fidèle de l'intro du site
 * (client/src/components/IntroAnimation.jsx + .bh-intro dans index.css).
 * Une seule horloge (ms, 0 → 3300) pilote tout, comme la timeline CSS :
 *  1. le point orange tombe au centre, s'écrase, rebondit et pulse ;
 *  2. il éclate en rubans de lumière terracotta / sable / crème ;
 *  3. les rubans se resserrent et le logo se dévoile de gauche à droite ;
 *  4. plongée à travers le logo pendant que l'écran s'efface vers l'app.
 * Un toucher la passe (fondu de 450 ms, comme un clic sur le site).
 */
const DURATION_MS = 3300;
const LEAVE_MS = 450;
const DOT = 34;

// Rubans : teinte, position horizontale (% de l'écran), largeur (%), délai (ms) — valeurs du site.
const RIBBONS: [string, number, number, number][] = [
  ['#C4532C', 8, 7, 0], ['#E8A87C', 17, 4, 40], ['#994122', 25, 9, 80], ['#F4ECDF', 34, 3, 20],
  ['#D87350', 41, 6, 60], ['#C4532C', 49, 10, 0], ['#FBF8F3', 57, 3, 100], ['#E8A87C', 63, 7, 30],
  ['#7A3219', 71, 5, 70], ['#D87350', 79, 8, 50], ['#F4ECDF', 87, 4, 90], ['#C4532C', 94, 6, 20],
];

// Courbes CSS reprises telles quelles.
const cssEase = Easing.bezierFn(0.25, 0.1, 0.25, 1);
const cssEaseIn = Easing.bezierFn(0.42, 0, 1, 1);
const cssEaseOut = Easing.bezierFn(0, 0, 0.58, 1);
const dotEase = Easing.bezierFn(0.34, 1.56, 0.64, 1);
const ribbonEase = Easing.bezierFn(0.65, 0, 0.35, 1);
const revealEase = Easing.bezierFn(0.22, 1, 0.36, 1);
const zoomEase = Easing.bezierFn(0.7, 0, 0.84, 0);

/** Avancement 0 → 1 d'une animation CSS (début, durée en ms) à l'instant t. */
function progress(t: number, start: number, duration: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - start) / duration));
}

/** Interpolation façon @keyframes : la courbe s'applique à chaque segment (sans écrêtage, pour le rebond). */
function keyframes(p: number, stops: number[], values: number[], ease: (x: number) => number) {
  'worklet';
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i]) {
      const local = (p - stops[i - 1]) / (stops[i] - stops[i - 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * ease(Math.max(0, local));
    }
  }
  return values[values.length - 1];
}

function Ribbon({ t, color, x, w, delay, width }: { t: SharedValue<number>; color: string; x: number; w: number; delay: number; width: number }) {
  const center = ((50 - x) / 100) * width;
  const style = useAnimatedStyle(() => {
    const p = progress(t.value, 750 + delay, 1500);
    const stops = [0, 0.35, 0.6, 1];
    return {
      opacity: keyframes(p, stops, [0, 0.95, 0.85, 0], ribbonEase),
      transform: [
        { translateX: keyframes(p, stops, [center, 0, 0, center], ribbonEase) },
        { scaleY: keyframes(p, stops, [0, 1, 1, 0.2], ribbonEase) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: (x / 100) * width, width: (w / 100) * width, mixBlendMode: 'screen' },
        style,
      ]}
    >
      <LinearGradient
        colors={[`${color}00`, color, color, `${color}00`]}
        locations={[0, 0.18, 0.82, 1]}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

function Ring({ t, delay }: { t: SharedValue<number>; delay: number }) {
  const style = useAnimatedStyle(() => {
    const e = cssEaseOut(progress(t.value, delay, 900));
    return {
      opacity: t.value < delay ? 0 : 0.9 * (1 - e),
      transform: [{ scale: 1 + 8 * e }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          borderWidth: 2,
          borderColor: 'rgba(232,168,124,0.8)',
        },
        style,
      ]}
    />
  );
}

// Halo du point (box-shadow du site) : dégradé radial, rayon ≈ point + flou + étalement.
const GLOW = 134;

function Dot({ t, height }: { t: SharedValue<number>; height: number }) {
  const dotStyle = useAnimatedStyle(() => {
    const p = progress(t.value, 0, 1350);
    const stops = [0, 0.48, 0.6, 0.7, 0.82, 1];
    return {
      opacity: keyframes(p, [0, 0.3, 1], [0, 1, 0], dotEase),
      transform: [
        { translateY: keyframes(p, stops, [-height * 0.46, 0, -18, 0, 0, 0], dotEase) },
        { scaleX: keyframes(p, stops, [0.5, 1.15, 0.95, 1, 1.6, 0], dotEase) },
        { scaleY: keyframes(p, stops, [0.5, 0.85, 1.05, 1, 1.6, 0], dotEase) },
      ],
    };
  });
  // Le halo s'élargit et s'intensifie au moment de la pulsation (82 %).
  const glowStyle = useAnimatedStyle(() => {
    const p = progress(t.value, 0, 1350);
    return {
      opacity: keyframes(p, [0, 0.82, 1], [0.78, 1, 0.78], dotEase),
      transform: [{ scale: keyframes(p, [0, 0.82, 1], [1, 2.05, 1], dotEase) }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: DOT, height: DOT }, dotStyle]}>
      <Animated.View
        style={[{ position: 'absolute', width: GLOW, height: GLOW, left: (DOT - GLOW) / 2, top: (DOT - GLOW) / 2 }, glowStyle]}
      >
        <Svg width={GLOW} height={GLOW}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset={DOT / GLOW} stopColor={BRAND_RUST} stopOpacity={0.7} />
              <Stop offset={1} stopColor={BRAND_RUST} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#glow)" />
        </Svg>
      </Animated.View>
      <View style={{ width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: BRAND_RUST }} />
    </Animated.View>
  );
}

export function AnimatedSplash({ onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const logoWidth = Math.min(width * 0.72, 460);
  const logoHeight = (logoWidth * 92.3) / 392.8;

  const t = useSharedValue(0);
  const leaving = useSharedValue(1);
  const done = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onFinish();
  };

  // Comme le site : fin de la timeline (ou toucher) → fondu de 450 ms → app.
  const close = () => {
    if (leaving.value < 1) return;
    leaving.value = withTiming(0, { duration: LEAVE_MS, reduceMotion: ReduceMotion.Never }, (finished) => {
      if (finished) runOnJS(finish)();
    });
    // Filet de sécurité si le rappel de fin d'animation n'arrive jamais.
    timers.current.push(setTimeout(finish, LEAVE_MS + 300));
  };

  useEffect(() => {
    // Joue même si le téléphone a coupé les animations système (ReduceMotion.Never).
    t.value = withTiming(DURATION_MS, { duration: DURATION_MS, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    timers.current.push(setTimeout(close, DURATION_MS));
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
    // close ne lit que des refs / valeurs partagées.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fond : opaque jusqu'à 82 % puis s'efface (ease-in) pendant la plongée.
  const screenStyle = useAnimatedStyle(() => ({
    opacity: (1 - cssEaseIn(progress(t.value, DURATION_MS * 0.82, DURATION_MS * 0.18))) * leaving.value,
  }));
  const maskStyle = useAnimatedStyle(() => ({
    width: logoWidth * revealEase(progress(t.value, 1550, 900)),
  }));
  const logoStyle = useAnimatedStyle(() => {
    const reveal = revealEase(progress(t.value, 1550, 900));
    const zoom = zoomEase(progress(t.value, 2650, 650));
    return {
      opacity: 1 - zoom,
      transform: [{ scale: (0.92 + 0.08 * reveal) * (1 + 13 * zoom) }],
    };
  });
  const skipStyle = useAnimatedStyle(() => ({ opacity: cssEase(progress(t.value, 900, 400)) }));

  return (
    <Animated.View style={[{ flex: 1 }, screenStyle]}>
      <Pressable
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="BuyHere"
      >
        {/* Fond radial du site : #2a2420 → #1e1b18 → #120f0d. */}
        <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
          <Defs>
            <RadialGradient
              id="bg"
              gradientUnits="userSpaceOnUse"
              cx={width / 2}
              cy={height / 2}
              r={Math.hypot(width, height) / 2}
            >
              <Stop offset={0} stopColor="#2a2420" />
              <Stop offset={0.55} stopColor="#1e1b18" />
              <Stop offset={1} stopColor="#120f0d" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />
        </Svg>

        {RIBBONS.map(([color, x, w, delay], i) => (
          <Ribbon key={i} t={t} color={color} x={x} w={w} delay={delay} width={width} />
        ))}

        <Dot t={t} height={height} />
        <Ring t={t} delay={620} />
        <Ring t={t} delay={800} />

        {/* Logo dévoilé de gauche à droite (masque qui s'élargit), puis plongée. */}
        <Animated.View
          style={[
            {
              width: logoWidth,
              height: logoHeight,
              shadowColor: BRAND_RUST,
              shadowOpacity: 0.45,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 0 },
            },
            logoStyle,
          ]}
        >
          <Animated.View style={[{ height: logoHeight, overflow: 'hidden' }, maskStyle]}>
            <View style={{ width: logoWidth }}>
              <LogoWordmark height={logoHeight} color={BRAND_CREAM} />
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.Text
          style={[
            {
              position: 'absolute',
              bottom: 24 + insets.bottom,
              fontSize: 11,
              letterSpacing: 0.9,
              color: 'rgba(244,236,223,0.45)',
            },
            skipStyle,
          ]}
        >
          TOUCHER POUR PASSER
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}
