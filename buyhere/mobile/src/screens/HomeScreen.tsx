import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  Heart,
  MapPin,
  Package,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import type { Category, ProductFilters, Store as StoreType } from '@/api/types';
import { CategoryIcon } from '@/components/CategoryItem';
import { BRAND_CREAM, BRAND_DARK, LogoWordmark } from '@/components/Logo';
import { ProductRow } from '@/components/ProductGrid';
import { SectionHeader } from '@/components/SectionHeader';
import { StoreCard } from '@/components/StoreCard';
import { Screen } from '@/components/ui/Screen';
import { ProductRowSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { useCart, useCategoriesWithPhotos, useFavoriteIds, useHome, useStores, withFavorites } from '@/hooks/queries';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { TabScreenProps } from '@/navigation/types';

/** Même photo que le bandeau d'accueil du site (client/src/App.jsx). */
const HERO_IMAGE = 'https://images.unsplash.com/photo-1781455816406-c3dead3a643e?fm=jpg&q=80&w=1200&auto=format&fit=crop';

/**
 * Accueil — mêmes rubriques, dans le même ordre, que la page d'accueil du site :
 * bandeau (ou espace personnel une fois connecté), catégories principales,
 * promotions, produits populaires, nouveautés, boutiques, vendeurs, confiance.
 */
export function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const lang = useSettingsStore((s) => s.language);
  const home = useHome();
  const categories = useCategoriesWithPhotos();
  const stores = useStores();
  const { data: favIds } = useFavoriteIds();
  const { data: cart } = useCart();
  const data = home.data;
  const isClient = user?.role === 'client';

  const seeAll = (title: string, filters: ProductFilters) => navigation.navigate('CategoryProducts', { title, filters });
  const openCategory = (c: Category) => navigation.navigate('CategoryProducts', { slug: c.slug, title: c.name });
  const openStore = (s: StoreType) => navigation.navigate('Store', { storeId: s.id });
  const sellers = (stores.data ?? []).filter((s) => s.seller);

  const refresh = () => {
    home.refetch();
    categories.refetch();
    stores.refetch();
  };

  if (home.isError && !data) {
    return (
      <Screen>
        <ErrorState error={home.error} onRetry={() => home.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen muted>
      {/* En-tête : logo + panier */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <LogoWordmark height={26} color={isDark ? BRAND_CREAM : BRAND_DARK} />
        <Pressable
          onPress={() => navigation.navigate('Cart')}
          className="h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-surface-dark-muted"
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
        refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        contentContainerClassName="pb-10"
      >
        {user ? (
          /* Espace personnel — tableau de bord du site pour un client connecté */
          <View className="mx-4 mt-1 overflow-hidden rounded-3xl p-5" style={{ backgroundColor: BRAND_DARK }}>
            <Text className="text-xs font-semibold uppercase tracking-wider text-primary-300">{t('home.yourSpace')}</Text>
            <Text className="mt-1 text-2xl font-extrabold text-white">{t('home.hello', { name: user.firstName })} 👋</Text>
            <SearchBar onPress={() => navigation.navigate('Search', { focus: true })} placeholder={t('home.searchToday')} />
            {isClient ? (
              <>
                <View className="mt-4 flex-row items-center gap-3 rounded-2xl bg-white/10 p-3.5">
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
                    <Wallet size={18} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-white/60">{t('home.wallet')}</Text>
                    <Text className="text-lg font-extrabold text-white">{formatPrice(user.walletBalance ?? 0, lang)}</Text>
                  </View>
                </View>
                <View className="mt-3 flex-row gap-2">
                  <DashAction icon={Package} label={t('profile.myOrders')} onPress={() => navigation.navigate('Orders')} />
                  <DashAction icon={Heart} label={t('favorites.title')} onPress={() => navigation.navigate('Favorites')} />
                  <DashAction icon={MapPin} label={t('profile.addresses')} onPress={() => navigation.navigate('Addresses')} />
                </View>
              </>
            ) : null}
          </View>
        ) : (
          /* Bandeau visiteur — même message et mêmes boutons que le site */
          <View className="mx-4 mt-1 overflow-hidden rounded-3xl bg-primary">
            <Image source={{ uri: HERO_IMAGE }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
            <LinearGradient
              colors={['rgba(196,83,44,0.97)', 'rgba(196,83,44,0.85)', 'rgba(110,46,25,0.55)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 20 }}
            >
              <View className="flex-row items-center gap-1.5 self-start rounded-full bg-white/15 px-3 py-1">
                <Sparkles size={13} color="#fff" />
                <Text className="text-xs font-semibold text-white">{t('home.heroBadge')}</Text>
              </View>
              <Text className="mt-4 text-3xl font-extrabold leading-9 text-white">{t('home.heroTitle')}</Text>
              <Text className="mt-2 text-sm leading-5 text-white/85">{t('home.heroText')}</Text>
              <SearchBar onPress={() => navigation.navigate('Search', { focus: true })} placeholder={t('home.searchPlaceholder')} />
              <View className="mt-4 flex-row gap-2.5">
                <Pressable onPress={() => seeAll(t('home.catalogue'), { sort: 'newest' })} className="flex-1 items-center rounded-xl bg-white py-3 active:opacity-90">
                  <Text className="text-sm font-bold text-primary-700">{t('home.discover')}</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('BecomeVendor')} className="flex-1 items-center rounded-xl border border-white/50 py-3 active:bg-white/10">
                  <Text className="text-sm font-bold text-white">{t('vendor.cta')}</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Catégories principales — photos rondes, comme sur le site */}
        <View className="mt-7">
          <SectionHeader title={t('home.mainCategories')} onSeeAll={() => navigation.navigate('Categories')} />
          {categories.isLoading ? (
            <View className="flex-row gap-4 px-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[72px] w-[72px] rounded-full" />
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
              {(categories.data ?? data?.categories ?? []).map((c) => (
                <Pressable key={c.id} onPress={() => openCategory(c)} className="w-[78px] items-center active:opacity-80" accessibilityRole="button">
                  <View className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary-100 dark:border-surface-dark-card dark:bg-primary-900/30">
                    {c.imageUrl ? (
                      <Image source={{ uri: c.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <CategoryIcon name={c.icon} />
                    )}
                  </View>
                  <Text className="mt-1.5 text-center text-xs font-bold text-ink dark:text-gray-200" numberOfLines={2}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {home.isLoading ? (
          <>
            <Skeleton className="mx-4 mb-3 mt-8 h-5 w-40" />
            <ProductRowSkeleton />
          </>
        ) : data ? (
          <>
            {data.flash.length > 0 ? (
              <View className="mt-7">
                <SectionHeader
                  title={t('home.flashSales')}
                  extra={<Tag size={16} color={colors.primary} />}
                  onSeeAll={() => seeAll(t('home.flashSales'), { flash: true })}
                />
                <ProductRow products={withFavorites(data.flash, favIds)} />
              </View>
            ) : null}

            <View className="mt-5">
              <SectionHeader
                title={isClient ? t('home.recommended') : t('home.popular')}
                onSeeAll={() => seeAll(t('home.popular'), { sort: 'popular' })}
              />
              <ProductRow products={withFavorites(data.popular, favIds)} />
            </View>

            <View className="mt-5">
              <SectionHeader title={t('home.newArrivals')} onSeeAll={() => seeAll(t('home.newArrivals'), { sort: 'newest' })} />
              <ProductRow products={withFavorites(data.newest, favIds)} />
            </View>
          </>
        ) : null}

        {/* Découvrez nos boutiques */}
        {stores.data && stores.data.length > 0 ? (
          <View className="mt-5">
            <SectionHeader title={t('home.ourStores')} onSeeAll={() => navigation.navigate('Stores')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4">
              {stores.data.slice(0, 5).map((s) => (
                <StoreCard key={s.id} store={s} width={270} onPress={() => openStore(s)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Derrière chaque boutique, une personne */}
        {sellers.length > 0 ? (
          <View className="mt-7">
            <SectionHeader title={t('home.sellers')} />
            <View className="flex-row flex-wrap gap-3 px-4">
              {sellers.slice(0, 4).map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => openStore(s)}
                  className="items-center gap-2 rounded-2xl border border-[#E2D9CB] bg-white p-4 active:opacity-80 dark:border-gray-800 dark:bg-surface-dark-card"
                  style={{ width: '47.5%' }}
                >
                  <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary-100">
                    {s.seller!.photoUrl ? (
                      <Image source={{ uri: s.seller!.photoUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text className="text-sm font-extrabold text-primary">
                        {s.seller!.firstName.charAt(0)}
                        {s.seller!.lastName.charAt(0)}
                      </Text>
                    )}
                  </View>
                  <Text className="text-sm font-bold text-ink dark:text-gray-100">{s.seller!.firstName}</Text>
                  <Text className="text-xs text-ink-muted" numberOfLines={1}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Confiance — pour les visiteurs, comme sur le site */}
        {!isClient ? (
          <View className="mx-4 mt-7 gap-3">
            <TrustItem icon={ShieldCheck} title={t('home.trust1Title')} text={t('home.trust1Text')} />
            <TrustItem icon={PackageCheck} title={t('home.trust2Title')} text={t('home.trust2Text')} />
            <TrustItem icon={Store} title={t('home.trust3Title')} text={t('home.trust3Text')} />
            <TrustItem icon={Truck} title={t('home.trust4Title')} text={t('home.trust4Text')} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SearchBar({ onPress, placeholder }: { onPress: () => void; placeholder: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="mt-4 h-12 flex-row items-center gap-2.5 rounded-xl bg-white px-4"
      accessibilityRole="search"
    >
      <Search size={18} color={colors.muted} />
      <Text className="text-ink-subtle">{placeholder}</Text>
    </Pressable>
  );
}

function DashAction({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center gap-1.5 rounded-2xl bg-white/10 py-3 active:bg-white/20" accessibilityRole="button">
      <Icon size={20} color="#fff" />
      <Text className="text-center text-xs font-semibold text-white" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function TrustItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row gap-3 rounded-2xl border border-[#E2D9CB] bg-white p-4 dark:border-gray-800 dark:bg-surface-dark-card">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
        <Icon size={20} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-ink dark:text-gray-100">{title}</Text>
        <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">{text}</Text>
      </View>
    </View>
  );
}
