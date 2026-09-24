import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  edges?: Edge[];
  keyboard?: boolean; // décale le contenu quand le clavier s'ouvre (formulaires)
  className?: string;
  muted?: boolean; // fond « chaux » du site (listes de cartes)
};

/** Conteneur d'écran : zones sûres, fond clair/sombre, gestion du clavier. */
export function Screen({ children, edges = ['top'], keyboard, className = '', muted }: Props) {
  const bg = muted ? 'bg-surface-page dark:bg-surface-dark' : 'bg-white dark:bg-surface-dark';
  const content = <View className={`flex-1 ${className}`}>{children}</View>;

  return (
    <SafeAreaView edges={edges} className={`flex-1 ${bg}`}>
      {keyboard ? (
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
