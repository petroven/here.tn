import { useState } from 'react';
import { I18nManager, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Heart, Store, type LucideIcon } from 'lucide-react-native';
import type { Category } from '@/api/types';
import { CategoryIcon } from '@/components/CategoryItem';
import { BRAND_CREAM, BRAND_DARK, LogoWordmark } from '@/components/Logo';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useCategoriesWithPhotos } from '@/hooks/queries';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTheme } from '@/theme/useTheme';
import type { TabScreenProps } from '@/navigation/types';

/**
 * Catégories — équivalent du tiroir « Nos catégories » du site : raccourcis,
 * catégories avec photo et sous-catégories, puis « Devenez vendeur ».
 */
export function CategoriesScreen({ navigation }: TabScreenProps<'Categories'>) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const categories = useCategoriesWithPhotos();
  const requireAuth = useRequireAuth();
  const [open, setOpen] = useState<string | null>(null);
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  const openCategory = (c: Category) => navigation.navigate('CategoryProducts', { slug: c.slug, title: c.name });

  return (
    <Screen muted>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <Text className="text-2xl font-extrabold text-ink dark:text-gray-100">{t('categories.title')}</Text>
        <LogoWordmark height={20} color={isDark ? BRAND_CREAM : BRAND_DARK} />
      </View>

      <ScrollView
        contentContainerClassName="pb-10"
        refreshControl={
          <RefreshControl refreshing={categories.isRefetching} onRefresh={() => categories.refetch()} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Raccourcis */}
        <View className="mx-4 mb-4 flex-row gap-3">
          <QuickLink icon={Heart} label={t('favorites.title')} onPress={() => requireAuth(() => navigation.navigate('Favorites'))} />
          <QuickLink icon={Store} label={t('stores.title')} onPress={() => navigation.navigate('Stores')} />
        </View>

        <Text className="mb-2 px-4 text-xs font-bold uppercase tracking-wide text-ink-muted">{t('categories.ours')}</Text>

        {categories.isError && !categories.data ? (
          <ErrorState error={categories.error} onRetry={() => categories.refetch()} />
        ) : categories.isLoading ? (
          <View className="mx-4 gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </View>
        ) : (
          <View className="mx-4 gap-3">
            {(categories.data ?? []).map((c) => {
              const expanded = open === c.id;
              const hasChildren = (c.children?.length ?? 0) > 0;
              return (
                <View key={c.id} className="overflow-hidden rounded-2xl border border-[#E2D9CB] bg-white dark:border-gray-800 dark:bg-surface-dark-card">
                  <Pressable
                    onPress={() => (hasChildren ? setOpen(expanded ? null : c.id) : openCategory(c))}
                    className="flex-row items-center gap-3 p-3 active:bg-surface-page dark:active:bg-surface-dark-muted"
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900/30">
                      {c.imageUrl ? (
                        <Image source={{ uri: c.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <CategoryIcon name={c.icon} />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-bold text-ink dark:text-gray-100">{c.name}</Text>
                      {c.productCount ? (
                        <Text className="text-xs text-ink-muted">{t('stores.products', { count: c.productCount })}</Text>
                      ) : null}
                    </View>
                    {hasChildren ? (
                      expanded ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />
                    ) : (
                      <Chevron size={18} color={colors.subtle} />
                    )}
                  </Pressable>

                  {expanded ? (
                    <View className="border-t border-[#EFE7DA] px-3 pb-3 pt-2 dark:border-gray-800">
                      <Pressable onPress={() => openCategory(c)} className="flex-row items-center justify-between py-2.5">
                        <Text className="font-semibold text-primary">{t('categories.seeAll', { name: c.name })}</Text>
                        <Chevron size={16} color={colors.primary} />
                      </Pressable>
                      {c.children!.map((sub) => (
                        <Pressable key={sub.id} onPress={() => openCategory(sub)} className="flex-row items-center justify-between py-2.5">
                          <Text className="text-ink dark:text-gray-200">{sub.name}</Text>
                          <Chevron size={16} color={colors.subtle} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        {/* Devenez vendeur */}
        <Pressable
          onPress={() => navigation.navigate('BecomeVendor')}
          className="mx-4 mt-6 flex-row items-center gap-3 rounded-2xl bg-ink p-4 active:opacity-90"
          accessibilityRole="button"
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary">
            <Store size={20} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold text-cream">{t('vendor.cta')}</Text>
            <Text className="text-xs text-cream/70">{t('vendor.ctaText')}</Text>
          </View>
          <Chevron size={18} color={BRAND_CREAM} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function QuickLink({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-[#E2D9CB] bg-white px-3.5 py-3 active:opacity-80 dark:border-gray-800 dark:bg-surface-dark-card"
      accessibilityRole="button"
    >
      <Icon size={20} color={colors.primary} />
      <Text className="font-semibold text-ink dark:text-gray-100">{label}</Text>
    </Pressable>
  );
}
