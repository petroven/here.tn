import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  MessageCircle,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react-native';
import { returnsApi } from '@/api/account';
import { needsAction } from '@/api/vendor';
import { RevenueChart } from '@/components/seller/RevenueChart';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useRefreshSeller, useSellerDashboard, useSellerStats } from '@/hooks/useSeller';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

function Tile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <View className={`flex-1 rounded-2xl p-3.5 ${accent ? 'bg-ink' : 'bg-white dark:bg-surface-dark-card'}`}>
      <Text className={`text-xs ${accent ? 'text-white/70' : 'text-ink-muted dark:text-gray-400'}`}>{label}</Text>
      <Text
        className={`mt-1 text-lg font-extrabold ${accent ? 'text-white' : 'text-ink dark:text-gray-100'}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {hint ? <Text className={`mt-0.5 text-2xs ${accent ? 'text-white/60' : 'text-ink-subtle'}`}>{hint}</Text> : null}
    </View>
  );
}

function MenuItem({
  icon: Icon,
  label,
  badge,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="w-[31%] items-center rounded-2xl bg-white py-4 active:opacity-80 dark:bg-surface-dark-card"
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label} (${badge})` : label}
    >
      <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
        <Icon size={21} color={colors.primary} />
        {badge ? (
          <View className="absolute -end-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1">
            <Text className="text-2xs font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-2 text-center text-xs font-semibold text-ink dark:text-gray-100">{label}</Text>
    </Pressable>
  );
}

