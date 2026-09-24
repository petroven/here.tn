import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Heart, MapPin, Package, Search, ShoppingBag, Tag, Truck, Wallet } from 'lucide-react-native';
import type { Banner, ProductFilters } from '@/api/types';
import { BannerCarousel } from '@/components/BannerCarousel';
import { BRAND_CREAM, BRAND_DARK, LogoWordmark } from '@/components/Logo';
import { CategoryItem } from '@/components/CategoryItem';
import { ProductRow } from '@/components/ProductGrid';
import { SectionHeader } from '@/components/SectionHeader';
import { Screen } from '@/components/ui/Screen';
import { ProductRowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useCart, useFavoriteIds, useHome, withFavorites } from '@/hooks/queries';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { TabScreenProps } from '@/navigation/types';

/**
 * Accueil : mêmes rubriques que la page d'accueil du site (catégories,
 * promotions, populaires, nouveautés). Connecté, un encart personnel reprend
 * le tableau de bord du site : solde, commandes, favoris, panier.
 */
export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const lang = useSettingsStore((s) => s.language);
  const home = useHome();
  const { data: favIds } = useFavoriteIds();
  const { data: cart } = useCart();
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
          onPress={() => navigation.navigate('Cart')}
          className="h-11 w-11 items-center justify-center rounded-full bg-surface-muted dark:bg-surface-dark-muted"
          accessibilityRole="button"
          accessibilityLabel={t('cart.title')}
        >
          <ShoppingBag size={22} color={colors.text} />
          {cart && cart.itemCount > 0 ? (
            <View className="absolute end-2 top-2 h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1">
              <Text className="text-2xs font-bold text-white">{cart.itemCount > 9 ? '9+' : cart.itemCount}</Text>
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
            {user ? (
              /* Espace personnel — même contenu que le tableau de bord du site */
              <View className="mx-4 overflow-hidden rounded-3xl p-4" style={{ backgroundColor: BRAND_DARK }}>
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
                    <Wallet size={18} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-white/60">{t('home.wallet')}</Text>
                    <Text className="text-lg font-extrabold text-white">{formatPrice(user.walletBalance ?? 0, lang)}</Text>
                  </View>
                </View>
                <View className="mt-4 flex-row gap-2">
                  {[
                    { icon: Package, label: t('profile.myOrders'), onPress: () => navigation.navigate('Orders') },
                    { icon: Heart, label: t('favorites.title'), onPress: () => navigation.navigate('Favorites') },
                    { icon: MapPin, label: t('profile.addresses'), onPress: () => navigation.navigate('Addresses') },
                  ].map(({ icon: Icon, label, onPress }) => (
                    <Pressable
                      key={label}
                      onPress={onPress}
                      className="flex-1 items-center gap-1.5 rounded-2xl bg-white/10 py-3 active:bg-white/20"
                      accessibilityRole="button"
                    >
                      <Icon size={20} color="#fff" />
                      <Text className="text-center text-xs font-semibold text-white" numberOfLines={1}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <BannerCarousel banners={data.banners} onPress={openBanner} />
            )}

            {/* Livraison */}
            <View className="mx-4 mt-4 flex-row items-center gap-2 rounded-2xl bg-primary-50 px-4 py-3 dark:bg-primary-900/30">
              <Truck size={18} color={colors.primary} />
              <Text className="flex-1 text-sm font-medium text-primary-700 dark:text-primary-300">{t('home.delivery')}</Text>
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
                    <Tag size={16} color={colors.primary} />
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
