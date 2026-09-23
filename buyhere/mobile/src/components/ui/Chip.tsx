import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
};

/** Pastille sélectionnable : filtres, tailles, onglets de statut. */
export function Chip({ label, selected, onPress, icon, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`h-9 flex-row items-center gap-1.5 rounded-full border px-4 ${
        selected
          ? 'border-primary bg-primary-50 dark:bg-primary-900/40'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-surface-dark-card'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      {icon}
      <Text
        className={`text-sm font-medium ${
          selected ? 'text-primary-600 dark:text-primary-300' : 'text-ink dark:text-gray-200'
        } ${disabled ? 'line-through' : ''}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
