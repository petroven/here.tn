import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Heart, Zap } from 'lucide-react-native';
import type { ProductCard as ProductCardType } from '@/api/types';
import { useToggleFavorite } from '@/hooks/queries';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useTheme } from '@/theme/useTheme';
import { Price } from './ui/Price';
import { RatingBadge } from './ui/Rating';

type Props = { product: ProductCardType; width: number };

/** Carte produit : image, badge remise/flash, cœur favori, nom, note et prix. */
export const ProductCard = memo(function ProductCard({ product, width }: Props) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const toggleFavorite = useToggleFavorite();
  const requireAuth = useRequireAuth();

  const onFavorite = () =>
    requireAuth(() => toggleFavorite.mutate({ productId: product.id, favorite: !product.isFavorite }));

  return (
    <Pressable
      style={{ width }}
      className="mb-4 active:opacity-90"
      onPress={() => navigation.navigate('ProductDetail', { idOrSlug: product.slug })}
      accessibilityRole="button"
      accessibilityLabel={product.name}
    >
      <View
        className="overflow-hidden rounded-2xl bg-surface-muted dark:bg-surface-dark-muted"
        style={{ width, height: width * 1.15 }}
      >
        <Image
          source={product.imageUrl ? { uri: product.imageUrl } : undefined}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          recyclingKey={product.id}
        />

        {product.discountPercent > 0 ? (
          <View className="absolute start-2 top-2 flex-row items-center gap-0.5 rounded-lg bg-primary px-1.5 py-0.5">
            {product.isFlash ? <Zap size={11} color="#fff" fill="#fff" /> : null}
            <Text className="text-2xs font-bold text-white">-{product.discountPercent}%</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onFavorite}
          hitSlop={8}
          className="absolute end-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm dark:bg-black/60"
          accessibilityRole="button"
          accessibilityLabel={t('tabs.favorites')}
          accessibilityState={{ selected: product.isFavorite }}
        >
          <Heart
            size={17}
            color={product.isFavorite ? colors.primary : colors.text}
            fill={product.isFavorite ? colors.primary : 'transparent'}
          />
        </Pressable>

        {!product.inStock ? (
          <View className="absolute bottom-0 w-full bg-black/55 py-1">
            <Text className="text-center text-xs font-semibold text-white">{t('product.outOfStock')}</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-2 text-sm leading-5 text-ink dark:text-gray-100" numberOfLines={2}>
        {product.name}
      </Text>
      <View className="mt-1">
        <RatingBadge rating={product.rating} count={product.ratingCount} />
      </View>
      <Price value={product.price} compareAt={product.compareAt} size="md" className="mt-1" />
    </Pressable>
  );
});
