import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react-native';
import { walletApi } from '@/api/account';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

export const walletKey = ['wallet'] as const;

const KNOWN_REASONS = ['cashback', 'utilise_commande', 'remboursement', 'annulation'];

/** Portefeuille : solde (cashback, remboursements) et historique des mouvements. */
export function WalletScreen(_props: RootScreenProps<'Wallet'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const wallet = useQuery({ queryKey: walletKey, queryFn: walletApi.get });

  return (
    <Screen muted>
      <Header title={t('wallet.title')} />
      {wallet.isError && !wallet.data ? (
        <ErrorState error={wallet.error} onRetry={() => wallet.refetch()} />
      ) : (
        <FlatList
          data={wallet.data?.entries ?? []}
          keyExtractor={(e) => e.id}
          contentContainerClassName="pb-6 flex-grow"
          ListHeaderComponent={
            <View className="mx-4 mb-4 mt-3 rounded-3xl bg-ink p-5">
              <View className="flex-row items-center gap-2">
                <Wallet size={18} color="#fff" />
                <Text className="text-sm text-white/70">{t('wallet.balance')}</Text>
              </View>
              <Text className="mt-2 text-4xl font-extrabold text-white">
                {formatPrice(wallet.data?.balance ?? 0, lang)}
              </Text>
              <Text className="mt-2 text-xs leading-5 text-white/60">{t('wallet.explain')}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const credit = item.type === 'credit';
            const reasonKey = KNOWN_REASONS.includes(item.reason) ? item.reason : 'other';
            return (
              <View className="mx-4 mb-2 flex-row items-center gap-3 rounded-2xl bg-white p-3.5 dark:bg-surface-dark-card">
                <View
                  className={`h-10 w-10 items-center justify-center rounded-full ${credit ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-surface-dark-muted'}`}
                >
                  {credit ? (
                    <ArrowDownLeft size={18} color={colors.success} />
                  ) : (
                    <ArrowUpRight size={18} color={colors.subtle} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-ink dark:text-gray-100">{t(`wallet.reason.${reasonKey}`)}</Text>
                  <Text className="text-xs text-ink-muted dark:text-gray-400">
                    {item.orderNumber ? `${item.orderNumber} · ` : ''}
                    {formatDateTime(item.createdAt, lang)}
                  </Text>
                </View>
                <Text className={`font-bold ${credit ? 'text-success' : 'text-ink dark:text-gray-100'}`}>
                  {credit ? '+' : '−'}
                  {formatPrice(item.amount, lang)}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={
            wallet.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<Wallet size={40} color={colors.primary} />}
                title={t('wallet.empty')}
                text={t('wallet.emptyText')}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={wallet.isRefetching}
              onRefresh={() => wallet.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
