import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MessageSquare, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { ReviewItem } from '@/components/ReviewItem';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Stars } from '@/components/ui/Rating';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import { flattenPages, useAddReview, useReviews } from '@/hooks/queries';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/** Tous les avis d'un produit : répartition des notes, liste paginée, rédaction d'un avis. */
export function ReviewsScreen({ route }: RootScreenProps<'Reviews'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { productId, productName } = route.params;
  const reviews = useReviews(productId);
  const addReview = useAddReview(productId);
  const requireAuth = useRequireAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const items = flattenPages(reviews.data);
  const first = reviews.data?.pages[0];
  const total = first?.total ?? 0;
  const distribution = first?.distribution ?? {};
  const average = total
    ? Object.entries(distribution).reduce((s, [star, n]) => s + Number(star) * n, 0) / total
    : 0;

  const submit = () => {
    setError(null);
    addReview.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          setOpen(false);
          setComment('');
          toast(t('product.reviewThanks'));
        },
        onError: (err) => setError(errorMessage(err, t('common.networkError'))),
      },
    );
  };

  const summary = (
    <View className="mb-2 flex-row items-center gap-6 rounded-2xl bg-surface-muted p-4 dark:bg-surface-dark-card">
      <View className="items-center">
        <Text className="text-4xl font-extrabold text-ink dark:text-gray-100">{average.toFixed(1).replace('.', ',')}</Text>
        <Stars value={average} size={14} />
        <Text className="mt-1 text-xs text-ink-muted">{t('product.reviewsCount', { count: total })}</Text>
      </View>
      <View className="flex-1 gap-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = distribution[star] ?? 0;
          return (
            <View key={star} className="flex-row items-center gap-2">
              <Text className="w-3 text-xs text-ink-muted">{star}</Text>
              <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <View className="h-full rounded-full bg-primary" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen>
      <Header title={t('product.reviews')} />
      {reviews.isError && items.length === 0 ? (
        <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <ReviewItem review={item} />}
          contentContainerClassName="px-4 pb-28 pt-3"
          ListHeaderComponent={
            <>
              <Text className="mb-3 text-sm text-ink-muted dark:text-gray-400" numberOfLines={1}>
                {productName}
              </Text>
              {total > 0 ? summary : null}
            </>
          }
          ListEmptyComponent={
            reviews.isLoading ? (
              <View className="-mx-4">
                <ListItemSkeleton />
                <ListItemSkeleton />
              </View>
            ) : (
              <EmptyState icon={<MessageSquare size={40} color={colors.primary} />} title={t('product.noReviews')} />
            )
          }
          onEndReached={() => reviews.hasNextPage && !reviews.isFetchingNextPage && reviews.fetchNextPage()}
          ListFooterComponent={reviews.isFetchingNextPage ? <ActivityIndicator color={colors.primary} className="py-4" /> : null}
        />
      )}

      <SafeAreaView edges={['bottom']} className="absolute inset-x-0 bottom-0 bg-white px-4 pt-3 dark:bg-surface-dark">
        <Button title={t('product.writeReview')} variant="secondary" onPress={() => requireAuth(() => setOpen(true))} className="mb-2" />
      </SafeAreaView>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)} />
        <SafeAreaView edges={['bottom']} className="rounded-t-3xl bg-white px-5 pt-5 dark:bg-surface-dark-card">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink dark:text-gray-100">{t('product.writeReview')}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text className="mb-2 font-medium text-ink dark:text-gray-200">{t('product.yourRating')}</Text>
          <Stars value={rating} size={32} onChange={setRating} />
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('product.yourComment')}
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={1000}
            className="mt-4 min-h-[100px] rounded-2xl bg-surface-muted p-3.5 text-base text-ink dark:bg-surface-dark-muted dark:text-gray-100"
            style={{ textAlignVertical: 'top' }}
          />
          {error ? <Text className="mt-2 text-sm text-danger">{error}</Text> : null}
          <Button title={t('product.submitReview')} className="my-4" loading={addReview.isPending} onPress={submit} />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
