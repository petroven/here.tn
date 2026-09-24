import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Search, ShieldCheck, Store as StoreIcon } from 'lucide-react-native';
import { StoreCard } from '@/components/StoreCard';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useStores } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/** « Toutes les boutiques » — même page que /boutiques sur le site, avec recherche. */
export function StoresScreen({ navigation }: RootScreenProps<'Stores'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const stores = useStores();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (stores.data ?? []).filter((s) =>
      `${s.name} ${s.description ?? ''} ${s.category ?? ''}`.toLowerCase().includes(q),
    );
  }, [stores.data, search]);

  return (
    <Screen muted>
      <Header title={t('stores.title')} />
      {stores.isError && !stores.data ? (
        <ErrorState error={stores.error} onRetry={() => stores.refetch()} />
      ) : (
        <FlatList
          data={stores.isLoading ? [] : filtered}
          keyExtractor={(s) => s.id}
          contentContainerClassName="gap-4 p-4 pb-10"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={stores.isRefetching} onRefresh={() => stores.refetch()} tintColor={colors.primary} colors={[colors.primary]} />
          }
          ListHeaderComponent={
            <View className="gap-4">
              <View className="rounded-2xl border border-[#E2D9CB] bg-white p-5 dark:border-gray-800 dark:bg-surface-dark-card">
                <View className="flex-row items-center gap-2">
                  <StoreIcon size={16} color={colors.primary} />
                  <Text className="text-sm font-bold text-primary">BuyHere</Text>
                </View>
                <Text className="mt-2 text-2xl font-extrabold text-ink dark:text-gray-100">{t('stores.title')}</Text>
                <Text className="mt-1 text-sm text-ink-muted dark:text-gray-400">{t('stores.subtitle')}</Text>
                <Input
                  containerClassName="mt-4"
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('stores.searchPlaceholder')}
                  leftIcon={<Search size={17} color={colors.muted} />}
                  returnKeyType="search"
                />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-extrabold text-ink dark:text-gray-100">{t('stores.count', { count: filtered.length })}</Text>
                <View className="flex-row items-center gap-1">
                  <ShieldCheck size={15} color={colors.success} />
                  <Text className="text-xs font-bold text-success">{t('stores.validated')}</Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => <StoreCard store={item} onPress={() => navigation.navigate('Store', { storeId: item.id })} />}
          ListEmptyComponent={
            stores.isLoading ? (
              <View className="gap-4">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
              </View>
            ) : (
              <EmptyState icon={<StoreIcon size={40} color={colors.primary} />} title={t('stores.empty')} text={t('stores.emptyText')} />
            )
          }
        />
      )}
    </Screen>
  );
}
