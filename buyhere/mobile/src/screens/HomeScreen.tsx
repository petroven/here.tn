import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bell, Search, Truck, Zap } from 'lucide-react-native';
import type { Banner, ProductFilters } from '@/api/types';
import { BannerCarousel } from '@/components/BannerCarousel';
import { BRAND_CREAM, BRAND_DARK, LogoWordmark } from '@/components/Logo';
import { CategoryItem } from '@/components/CategoryItem';
import { FlashCountdown } from '@/components/FlashCountdown';
import { ProductRow } from '@/components/ProductGrid';
import { SectionHeader } from '@/components/SectionHeader';
import { Screen } from '@/components/ui/Screen';
import { ProductRowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useFavoriteIds, useHome, useUnreadCount, withFavorites } from '@/hooks/queries';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { TabScreenProps } from '@/navigation/types';

/** Accueil : bannières, catégories, offres flash, populaires et nouveautés. */
export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const lang = useSettingsStore((s) => s.language);
  const home = useHome();
  const { data: favIds } = useFavoriteIds();
  const { data: unread = 0 } = useUnreadCount();
  const data = home.data;

  const openBanner = (banner: Banner) => {
    const [kind, slug] = (banner.target ?? '').split(':');
    if (kind === 'product' && slug) navigation.navigate('ProductDetail', { idOrSlug: slug });
    else if (kind === 'category' && slug) navigation.navigate('CategoryProducts', { slug, title: banner.title });
  };

  const seeAll = (title: string, filters: ProductFilters) =>
    navigation.navigate('CategoryProducts', { title, filters });

  if (home.isError && !data) {
    return (
      <Screen>
        <ErrorState error={home.error} onRetry={() => home.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* En-tête : salutation + notifications */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <View className="flex-1">
          <Text className="text-xs text-ink-muted dark:text-gray-400">
            {user ? t('home.greeting', { name: user.firstName }) : t('home.greetingGuest')}
          </Text>
          <View className="mt-1">
            <LogoWordmark height={26} color={isDark ? BRAND_CREAM : BRAND_DARK} />
          </View>
        </View>
        <Pressable
          onPress={() => (user ? navigation.navigate('Notifications') : navigation.navigate('Login', { redirect: 'back' }))}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface-muted dark:bg-surface-dark-muted"
          accessibilityRole="button"
          accessibilityLabel={t('notifications.title')}
        >
          <Bell size={22} color={colors.text} />
          {unread > 0 ? (
            <View className="absolute end-2 top-2 h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-2xs font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={() => home.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerClassName="pb-8"
      >
        {/* Fausse barre de recherche : ouvre l'onglet Recherche */}
        <Pressable
          onPress={() => navigation.navigate('Search', { focus: true })}
          className="mx-4 mb-4 mt-1 h-12 flex-row items-center gap-2.5 rounded-2xl bg-surface-muted px-4 dark:bg-surface-dark-muted"
          accessibilityRole="search"
        >
          <Search size={19} color={colors.muted} />
          <Text className="text-ink-subtle">{t('home.searchPlaceholder')}</Text>
        </Pressable>

        {home.isLoading ? (
          <>
            <Skeleton className="mx-4 h-40 rounded-3xl" />
            <View className="mt-6 flex-row gap-4 px-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-16 rounded-2xl" />
              ))}
            </View>
            <Skeleton className="mx-4 mb-3 mt-8 h-5 w-40" />
            <ProductRowSkeleton />
          </>
        ) : data ? (
          <>
            <BannerCarousel banners={data.banners} onPress={openBanner} />

            {/* Livraison offerte */}
            <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-2xl bg-primary-50 px-4 py-3 dark:bg-primary-900/30">
              <Truck size={18} color={colors.primary} />
              <Text className="flex-1 text-sm font-medium text-primary-700 dark:text-primary-300">
                {t('home.freeShipping', { amount: formatPrice(150000, lang) })}
              </Text>
            </View>

            {/* Catégories */}
            <View className="mt-6">
              <SectionHeader title={t('home.categories')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
                {data.categories.map((c) => (
                  <CategoryItem
                    key={c.id}
                    category={c}
                    onPress={() => navigation.navigate('CategoryProducts', { slug: c.slug, title: c.name })}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Offres flash */}
            {data.flash.length > 0 ? (
              <View className="mt-7">
                <SectionHeader
                  title={t('home.flashSales')}
                  extra={
                    <View className="flex-row items-center gap-1.5">
                      <Zap size={16} color={colors.primary} fill={colors.primary} />
                      <FlashCountdown endsAt={data.flashEndsAt} />
                    </View>
                  }
                  onSeeAll={() => seeAll(t('home.flashSales'), { flash: true })}
                />
                <ProductRow products={withFavorites(data.flash, favIds)} />
              </View>
            ) : null}

            <View className="mt-5">
              <SectionHeader
                title={t('home.popular')}
                onSeeAll={() => seeAll(t('home.popular'), { featured: true, sort: 'popular' })}
              />
              <ProductRow products={withFavorites(data.popular, favIds)} />
            </View>

            <View className="mt-5">
              <SectionHeader
                title={t('home.newArrivals')}
                onSeeAll={() => seeAll(t('home.newArrivals'), { sort: 'newest' })}
              />
              <ProductRow products={withFavorites(data.newest, favIds)} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