/** Tableau de bord vendeur : chiffres clés, graphique, raccourcis et alertes. */
export function SellerHomeScreen({ navigation }: RootScreenProps<'SellerHome'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const [days, setDays] = useState<7 | 30>(7);
  const dashboard = useSellerDashboard();
  const stats = useSellerStats(days);
  const returns = useQuery({ queryKey: ['returns'], queryFn: returnsApi.list });
  const refresh = useRefreshSeller();

  const d = dashboard.data;
  const s = stats.data;
  const toProcess = d?.orders.filter(needsAction).length ?? 0;
  const pendingReturns = returns.data?.filter((r) => r.status === 'demande').length ?? 0;

  if (dashboard.isError && !d) {
    return (
      <Screen>
        <Header title={t('seller.title')} />
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen muted>
      <Header title={d?.store.name ?? t('seller.title')} />
      <ScrollView
        contentContainerClassName="p-4 pb-10 gap-3"
        refreshControl={
          <RefreshControl
            refreshing={dashboard.isRefetching}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Statut de la boutique */}
        {d ? (
          <View className="flex-row flex-wrap gap-2">
            <View
              className={`flex-row items-center gap-1 rounded-full px-3 py-1 ${
                d.store.status === 'validee'
                  ? 'bg-green-100 dark:bg-green-900/40'
                  : d.store.status === 'suspendue'
                    ? 'bg-red-100 dark:bg-red-900/40'
                    : 'bg-amber-100 dark:bg-amber-900/40'
              }`}
            >
              <Text className="text-xs font-semibold text-ink dark:text-gray-100">
                {t(`seller.storeStatus.${d.store.status}`)}
              </Text>
            </View>
            {d.store.kycStatus === 'valide' ? (
              <View className="flex-row items-center gap-1 rounded-full bg-green-100 px-3 py-1 dark:bg-green-900/40">
                <BadgeCheck size={13} color={colors.success} />
                <Text className="text-xs font-semibold text-success">{t('seller.verified')}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {d && d.store.kycStatus !== 'valide' ? (
          <Pressable
            onPress={() => navigation.navigate('SellerKyc')}
            className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-900/20"
            accessibilityRole="button"
          >
            <ShieldCheck size={20} color={colors.primary} />
            <Text className="flex-1 text-sm text-ink dark:text-gray-100">
              {t(`seller.kycBanner.${d.store.kycStatus}`)}
            </Text>
          </Pressable>
        ) : null}

        {s && s.lowStock > 0 ? (
          <Pressable
            onPress={() => navigation.navigate('SellerProducts', { filter: 'faible' })}
            className="flex-row items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-900/20"
            accessibilityRole="button"
          >
            <AlertTriangle size={20} color={colors.primary} />
            <Text className="flex-1 text-sm text-ink dark:text-gray-100">
              {t('seller.lowStockBanner', { count: s.lowStock, threshold: s.lowStockThreshold })}
            </Text>
          </Pressable>
        ) : null}

        {/* Raccourcis */}
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <MenuItem
            icon={ShoppingBag}
            label={t('seller.orders')}
            badge={toProcess}
            onPress={() => navigation.navigate('SellerOrders')}
          />
          <MenuItem
            icon={Package}
            label={t('seller.products')}
            onPress={() => navigation.navigate('SellerProducts', {})}
          />
          <MenuItem
            icon={RotateCcw}
            label={t('seller.returns')}
            badge={pendingReturns}
            onPress={() => navigation.navigate('SellerReturns')}
          />
          <MenuItem
            icon={Banknote}
            label={t('seller.withdrawals')}
            onPress={() => navigation.navigate('SellerWithdrawals')}
          />
          <MenuItem
            icon={MessageCircle}
            label={t('messages.title')}
            onPress={() => navigation.navigate('Conversations')}
          />
          <MenuItem icon={ShieldCheck} label={t('seller.kyc')} onPress={() => navigation.navigate('SellerKyc')} />
        </View>

        {/* Chiffres clés */}
        {s ? (
          <>
            <View className="flex-row gap-3">
              <Tile
                accent
                label={t('seller.revenueMonth')}
                value={formatPrice(s.month.revenue, lang)}
                hint={t('seller.ordersCount', { count: s.month.orders })}
              />
            </View>
            <View className="flex-row gap-3">
              <Tile
                label={t('seller.revenueToday')}
                value={formatPrice(s.today.revenue, lang)}
                hint={t('seller.ordersCount', { count: s.today.orders })}
              />
              <Tile
                label={t('seller.revenueWeek')}
                value={formatPrice(s.week.revenue, lang)}
                hint={t('seller.ordersCount', { count: s.week.orders })}
              />
            </View>
            <View className="flex-row gap-3">
              <Tile
                label={t('seller.averageBasket')}
                value={formatPrice(s.averageBasketMonth, lang)}
                hint={t('seller.itemsSold', { count: s.itemsSoldMonth })}
              />
              <Tile label={t('seller.returnRate')} value={`${s.returnRate.toLocaleString('fr-TN')} %`} />
            </View>
            <View className="flex-row gap-3">
              <Tile
                label={t('seller.available')}
                value={formatPrice(s.available, lang)}
                hint={t('seller.availableHint')}
              />
              <Tile label={t('seller.escrow')} value={formatPrice(s.escrow, lang)} hint={t('seller.escrowHint')} />
            </View>
          </>
        ) : (
          <Skeleton className="h-56 w-full rounded-2xl" />
        )}

        {/* Graphique */}
        <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <View className="mb-1 flex-row items-center justify-between">
            <Text className="text-base font-bold text-ink dark:text-gray-100">{t('seller.revenueChart')}</Text>
            <View className="flex-row rounded-xl bg-surface-muted p-0.5 dark:bg-surface-dark-muted">
              {([7, 30] as const).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setDays(n)}
                  className={`rounded-lg px-3 py-1 ${days === n ? 'bg-ink' : ''}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: days === n }}
                >
                  <Text className={`text-xs font-semibold ${days === n ? 'text-white' : 'text-ink-muted'}`}>
                    {t('seller.days', { count: n })}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Text className="mb-3 text-2xs text-ink-subtle">{t('seller.revenueChartNote')}</Text>
          {s ? <RevenueChart series={s.series} /> : <Skeleton className="h-40 w-full rounded-xl" />}
        </View>

        {s ? (
          <Text className="text-center text-2xs text-ink-subtle">
            {t('seller.commissionNote', { amount: formatPrice(s.commissions, lang) })}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
