import Animated from 'react-native-reanimated';
import { cssInterop } from 'nativewind';

/**
 * NativeWind ne gère `className` que sur les composants React Native de base
 * (et quelques bibliothèques connues). Les vues animées de Reanimated doivent
 * être enregistrées, sinon leurs classes (tailles, arrondis) sont ignorées.
 * Importé une seule fois, au démarrage (App.tsx).
 */
cssInterop(Animated.View, { className: 'style' });
