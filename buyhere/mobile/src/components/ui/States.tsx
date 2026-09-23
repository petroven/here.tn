import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react-native';
import { useTheme } from '@/theme/useTheme';
import { ApiError } from '@/api/client';
import { Button } from './Button';

type EmptyProps = {
  icon: ReactNode;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void };
};

/** État vide illustré (panier vide, aucun favori, aucune commande...). */
export function EmptyState({ icon, title, text, action }: EmptyProps) {
  return (
    <View className="flex-1 items-center justify-center px-10 py-16">
      <View className="mb-5 h-24 w-24 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
        {icon}
      </View>
      <Text className="text-center text-lg font-bold text-ink dark:text-gray-100">{title}</Text>
      {text ? <Text className="mt-2 text-center text-sm leading-5 text-ink-muted dark:text-gray-400">{text}</Text> : null}
      {action ? (
        <Button title={action.label} onPress={action.onPress} fullWidth={false} className="mt-6 self-center" />
      ) : null}
    </View>
  );
}

/** Erreur de chargement avec bouton « Réessayer ». */
export function ErrorState({ error, onRetry }: { error?: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isNetwork = error instanceof ApiError && error.code === 'NETWORK';
  const message = isNetwork
    ? t('common.networkError')
    : error instanceof ApiError
      ? error.message
      : t('common.genericError');

  return (
    <EmptyState
      icon={<WifiOff size={40} color={colors.primary} />}
      title={message}
      action={{ label: t('common.retry'), onPress: onRetry }}
    />
  );
}
