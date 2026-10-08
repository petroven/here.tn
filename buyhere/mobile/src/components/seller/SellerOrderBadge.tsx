import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SellerOrderStatus } from '@/api/vendor';

const STYLES: Record<SellerOrderStatus, { box: string; text: string }> = {
  en_attente: { box: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  payee: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  preparation: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  expediee: { box: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-700 dark:text-primary-300' },
  en_cours_livraison: { box: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-700 dark:text-primary-300' },
  livree: { box: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  annulee: { box: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  retour: { box: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
  litige: { box: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
  retournee: { box: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
};

/** Statut d'une commande côté vendeur (libellés de la machine d'états du site). */
export function SellerOrderBadge({ status }: { status: SellerOrderStatus }) {
  const { t } = useTranslation();
  const style = STYLES[status] ?? STYLES.en_attente;
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${style.box}`}>
      <Text className={`text-xs font-semibold ${style.text}`}>{t(`seller.status.${status}`)}</Text>
    </View>
  );
}
