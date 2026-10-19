import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { FileImage, Store } from 'lucide-react-native';
import { adminApi, type StoreStatus } from '@/api/admin';
import { errorMessage } from '@/api/client';
import { Pill } from '@/components/admin/AdminUi';
import { InfoRow, SellerCard } from '@/components/seller/SellerCard';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { PromptModal } from '@/components/ui/PromptModal';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { useAdminStores, useRefreshAdmin } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';
import { KYC_TONE, STORE_TONE } from './AdminStoresScreen';

function KycDocument({ label, uri }: { label: string; uri: string | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View className="flex-1">
      <Text className="mb-1.5 text-xs font-semibold text-ink-muted dark:text-gray-400">{label}</Text>
      {uri ? (
        <Pressable onPress={() => Linking.openURL(uri)} accessibilityRole="imagebutton" accessibilityLabel={label}>
          <Image source={{ uri }} style={{ width: '100%', height: 120, borderRadius: 12 }} contentFit="cover" />
        </Pressable>
      ) : (
        <View className="h-[120px] items-center justify-center rounded-xl bg-surface-muted dark:bg-surface-dark-muted">
          <FileImage size={22} color={colors.subtle} />
          <Text className="mt-1 text-2xs text-ink-subtle">{t('admin.noDocument')}</Text>
        </View>
      )}
    </View>
  );
}

