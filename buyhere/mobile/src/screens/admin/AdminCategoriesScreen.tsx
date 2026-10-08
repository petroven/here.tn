import { FlatList, RefreshControl, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react-native';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { adminKeys, useAdminCategories } from '@/hooks/useAdmin';
import { qk } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/** Photos des catégories principales (accueil du site et de l'app). */
export function AdminCategoriesScreen(_props: RootScreenProps<'AdminCategories'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const categories = useAdminCategories();

  const save = useMutation({
    mutationFn: ({ id, uri }: { id: string; uri: string | null }) => adminApi.setCategoryImage(id, uri),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.categories });
      // Accueil et onglet Catégories de l'app (photos mises en cache).
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: qk.categoriesWithPhotos });
      qc.invalidateQueries({ queryKey: ['home'] });
      toast(t('admin.saved'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const pick = async (id: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) save.mutate({ id, uri: result.assets[0].uri });
  };

  return (
    <Screen muted>
      <Header title={t('admin.categories')} />
      {categories.isError && !categories.data ? (
        <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
      ) : (
        <FlatList
          data={categories.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerClassName="p-4 pb-8"
          ListHeaderComponent={
            <Text className="mb-3 text-xs leading-5 text-ink-muted dark:text-gray-400">{t('admin.categoriesHint')}</Text>
          }
          renderItem={({ item }) => {
            const busy = save.isPending && save.variables?.id === item.id;
            return (
              <View className="mb-2.5 flex-row items-center gap-3 rounded-2xl bg-white p-3 dark:bg-surface-dark-card">
                <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary-50 dark:bg-primary-900/30">
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={{ width: 64, height: 64 }} contentFit="cover" />
                  ) : (
                    <LayoutGrid size={24} color={colors.primary} />
                  )}
                </View>
                <Text className="flex-1 text-sm font-bold text-ink dark:text-gray-100" numberOfLines={2}>
                  {item.name}
                </Text>
                <View className="gap-1.5">
                  <Button
                    title={t('admin.changePhoto')}
                    size="sm"
                    fullWidth={false}
                    loading={busy && save.variables?.uri !== null}
                    disabled={save.isPending}
                    onPress={() => pick(item.id)}
                  />
                  {item.imageUrl ? (
                    <Button
                      title={t('admin.removePhoto')}
                      size="sm"
                      variant="ghost"
                      fullWidth={false}
                      disabled={save.isPending}
                      onPress={() =>
                        confirm(
                          t('admin.removePhoto'),
                          t('admin.removePhotoText'),
                          { confirm: t('admin.removePhoto'), cancel: t('common.cancel') },
                          () => save.mutate({ id: item.id, uri: null }),
                        )
                      }
                    />
                  ) : null}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={categories.isLoading ? <ListItemSkeleton /> : null}
          refreshControl={
            <RefreshControl
              refreshing={categories.isRefetching}
              onRefresh={() => categories.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
