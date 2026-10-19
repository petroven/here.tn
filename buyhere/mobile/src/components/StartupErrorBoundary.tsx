import { Component, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { reloadAppAsync } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

type State = { error: Error | null; stack: string };

/**
 * Erreur de rendu au démarrage : au lieu de rester figé sur le logo natif,
 * l'app affiche l'erreur et envoie la pile des composants aux journaux.
 */
export class StartupErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, stack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const stack = info.componentStack ?? '';
    console.warn(
      '[démarrage] erreur de rendu :',
      error.message,
      '\nPile JS :',
      (error.stack ?? '').split('\n').slice(0, 14).join(' | '),
      '\nComposants :',
      stack.slice(0, 1500),
    );
    this.setState({ stack });
    SplashScreen.hideAsync().catch(() => undefined);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#1E1B18', paddingTop: 60, paddingHorizontal: 20 }}>
        <Text style={{ color: '#F4ECDF', fontSize: 18, fontWeight: '700' }}>Erreur au démarrage</Text>
        <Text style={{ color: '#E8A87C', marginTop: 8 }}>{this.state.error.message}</Text>
        <Pressable
          onPress={() => reloadAppAsync().catch(() => this.setState({ error: null, stack: '' }))}
          style={{
            marginTop: 16,
            alignSelf: 'flex-start',
            backgroundColor: '#C4532C',
            borderRadius: 14,
            paddingHorizontal: 18,
            paddingVertical: 12,
          }}
          accessibilityRole="button"
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Relancer l’app</Text>
        </Pressable>
        <ScrollView style={{ marginTop: 12 }}>
          <Text style={{ color: '#B8B0A3', fontSize: 11 }}>{this.state.stack}</Text>
        </ScrollView>
      </View>
    );
  }
}
