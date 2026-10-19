import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, Users } from 'lucide-react-native';
import { FilterBar, matches, Pill, type Tone } from '@/components/admin/AdminUi';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAdminUsers } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDate } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const ROLE_TONE: Record<string, Tone> = {
  client: 'gray',
  vendeur: 'primary',
  admin_boutique: 'primary',
  livreur: 'blue',
  administrateur: 'red',
  super_admin: 'red',
};
type Filter = 'all' | 'client' | 'vendeur' | 'livreur' | 'admin';
const inFilter = (role: string, f: Filter) =>
  f === 'all' ||
  (f === 'vendeur' ? ['vendeur', 'admin_boutique'].includes(role) : f === 'admin' ? ['administrateur', 'super_admin'].includes(role) : role === f);

/** Comptes de la plateforme (consultation) : rôle, contact, date d'inscription. */
export function AdminUsersScreen(_props: RootScreenProps<'AdminUsers'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const users = useAdminUsers();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const all = users.data ?? [];
  const items = useMemo(
    () => (users.data ?? []).filter((u) => inFilter(u.role, filter) && matches(query, u.name, u.email, u.phone)),
    [users.data, filter, query],
  );

  return (
    <Screen muted>
      <Header title={t('admin.users')} />
      <FilterBar
        query={query}
        onQuery={setQuery}
        placeholder={t('admin.searchUsers')}
        value={filter}
        onChange={setFilter}
        filters={(['all', 'client', 'vendeur', 'livreur', 'admin'] as Filter[]).map((k) => ({
          key: k,
          label: t(`admin.userFilter.${k}`),
          count: all.filter((u) => inFilter(u.role, k)).length,
        }))}
      />
      {users.isError && !users.data ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(u) => u.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          initialNumToRender={15}
          renderItem={({ item }) => (
            <View className="mx-4 mb-2.5 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-bold text-ink dark:text-gray-100">{item.name}</Text>
                  <Text className="text-xs text-ink-muted dark:text-gray-400">
                    {t('admin.memberSince', { date: formatDate(item.createdAt, lang) })}
                    {item.provider !== 'local' ? ` · ${item.provider}` : ''}
                  </Text>
                </View>
                <Pill label={t(`admin.role.${item.role}`, { defaultValue: item.role })} tone={ROLE_TONE[item.role] ?? 'gray'} />
              </View>
              <View className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2">
                <Pressable onPress={() => Linking.openURL(`mailto:${item.email}`)} className="flex-row items-center gap-1.5">
                  <Mail size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold text-primary">{item.email}</Text>
                </Pressable>
                {item.phone ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${item.phone}`)} className="flex-row items-center gap-1.5">
                    <Phone size={14} color={colors.primary} />
                    <Text className="text-xs font-semibold text-primary">{item.phone}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            users.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<Users size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={users.isRefetching}
              onRefresh={() => users.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
