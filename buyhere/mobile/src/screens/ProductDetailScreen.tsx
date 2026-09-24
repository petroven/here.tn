import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  I18nManager,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Heart,
  RotateCcw,
  Share2,
  ShoppingBag,
  Store,
  Truck,
  Zap,
} from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import type { ProductVariant } from '@/api/types';
import { FlashCountdown } from '@/components/FlashCountdown';
import { ProductRow } from '@/components/ProductGrid';
import { ReviewItem } from '@/components/ReviewItem';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Price } from '@/components/ui/Price';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { RatingBadge } from '@/components/ui/Rating';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import {
  flattenPages,
  useAddToCart,
  useFavoriteIds,
  useProduct,
  useReviews,
  useToggleFavorite,
  withFavorites,
} from '@/hooks/queries';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/** Détail produit : galerie, prix TND, variantes taille/couleur, avis et ajout au panier. */
export function ProductDetailScreen({ route, navigation }: RootScreenProps<'ProductDetail'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const product = useProduct(route.params.idOrSlug);
  const p = product.data;
  const reviews = useReviews(p?.id ?? '');
  const { data: favIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const addToCart = useAddToCart();
  const requireAuth = useRequireAuth();

  const [imageIndex, setImageIndex] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [variantError, setVariantError] = useState(false);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setImageIndex(viewableItems[0].index);
  }).current;

  const hasVariants = (p?.variants.length ?? 0) > 0;
  const needsSize = (p?.options.sizes.length ?? 0) > 0;
  const needsColor = (p?.options.colors.length ?? 0) > 0;

  /** Variante correspondant à la sélection courante (null si incomplète). */
  const selected: ProductVariant | null = useMemo(() => {
    if (!p || !hasVariants) return null;
    if ((needsSize && !size) || (needsColor && !color)) return null;
    return p.variants.find((v) => (!needsSize || v.size === size) && (!needsColor || v.color === color)) ?? null;
  }, [p, hasVariants, needsSize, needsColor, size, color]);

  // Disponibilité d'une option compte tenu de l'autre option choisie.
  const sizeAvailable = (s: string) =>
    !!p?.variants.some((v) => v.size === s && v.stock > 0 && (!color || v.color === color));
  const colorAvailable = (c: string) =>
    !!p?.variants.some((v) => v.color === c && v.stock > 0 && (!size || v.size === size));

  if (product.isError) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
        <ErrorState error={product.error} onRetry={() => product.refetch()} />
      </SafeAreaView>
    );
  }

  const isFavorite = p ? (favIds?.has(p.id) ?? p.isFavorite) : false;
  const price = selected?.price ?? p?.price ?? 0;
  const stock = hasVariants ? (selected?.stock ?? null) : (p?.stock ?? 0);
  const maxQty = Math.max(1, Math.min(10, stock ?? 10));
  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const reviewList = flattenPages(reviews.data).slice(0, 3);

  const onAdd = () =>
    requireAuth(() => {
      if (!p) return;
      if (hasVariants && !selected) {
        setVariantError(true);
        return;
      }
      addToCart.mutate(
        { productId: p.id, variantId: selected?.id ?? null, quantity },
        {
          onSuccess: () => toast(t('product.added')),
          onError: (err) => toast(errorMessage(err, t('common.networkError'))),
        },
      );
    });

  const onShare = () => p && Share.share({ message: `${p.name} — BuyHere` });

  return (
    <View className="flex-1 bg-white dark:bg-surface-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-28">
        {/* Galerie d'images */}
        <View style={{ width, height: width * 1.05 }} className="bg-surface-muted dark:bg-surface-dark-muted">
          {p ? (
            <FlatList
              data={p.images}
              keyExtractor={(i) => i.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewable}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              renderItem={({ item }) => (
                <Image source={{ uri: item.url }} style={{ width, height: width * 1.05 }} contentFit="cover" transition={200} />
              )}
            />
          ) : (
            <Skeleton style={{ width, height: width * 1.05 }} className="rounded-none" />
          )}

          {/* Boutons flottants */}
          <SafeAreaView edges={['top']} className="absolute inset-x-0 top-0 flex-row justify-between px-4 pt-2">
            <Pressable
              onPress={() => navigation.goBack()}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-black/60"
              accessibilityLabel={t('common.back')}
            >
              <BackIcon size={24} color={colors.text} />
            </Pressable>
            <View className="flex-row gap-2">
              <Pressable
                onPress={onShare}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-black/60"
                accessibilityLabel="Partager"
              >
                <Share2 size={19} color={colors.text} />
              </Pressable>
              <Pressable
                onPress={() => p && requireAuth(() => toggleFavorite.mutate({ productId: p.id, favorite: !isFavorite }))}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/90 dark:bg-black/60"
                accessibilityLabel={t('tabs.favorites')}
                accessibilityState={{ selected: isFavorite }}
              >
                <Heart size={20} color={isFavorite ? colors.primary : colors.text} fill={isFavorite ? colors.primary : 'transparent'} />
              </Pressable>
            </View>
          </SafeAreaView>

          {p && p.images.length > 1 ? (
            <View className="absolute bottom-4 w-full flex-row justify-center gap-1.5">
              {p.images.map((img, i) => (
                <View key={img.id} className={`h-1.5 rounded-full ${i === imageIndex ? 'w-5 bg-primary' : 'w-1.5 bg-white/80'}`} />
              ))}
            </View>
          ) : null}
        </View>

        {!p ? (
          <View className="gap-3 p-4">
            <Skeleton className="h-6 w-10/12" />
            <Skeleton className="h-4 w-4/12" />
            <Skeleton className="h-8 w-5/12" />
            <Skeleton className="mt-4 h-24 w-full" />
          </View>
        ) : (
          <View className="px-4 pt-4">
            {/* Offre flash */}
            {p.isFlash ? (
              <View className="mb-3 flex-row items-center justify-between rounded-2xl bg-primary px-4 py-2.5">
                <View className="flex-row items-center gap-1.5">
                  <Zap size={16} color="#fff" fill="#fff" />
                  <Text className="font-bold text-white">{t('home.flashSales')}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-white/90">{t('home.endsIn')}</Text>
                  <View className="rounded-lg bg-white/95 px-1.5 py-1">
                    <FlashCountdown endsAt={p.flashEndsAt} />
                  </View>
                </View>
              </View>
            ) : null}

            {p.brand ? <Text className="text-xs font-semibold uppercase tracking-wide text-primary">{p.brand}</Text> : null}
            <Text className="mt-1 text-xl font-bold leading-7 text-ink dark:text-gray-100">{p.name}</Text>

            <View className="mt-2 flex-row items-center gap-3">
              <RatingBadge rating={p.rating} count={p.ratingCount} />
              {p.soldCount > 0 ? <Text className="text-xs text-ink-muted">{t('product.sold', { count: p.soldCount })}</Text> : null}
            </View>

            <View className="mt-3 flex-row items-center gap-2">
              <Price value={price} compareAt={p.compareAt ? p.compareAt + (price - p.price) : null} size="xl" />
              {p.discountPercent > 0 ? (
                <View className="rounded-lg bg-primary-50 px-2 py-0.5 dark:bg-primary-900/40">
                  <Text className="text-xs font-bold text-primary">-{p.discountPercent}%</Text>
                </View>
              ) : null}
            </View>

            {/* Stock */}
            <Text
              className={`mt-2 text-sm font-medium ${
                !p.inStock || stock === 0 ? 'text-danger' : stock !== null && stock <= 5 ? 'text-warning' : 'text-success'
              }`}
            >
              {!p.inStock || stock === 0
                ? t('product.outOfStock')
                : stock !== null && stock <= 5
                  ? t('product.lowStock', { count: stock })
                  : t('product.inStock')}
            </Text>

            {/* Variantes */}
            {needsColor ? (
              <View className="mt-5">
                <Text className="mb-2.5 font-semibold text-ink dark:text-gray-100">
                  {t('product.color')}
                  {color ? <Text className="font-normal text-ink-muted"> : {color}</Text> : null}
                </Text>
                <View className="flex-row flex-wrap gap-3">
                  {p.options.colors.map((c) => {
                    const available = colorAvailable(c.name);
                    const active = color === c.name;
                    const select = () => {
                      setColor(active ? null : c.name);
                      setVariantError(false);
                    };
                    // Les variantes du site n'ont qu'un nom de couleur (pas de code hex) : puce texte.
                    if (!c.hex) {
                      return <Chip key={c.name} label={c.name} selected={active} disabled={!available && !active} onPress={select} />;
                    }
                    return (
                      <Pressable
                        key={c.name}
                        onPress={() => {
                          setColor(active ? null : c.name);
                          setVariantError(false);
                        }}
                        disabled={!available && !active}
                        className={`h-10 w-10 items-center justify-center rounded-full border-2 ${
                          active ? 'border-primary' : 'border-transparent'
                        } ${!available ? 'opacity-30' : ''}`}
                        accessibilityRole="radio"
                        accessibilityLabel={c.name}
                        accessibilityState={{ selected: active, disabled: !available }}
                      >
                        <View
                          className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-600"
                          style={{ backgroundColor: c.hex ?? '#ccc' }}
                        />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {needsSize ? (
              <View className="mt-5">
                <Text className="mb-2.5 font-semibold text-ink dark:text-gray-100">{t('product.size')}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {p.options.sizes.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      selected={size === s}
                      disabled={!sizeAvailable(s) && size !== s}
                      onPress={() => {
                        setSize(size === s ? null : s);
                        setVariantError(false);
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {variantError ? <Text className="mt-2 text-sm text-danger">{t('product.chooseVariant')}</Text> : null}

            <View className="mt-5 flex-row items-center justify-between">
              <Text className="font-semibold text-ink dark:text-gray-100">{t('product.quantity')}</Text>
              <QuantityStepper value={Math.min(quantity, maxQty)} max={maxQty} onChange={setQuantity} />
            </View>

            {/* Garanties */}
            <View className="mt-5 gap-3 rounded-2xl bg-surface-muted p-4 dark:bg-surface-dark-card">
              {[
                { icon: Truck, text: t('product.delivery') },
                { icon: Banknote, text: t('product.cod') },
                { icon: RotateCcw, text: t('product.returns') },
              ].map(({ icon: Icon, text }) => (
                <View key={text} className="flex-row items-center gap-3">
                  <Icon size={18} color={colors.primary} />
                  <Text className="flex-1 text-sm text-ink dark:text-gray-200">{text}</Text>
                </View>
              ))}
            </View>

            {/* Vendu par — lien vers la page boutique, comme sur le site */}
            {p.store ? (
              <Pressable
                onPress={() => navigation.navigate('Store', { storeId: p.store!.id })}
                className="mt-4 flex-row items-center gap-3 rounded-2xl border border-[#E2D9CB] p-3.5 active:opacity-80 dark:border-gray-800"
                accessibilityRole="button"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
                  <Store size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-ink-muted">{t('product.soldBy')}</Text>
                  <Text className="font-bold text-ink dark:text-gray-100">{p.store.name}</Text>
                </View>
                <Text className="text-sm font-semibold text-primary">{t('stores.visit')}</Text>
              </Pressable>
            ) : null}

            {/* Description */}
            <View className="mt-6">
              <Text className="mb-2 text-lg font-bold text-ink dark:text-gray-100">{t('product.description')}</Text>
              <Text className="text-sm leading-6 text-ink-muted dark:text-gray-300" numberOfLines={expanded ? undefined : 4}>
                {p.description}
              </Text>
              {p.description.length > 180 ? (
                <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8} className="mt-1">
                  <Text className="font-semibold text-primary">{expanded ? '−' : '+'}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Avis */}
            <View className="mt-6">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-ink dark:text-gray-100">
                  {t('product.reviews')} <Text className="text-sm font-normal text-ink-muted">({p.ratingCount})</Text>
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('Reviews', { productId: p.id, productName: p.name })}
                  hitSlop={8}
                >
                  <Text className="text-sm font-semibold text-primary">
                    {p.ratingCount > 0 ? t('product.seeAllReviews') : t('product.writeReview')}
                  </Text>
                </Pressable>
              </View>
              {reviewList.length === 0 ? (
                <Text className="mt-3 text-sm text-ink-muted">{t('product.noReviews')}</Text>
              ) : (
                reviewList.map((r) => <ReviewItem key={r.id} review={r} />)
              )}
            </View>
          </View>
        )}

        {p && p.similar.length > 0 ? (
          <View className="mt-7">
            <SectionHeader title={t('product.similar')} />
            <ProductRow products={withFavorites(p.similar, favIds)} />
          </View>
        ) : null}
      </ScrollView>

      {/* Barre d'action fixe */}
      {p ? (
        <SafeAreaView
          edges={['bottom']}
          className="absolute inset-x-0 bottom-0 border-t border-gray-100 bg-white px-4 pt-3 dark:border-gray-800 dark:bg-surface-dark"
        >
          <View className="flex-row items-center gap-3 pb-2">
            <Pressable
              onPress={() => navigation.navigate('Main', { screen: 'Cart' })}
              className="h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700"
              accessibilityLabel={t('product.viewCart')}
            >
              <ShoppingBag size={22} color={colors.text} />
            </Pressable>
            <View className="flex-1">
              <Button
                title={p.inStock && stock !== 0 ? t('product.addToCart') : t('product.outOfStock')}
                size="lg"
                disabled={!p.inStock || stock === 0}
                loading={addToCart.isPending}
                onPress={onAdd}
              />
            </View>
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}
