import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Store } from 'lucide-react-native';
import { chatApi } from '@/api/account';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { timeAgo } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

export const conversationsKey = ['conversations'] as const;

/** Messagerie : une conversation par boutique contactée (mêmes fils que sur le site). */
export function ConversationsScreen({ navigation }: RootScreenProps<'Conversations'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const conversations = useQuery({
    queryKey: conversationsKey,
    queryFn: chatApi.conversations,
    refetchInterval: 30_000,
  });

  return (
    <Screen muted>
      <Header title={t('messages.title')} />
      {conversations.isError && !conversations.data ? (
        <ErrorState error={conversations.error} onRetry={() => conversations.refetch()} />
      ) : (
        <FlatList
          data={conversations.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: item.id,
                  title: item.peer.name,
                })
              }
              className="mx-4 mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white p-4 active:opacity-80 dark:bg-surface-dark-card"
              accessibilityRole="button"
            >
              {item.peer.logoUrl ? (
                <Image source={{ uri: item.peer.logoUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
                  <Store size={20} color={colors.primary} />
                </View>
              )}
              <View className="flex-1">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-bold text-ink dark:text-gray-100" numberOfLines={1}>
                    {item.peer.name}
                  </Text>
                  {item.lastMessageAt ? (
                    <Text className="text-xs text-ink-subtle">{timeAgo(item.lastMessageAt, lang)}</Text>
                  ) : null}
                </View>
                {item.subject ? (
                  <Text className="text-xs font-semibold text-primary" numberOfLines={1}>
                    {item.subject}
                  </Text>
                ) : null}
                <Text className="mt-0.5 text-sm text-ink-muted dark:text-gray-400" numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            conversations.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<MessageCircle size={40} color={colors.primary} />}
                title={t('messages.empty')}
                text={t('messages.emptyText')}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={conversations.isRefetching}
              onRefresh={() => conversations.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
