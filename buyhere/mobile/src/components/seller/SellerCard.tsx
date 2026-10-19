import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Carte blanche titrée des écrans vendeur. */
export function SellerCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
      <Text className="mb-3 text-base font-bold text-ink dark:text-gray-100">{title}</Text>
      {children}
    </View>
  );
}

/** Ligne libellé / valeur (montants, références). */
export function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-ink-muted dark:text-gray-400">{label}</Text>
      <Text className={`text-sm ${strong ? 'font-bold text-ink dark:text-gray-100' : 'text-ink dark:text-gray-200'}`}>
        {value}
      </Text>
    </View>
  );
}
