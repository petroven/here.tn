import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Référence globale : navigation hors composants (tap sur notification, etc.). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
