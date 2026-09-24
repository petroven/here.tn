import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BadgeCheck, MapPin, Package } from 'lucide-react-native';
import type { Store } from '@/api/types';
import { useTheme } from '@/theme/useTheme';

/** Logo carré de boutique, avec l'initiale en repli (comme sur le site). */
export function StoreLogo({ store, size }: { store: Pick<Store, 'name' | 'logoUrl'>; size: number }) {
  return (
    <View
      className="items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-primary-100 dark:border-surface-dark-card"
      style={{ width: size, height: size }}
    >
      {store.logoUrl ? (
        <Image source={{ uri: store.logoUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Text className="font-extrabold text-primary" style={{ fontSize: size * 0.38 }}>
          {store.name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/** Bannière de boutique : photo du vendeur, sinon dégradé charbon → terre. */
export function StoreBanner({ store, height }: { store: Pick<Store, 'bannerUrl'>; height: number }) {
  return store.bannerUrl ? (
    <Image source={{ uri: store.bannerUrl }} style={{ width: '100%', height, opacity: 0.85 }} contentFit="cover" />
  ) : (
    <LinearGradient colors={['#2A2622', '#6E2E19']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height }} />
  );
}

/** Carte boutique — même structure que BoutiqueCard du site (bannière, logo, infos, bouton). */
export function StoreCard({ store, onPress, width }: { store: Store; onPress: () => void; width?: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={width ? { width } : undefined}
      className="overflow-hidden rounded-2xl border border-[#E2D9CB] bg-white active:opacity-90 dark:border-gray-800 dark:bg-surface-dark-card"
      accessibilityRole="button"
      accessibilityLabel={store.name}
    >
      <View className="bg-ink">
        <StoreBanner store={store} height={110} />
        <View className="absolute -bottom-7 start-4">
          <StoreLogo store={store} size={60} />
        </View>
      </View>

      <View className="gap-3 p-4 pt-10">
        <View>
          <View className="flex-row items-center gap-1.5">
            <Text className="flex-shrink text-base font-extrabold text-ink dark:text-gray-100" numberOfLines={1}>
              {store.name}
            </Text>
            {store.verified ? <BadgeCheck size={16} color={colors.success} /> : null}
          </View>
          <Text className="mt-1 text-sm text-ink-muted dark:text-gray-400" numberOfLines={2}>
            {store.description || t('stores.defaultDescription')}
          </Text>
        </View>

        <View className="flex-row flex-wrap items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Package size={14} color={colors.muted} />
            <Text className="text-xs font-semibold text-ink-muted">{t('stores.products', { count: store.productCount })}</Text>
          </View>
          {store.governorate ? (
            <View className="flex-row items-center gap-1">
              <MapPin size={14} color={colors.muted} />
              <Text className="text-xs font-semibold text-ink-muted">{store.governorate}</Text>
            </View>
          ) : null}
          {store.category ? (
            <View className="rounded-full bg-surface-muted px-2 py-0.5 dark:bg-surface-dark-muted">
              <Text className="text-xs font-semibold text-ink-muted">{store.category}</Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3">
          <Text className="text-sm font-bold text-white">{t('stores.visit')}</Text>
          <ArrowRight size={16} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}
