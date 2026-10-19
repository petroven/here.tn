import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { errorMessage } from '@/api/client';
import { sellerApi, type SellerWithdrawal } from '@/api/vendor';
import { InfoRow } from '@/components/seller/SellerCard';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { useRefreshSeller, useSellerDashboard } from '@/hooks/useSeller';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDate, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

// Minimum de retrait par défaut du serveur (MIN_WITHDRAWAL_AMOUNT) : le serveur
// fait foi et renvoie son propre message si la valeur configurée diffère.
const MIN_WITHDRAWAL = 50_000;

const STATUS_TONE: Record<SellerWithdrawal['status'], string> = {
  demande: 'text-amber-600',
  approuve: 'text-blue-600',
  verse: 'text-success',
  rejete: 'text-danger',
};

/** Finances et retraits : solde retirable, séquestre, demandes de virement. */
export function SellerWithdrawalsScreen(_props: RootScreenProps<'SellerWithdrawals'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const dashboard = useSellerDashboard();
  const refresh = useRefreshSeller();
  const d = dashboard.data;
  const [amount, setAmount] = useState('');
  // Saisie de l'utilisateur, sinon l'IBAN de la boutique.
  const [ibanDraft, setIban] = useState<string | null>(null);
  const iban = ibanDraft ?? d?.store.iban ?? '';

  const request = useMutation({
    mutationFn: async () => {
      const value = Math.round(Number(amount.replace(',', '.')) * 1000);
      if (!Number.isFinite(value) || value < MIN_WITHDRAWAL)
        throw new Error(t('seller.withdrawMin', { amount: formatPrice(MIN_WITHDRAWAL, lang) }));
      if (d && value > d.finances.available) throw new Error(t('seller.withdrawTooMuch'));
      if (iban.replace(/\s/g, '').length < 20) throw new Error(t('seller.ibanInvalid'));
      await sellerApi.requestWithdrawal(value, iban.replace(/\s/g, ''));
    },
    onSuccess: () => {
      setAmount('');
      refresh();
      toast(t('seller.withdrawSent'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  if (dashboard.isError && !d) {
    return (
      <Screen>
        <Header title={t('seller.withdrawals')} />
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen muted keyboard>
      <Header title={t('seller.withdrawals')} />
      <ScrollView
        contentContainerClassName="p-4 pb-10 gap-3"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isRefetching}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {!d ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <>
            <View className="rounded-3xl bg-ink p-5">
              <Text className="text-sm text-white/70">{t('seller.available')}</Text>
              <Text className="mt-1 text-4xl font-extrabold text-white">{formatPrice(d.finances.available, lang)}</Text>
              <Text className="mt-2 text-xs leading-5 text-white/60">
                {t('seller.escrowLine', { amount: formatPrice(d.finances.escrow, lang) })}
              </Text>
            </View>

            <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <InfoRow label={t('seller.gross')} value={formatPrice(d.finances.gross, lang)} />
              <InfoRow label={t('seller.commission')} value={formatPrice(-d.finances.commissions, lang)} />
              <InfoRow label={t('seller.netTotal')} value={formatPrice(d.finances.net, lang)} strong />
              <InfoRow label={t('seller.paidOut')} value={formatPrice(d.finances.paidOut, lang)} />
            </View>

            <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <Text className="font-bold text-ink dark:text-gray-100">{t('seller.newWithdrawal')}</Text>
              <Input
                label={t('seller.withdrawAmount')}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                hint={t('seller.withdrawMin', { amount: formatPrice(MIN_WITHDRAWAL, lang) })}
              />
              <Input
                label="IBAN / RIB"
                value={iban}
                onChangeText={setIban}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Button
                title={t('seller.requestWithdrawal')}
                loading={request.isPending}
                disabled={d.finances.available < MIN_WITHDRAWAL}
                onPress={() => request.mutate()}
              />
              {d.finances.available < MIN_WITHDRAWAL ? (
                <Text className="text-xs text-ink-muted dark:text-gray-400">{t('seller.notEnough')}</Text>
              ) : null}
            </View>

            <Text className="mt-2 text-base font-bold text-ink dark:text-gray-100">{t('seller.withdrawHistory')}</Text>
            {d.withdrawals.length === 0 ? (
              <Text className="text-sm text-ink-muted dark:text-gray-400">{t('seller.noWithdrawals')}</Text>
            ) : null}
            {d.withdrawals.map((w) => (
              <View
                key={w.id}
                className="flex-row items-center justify-between rounded-2xl bg-white p-4 dark:bg-surface-dark-card"
              >
                <View className="flex-1">
                  <Text className="font-bold text-ink dark:text-gray-100">{formatPrice(w.amount, lang)}</Text>
                  <Text className="text-xs text-ink-muted dark:text-gray-400">
                    {formatDate(w.createdAt, lang)}
                    {w.rejectionReason ? ` · ${w.rejectionReason}` : ''}
                  </Text>
                </View>
                <Text className={`text-sm font-semibold ${STATUS_TONE[w.status]}`}>
                  {t(`seller.withdrawStatus.${w.status}`)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
