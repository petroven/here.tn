import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react-native';
import type { AuditEntry } from '@/api/admin';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAdminAudit } from '@/hooks/useAdmin';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** Champs modifiés entre l'état avant et après l'action. */
function changes(e: AuditEntry) {
  const keys = new Set([...Object.keys(e.before ?? {}), ...Object.keys(e.after ?? {})]);
  return [...keys]
    .filter((k) => JSON.stringify(e.before?.[k]) !== JSON.stringify(e.after?.[k]))
    .map((k) => ({ key: k, before: show(e.before?.[k]), after: show(e.after?.[k]) }));
}

/** Journal d'audit : qui a fait quoi, quand, et ce qui a changé. */
export function AdminAuditScreen(_props: RootScreenProps<'AdminAudit'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const audit = useAdminAudit();
  const items = audit.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen muted>
      <Header title={t('admin.audit')} />
      {audit.isError && !audit.data ? (
        <ErrorState error={audit.error} onRetry={() => audit.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          onEndReached={() => audit.hasNextPage && !audit.isFetchingNextPage && audit.fetchNextPage()}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <View className="mx-4 mb-2.5 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
              <Text className="font-bold text-ink dark:text-gray-100">
                {t(`admin.auditAction.${item.action.replace('.', '_')}`, { defaultValue: item.action })}
              </Text>
              <Text className="text-xs text-ink-muted dark:text-gray-400">
                {item.entity}
                {item.entityId ? ` #${item.entityId}` : ''} · {item.actor ?? '—'} · {formatDateTime(item.createdAt, lang)}
              </Text>
              {changes(item).map((c) => (
                <Text key={c.key} className="mt-1.5 text-xs text-ink dark:text-gray-200" numberOfLines={3}>
                  <Text className="font-semibold">{c.key}</Text> : {c.before} → {c.after}
                </Text>
              ))}
              {item.comment ? (
                <Text className="mt-1.5 text-xs italic text-ink-muted dark:text-gray-400">« {item.comment} »</Text>
              ) : null}
            </View>
          )}
          ListFooterComponent={audit.isFetchingNextPage ? <ActivityIndicator color={colors.primary} className="my-4" /> : null}
          ListEmptyComponent={
            audit.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState icon={<ScrollText size={40} color={colors.primary} />} title={t('admin.nothingHere')} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={audit.isRefetching && !audit.isFetchingNextPage}
              onRefresh={() => audit.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