/** Fiche boutique : vendeur, chiffres, activation et décision KYC. */
export function AdminStoreScreen({ route }: RootScreenProps<'AdminStore'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const stores = useAdminStores();
  const refresh = useRefreshAdmin();
  const [rejecting, setRejecting] = useState(false);
  const store = stores.data?.find((b) => b.id === route.params.storeId);

  const setStatus = useMutation({
    mutationFn: (status: StoreStatus) => adminApi.setStoreStatus(route.params.storeId, status),
    onSuccess: () => {
      refresh();
      toast(t('admin.saved'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const kyc = useMutation({
    mutationFn: ({ ok, comment }: { ok: boolean; comment?: string }) =>
      adminApi.decideKyc(route.params.storeId, ok ? 'valide' : 'rejete', comment),
    onSuccess: () => {
      setRejecting(false);
      refresh();
      toast(t('admin.saved'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  if (!store) {
    return (
      <Screen muted>
        <Header title={t('admin.store')} />
        {stores.isError && !stores.data ? (
          <ErrorState error={stores.error} onRetry={() => stores.refetch()} />
        ) : stores.isLoading ? (
          <View className="gap-3 p-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
          </View>
        ) : (
          <EmptyState icon={<Store size={40} color={colors.primary} />} title={t('admin.notFound')} />
        )}
      </Screen>
    );
  }

  const busy = setStatus.isPending || kyc.isPending;
  const changeStatus = (status: StoreStatus) =>
    status === 'suspendue'
      ? confirm(
          t('admin.suspendTitle'),
          t('admin.suspendText', { name: store.name }),
          { confirm: t('admin.storeAction.suspendue'), cancel: t('common.cancel') },
          () => setStatus.mutate(status),
        )
      : setStatus.mutate(status);

  return (
    <Screen muted>
      <Header title={store.name} />
      <ScrollView contentContainerClassName="p-4 pb-10">
        <View className="mb-3 flex-row flex-wrap gap-1.5">
          <Pill label={t(`admin.storeStatus.${store.status}`)} tone={STORE_TONE[store.status]} />
          <Pill label={t(`admin.kycStatus.${store.kyc.status}`)} tone={KYC_TONE[store.kyc.status]} />
        </View>

        <SellerCard title={t('admin.vendor')}>
          <InfoRow label={t('admin.name')} value={store.vendor?.name || '—'} />
          <InfoRow label={t('auth.email')} value={store.vendor?.email || '—'} />
          <InfoRow label={t('auth.phone')} value={store.vendor?.phone || '—'} />
          <InfoRow label={t('admin.address')} value={store.address || '—'} />
          <InfoRow label={t('admin.createdAt')} value={formatDateTime(store.createdAt, lang)} />
          <InfoRow
            label={t('admin.terms')}
            value={store.acceptedTerms ? t('admin.termsYes') : t('admin.termsNo')}
            strong={!store.acceptedTerms}
          />
        </SellerCard>

        <SellerCard title={t('admin.figures')}>
          <InfoRow label={t('admin.ordersLabel')} value={String(store.stats.orders)} />
          <InfoRow label={t('seller.gross')} value={formatPrice(store.stats.gross, lang)} />
          <InfoRow label={t('seller.commission')} value={formatPrice(store.stats.commissions, lang)} />
          <InfoRow label={t('seller.netTotal')} value={formatPrice(store.stats.net, lang)} />
          <InfoRow label={t('seller.available')} value={formatPrice(store.stats.available, lang)} strong />
        </SellerCard>

        <SellerCard title={t('admin.activation')}>
          {!store.acceptedTerms ? (
            <Text className="mb-3 text-xs leading-5 text-danger">{t('admin.termsRequired')}</Text>
          ) : null}
          <View className="gap-2">
            {store.status !== 'validee' ? (
              <Button
                title={t('admin.storeAction.validee')}
                size="sm"
                disabled={busy || !store.acceptedTerms}
                loading={setStatus.isPending && setStatus.variables === 'validee'}
                onPress={() => changeStatus('validee')}
              />
            ) : null}
            {store.status !== 'suspendue' ? (
              <Button
                title={t('admin.storeAction.suspendue')}
                size="sm"
                variant="outline"
                disabled={busy}
                loading={setStatus.isPending && setStatus.variables === 'suspendue'}
                onPress={() => changeStatus('suspendue')}
              />
            ) : null}
            {store.status !== 'en_attente' ? (
              <Button
                title={t('admin.storeAction.en_attente')}
                size="sm"
                variant="ghost"
                disabled={busy}
                onPress={() => changeStatus('en_attente')}
              />
            ) : null}
          </View>
        </SellerCard>

        <SellerCard title={t('admin.kyc')}>
          {store.kyc.status === 'non_soumis' ? (
            <Text className="text-sm text-ink-muted dark:text-gray-400">{t('admin.kycNotSubmitted')}</Text>
          ) : (
            <>
              <InfoRow label="CIN" value={store.kyc.cin || '—'} />
              <InfoRow label="RIB" value={store.kyc.rib || '—'} />
              {store.kyc.submittedAt ? (
                <InfoRow label={t('admin.submittedAt')} value={formatDateTime(store.kyc.submittedAt, lang)} />
              ) : null}
              <View className="mt-3 flex-row gap-3">
                <KycDocument label={t('admin.cinDocument')} uri={store.kyc.cinDocument} />
                <KycDocument label={t('admin.ribDocument')} uri={store.kyc.ribDocument} />
              </View>
              {store.kyc.comment ? (
                <Text className="mt-3 text-xs text-ink-muted dark:text-gray-400">
                  {t('admin.lastComment')} : {store.kyc.comment}
                </Text>
              ) : null}
              {store.kyc.status === 'en_attente' ? (
                <View className="mt-4 flex-row gap-2">
                  <Button
                    title={t('admin.kycApprove')}
                    size="sm"
                    className="flex-1"
                    disabled={busy}
                    loading={kyc.isPending && kyc.variables?.ok === true}
                    onPress={() => kyc.mutate({ ok: true })}
                  />
                  <Button
                    title={t('admin.kycReject')}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={busy}
                    onPress={() => setRejecting(true)}
                  />
                </View>
              ) : null}
            </>
          )}
        </SellerCard>
      </ScrollView>

      {rejecting ? (
        <PromptModal
          title={t('admin.kycReject')}
          message={t('admin.kycRejectText')}
          placeholder={t('admin.reasonPlaceholder')}
          confirmLabel={t('admin.kycReject')}
          minLength={5}
          destructive
          loading={kyc.isPending}
          onConfirm={(comment) => kyc.mutate({ ok: false, comment })}
          onClose={() => setRejecting(false)}
        />
      ) : null}
    </Screen>
  );
}
