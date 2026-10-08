import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Send } from 'lucide-react-native';
import { chatApi } from '@/api/account';
import { errorMessage } from '@/api/client';
import type { ChatMessage } from '@/api/types';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDateTime } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';
import { conversationsKey } from './ConversationsScreen';

const MAX_LENGTH = 1000;

/**
 * Fil de discussion avec une boutique. Les nouveaux messages sont relus
 * toutes les 6 s tant que l'écran est ouvert (comme sur le site) ; un
 * message envoyé apparaît tout de suite, avant la réponse du serveur.
 */
export function ChatScreen({ route }: RootScreenProps<'Chat'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const { conversationId, title } = route.params;
  const key = ['chat', conversationId] as const;
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);

  const messages = useQuery({
    queryKey: key,
    queryFn: () => chatApi.messages(conversationId),
    refetchInterval: 6000,
  });

  const send = useMutation({
    mutationFn: (body: string) => chatApi.send(conversationId, body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChatMessage[]>(key);
      const optimistic: ChatMessage = {
        id: `local-${Date.now()}`,
        body,
        sentAt: new Date().toISOString(),
        mine: true,
        read: false,
      };
      qc.setQueryData<ChatMessage[]>(key, [...(previous ?? []), optimistic]);
      return { previous };
    },
    onError: (err, body, ctx) => {
      qc.setQueryData(key, ctx?.previous);
      setDraft(body);
      toast(errorMessage(err, t('common.networkError')));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: conversationsKey });
    },
  });

  const count = messages.data?.length ?? 0;
  useEffect(() => {
    if (count) requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
  }, [count]);

  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft('');
    send.mutate(body);
  };

  return (
    <Screen muted edges={['top', 'bottom']}>
      <Header title={title} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={56}
      >
        {messages.isError && !messages.data ? (
          <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
        ) : messages.isLoading ? (
          <ActivityIndicator color={colors.primary} className="flex-1" />
        ) : (
          <FlatList
            ref={list}
            data={messages.data ?? []}
            keyExtractor={(m) => m.id}
            contentContainerClassName="px-4 py-3 gap-2 flex-grow"
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${item.mine ? 'self-end rounded-br-md bg-primary' : 'self-start rounded-bl-md bg-white dark:bg-surface-dark-card'}`}
              >
                <Text className={`text-[15px] leading-5 ${item.mine ? 'text-white' : 'text-ink dark:text-gray-100'}`}>
                  {item.body}
                </Text>
                <View className="mt-1 flex-row items-center justify-end gap-1">
                  <Text className={`text-2xs ${item.mine ? 'text-white/70' : 'text-ink-subtle'}`}>
                    {formatDateTime(item.sentAt, lang)}
                  </Text>
                  {item.mine && item.read ? (
                    <CheckCheck size={12} color="rgba(255,255,255,0.8)" accessibilityLabel={t('messages.read')} />
                  ) : null}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-8">
                <Text className="text-center text-sm text-ink-muted dark:text-gray-400">{t('messages.startHint')}</Text>
              </View>
            }
          />
        )}

        <View className="flex-row items-end gap-2 border-t border-gray-100 bg-white px-3 py-2.5 dark:border-gray-800 dark:bg-surface-dark">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('messages.placeholder')}
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={MAX_LENGTH}
            className="max-h-28 min-h-11 flex-1 rounded-2xl bg-surface-muted px-4 py-2.5 text-base text-ink dark:bg-surface-dark-muted dark:text-gray-100"
            accessibilityLabel={t('messages.placeholder')}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim()}
            className={`h-11 w-11 items-center justify-center rounded-full ${draft.trim() ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
            accessibilityRole="button"
            accessibilityLabel={t('messages.send')}
          >
            <Send size={19} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
