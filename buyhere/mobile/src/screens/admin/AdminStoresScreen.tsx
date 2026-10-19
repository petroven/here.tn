import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react-native';
import type { AdminStore, KycStatus, StoreStatus } from '@/api/admin';
import { FilterBar, matches, Pill, type Tone } from '@/components/admin/AdminUi';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAdminStores } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

export const STORE_TONE: Record<StoreStatus, Tone> = { en_attente: 'amber', validee: 'green', suspendue: 'red' };
export const KYC_TONE: Record<KycStatus, Tone> = { non_soumis: 'gray', en_attente: 'amber', valide: 'green', rejete: 'red' };

type Filter = 'todo' | 'kyc' | 'validee' | 'suspendue' | 'all';

const FILTERS: Record<Filter, (b: AdminStore) => boolean> = {
  todo: (b) => b.status === 'en_attente',
  kyc: (b) => b.kyc.status === 'en_attente',
  validee: (b) => b.status === 'validee',
  suspendue: (b) => b.status === 'suspendue',
  all: () => true,
};

/** Boutiques : activation, suspension et vérification d'identité (KYC). */
export function AdminStoresScreen({ navigation }: RootScreenProps<'AdminStores'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const stores = useAdminStores();
  const [filter, setFilter] = useState<Filter>('todo');
  const [query, setQuery] = useState('');

  const all = stores.data ?? [];
  const items = useMemo(
    () =>
      (stores.data ?? [])
        .filter(FILTERS[filter])
        .filter((b) => matches(query, b.name, b.vendor?.name, b.vendor?.email)),
    [stores.data, filter, query],
  );

  return (
    <Screen muted>
      <Header title={t('admin.stores')} />
      <FilterBar
        query={query}
        onQuery={setQuery}
        placeholder={t('admin.searchStores')}
        value={filter}
        onChange={setFilter}
        filters={(Object.keys(FILTERS) as Filter[]).map((k) => ({
          key: k,
          label: t(`admin.storeFilter.${k}`),
          count: all.filter(FILTERS[k]).length,
        }))}
      />
      {stores.isError && !stores.data ? (
        <ErrorState error={stores.error} onRetry={() => stores.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => b.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('AdminStore', { storeId: item.id })}
              className="mx-4 mb-2.5 flex-row gap-3 rounded-2xl bg-white p-3.5 active:opacity-80 dark:bg-surface-dark-card"
              accessibilityRole="button"
            >
              <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary-50 dark:bg-primary-900/30">
                {item.logoUrl ? (
                  <Image source={{ uri: item.logoUrl }} style={{ width: 48, height: 48 }} contentFit="cover" />
                ) : (
                  <Store size={22} color={colors.primary} />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-bold text-ink dark:text-gray-100" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-xs text-ink-muted dark:text-gray-400" numberOfLines={1}>
                  {item.vendor?.email ?? '—'} · {t('admin.ordersCount', { count: item.stats.orders })} ·{' '}
                  {formatPrice(item.stats.gross, lang)}
                </Text>
                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  <Pill label={t(`admin.storeStatus.${item.status}`)} tone={STORE_TONE[item.status]} />
                  <Pill label={t(`admin.kycStatus.${item.kyc.status}`)} tone={KYC_TONE[item.kyc.status]} />
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            stores.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<Store size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={stores.isRefetching}
              onRefresh={() => stores.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
