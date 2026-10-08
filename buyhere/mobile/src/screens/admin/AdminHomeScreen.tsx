import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  Boxes,
  FolderTree,
  Landmark,
  MessageSquareWarning,
  RotateCcw,
  ScrollText,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { returnsApi } from '@/api/account';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ErrorState } from '@/components/ui/States';
import {
  useAdminReviews,
  useAdminStats,
  useAdminStores,
  useAdminTransfers,
  useAdminWithdrawals,
  useRefreshAdmin,
} from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps, RootStackParamList } from '@/navigation/types';

/** Écrans de l'espace admin ouverts sans paramètre depuis le menu. */
type MenuRoute = Extract<
  keyof RootStackParamList,
  | 'AdminStores'
  | 'AdminWithdrawals'
  | 'AdminTransfers'
  | 'SellerReturns'
  | 'AdminOrders'
  | 'AdminProducts'
  | 'AdminReviews'
  | 'AdminUsers'
  | 'AdminCategories'
  | 'AdminAudit'
>;

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
          <View className="absolute -end-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1">
            <Text className="text-2xs font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-2 px-1 text-center text-xs font-semibold text-ink dark:text-gray-100">{label}</Text>
    </Pressable>
  );
}

/** Tableau de bord administrateur : chiffres clés et files d'attente à traiter. */
export function AdminHomeScreen({ navigation }: RootScreenProps<'AdminHome'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const stats = useAdminStats();
  const stores = useAdminStores();
  const withdrawals = useAdminWithdrawals();
  const transfers = useAdminTransfers();
  const reviews = useAdminReviews();
  const returns = useQuery({ queryKey: ['returns'], queryFn: returnsApi.list });
  const refresh = useRefreshAdmin();

  const s = stats.data;
  const storesTodo =
    stores.data?.filter((b) => b.status === 'en_attente' || b.kyc.status === 'en_attente').length ?? 0;
  const withdrawalsTodo = withdrawals.data?.filter((w) => w.status === 'demande' || w.status === 'approuve').length ?? 0;
  const transfersTodo = transfers.data?.filter((p) => p.status === 'en_attente_validation').length ?? 0;
  const disputes = returns.data?.filter((r) => r.status === 'litige').length ?? 0;
  const hiddenReviews = reviews.data?.filter((r) => !r.visible).length ?? 0;

  const go = (name: MenuRoute) => navigation.navigate(name as never);

  if (stats.isError && !s) {
    return (
      <Screen>
        <Header title={t('admin.title')} />
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      </Screen>
    );
  }

  const todo = storesTodo + withdrawalsTodo + transfersTodo + disputes;

  return (
    <Screen muted>
      <Header title={t('admin.title')} />
      <ScrollView
        contentContainerClassName="p-4 pb-10 gap-3"
        refreshControl={
          <RefreshControl
            refreshing={stats.isRefetching}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View
          className={`rounded-2xl p-3.5 ${todo ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-green-50 dark:bg-green-900/30'}`}
        >
          <Text className="text-sm font-semibold text-ink dark:text-gray-100">
            {todo ? t('admin.todoCount', { count: todo }) : t('admin.allClear')}
          </Text>
        </View>

        <View className="flex-row gap-2.5">
          <Tile accent label={t('admin.commission')} value={formatPrice(s?.commission ?? 0, lang)} hint={t('admin.commissionHint')} />
          <Tile label={t('admin.orders')} value={String(s?.orders ?? '—')} />
        </View>
        <View className="flex-row gap-2.5">
          <Tile
            label={t('admin.stores')}
            value={String(s?.stores.total ?? '—')}
            hint={s ? t('admin.storesHint', { verified: s.stores.verified, pending: s.stores.pending }) : undefined}
          />
          <Tile
            label={t('admin.users')}
            value={String(s?.users.total ?? '—')}
            hint={s ? t('admin.usersHint', { customers: s.users.customers, vendors: s.users.vendors }) : undefined}
          />
        </View>
        <View className="flex-row gap-2.5">
          <Tile label={t('admin.products')} value={String(s?.products.total ?? '—')} />
          <Tile
            label={t('admin.lowStock')}
            value={String(s?.products.lowStock ?? '—')}
            hint={s ? t('admin.lowStockHint', { threshold: s.products.lowStockThreshold }) : undefined}
          />
        </View>

        <Text className="mt-3 text-base font-bold text-ink dark:text-gray-100">{t('admin.manage')}</Text>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          <MenuItem icon={Store} label={t('admin.stores')} badge={storesTodo} onPress={() => go('AdminStores')} />
          <MenuItem icon={Banknote} label={t('admin.withdrawals')} badge={withdrawalsTodo} onPress={() => go('AdminWithdrawals')} />
          <MenuItem icon={Landmark} label={t('admin.transfers')} badge={transfersTodo} onPress={() => go('AdminTransfers')} />
          <MenuItem icon={RotateCcw} label={t('admin.returns')} badge={disputes} onPress={() => go('SellerReturns')} />
          <MenuItem icon={ShoppingBag} label={t('admin.orders')} onPress={() => go('AdminOrders')} />
          <MenuItem icon={Boxes} label={t('admin.products')} badge={s?.products.lowStock} onPress={() => go('AdminProducts')} />
          <MenuItem icon={MessageSquareWarning} label={t('admin.reviews')} badge={hiddenReviews} onPress={() => go('AdminReviews')} />
          <MenuItem icon={Users} label={t('admin.users')} onPress={() => go('AdminUsers')} />
          <MenuItem icon={FolderTree} label={t('admin.categories')} onPress={() => go('AdminCategories')} />
          <MenuItem icon={ScrollText} label={t('admin.audit')} onPress={() => go('AdminAudit')} />
        </View>
      </ScrollView>
    </Screen>
  );
}
