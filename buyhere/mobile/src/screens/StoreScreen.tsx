import { useMemo, useState } from 'react';
import { I18nManager, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ChevronLeft, ChevronRight, MapPin, Package, Search, Star, Truck } from 'lucide-react-native';
import type { StoreDetail } from '@/api/types';
import { ProductCard } from '@/components/ProductCard';
import { StoreBanner, StoreLogo } from '@/components/StoreCard';
import { Input } from '@/components/ui/Input';
import { Stars } from '@/components/ui/Rating';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useFavoriteIds, useStore, withFavorites } from '@/hooks/queries';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDate } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

type Tab = 'products' | 'about' | 'reviews';

const H_PADDING = 16;
const GAP = 12;

/** Page boutique — onglets Produits / À propos / Avis, comme /boutiques/:id sur le site. */
export function StoreScreen({ route, navigation }: RootScreenProps<'Store'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const store = useStore(route.params.storeId);
  const { data: favIds } = useFavoriteIds();
  const [tab, setTab] = useState<Tab>('products');
  const [search, setSearch] = useState('');
  const s = store.data;
  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;
  const cardWidth = (width - H_PADDING * 2 - GAP) / 2;

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withFavorites((s?.products ?? []).filter((p) => p.name.toLowerCase().includes(q)), favIds);
  }, [s, search, favIds]);

  if (store.isError) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface-dark">
        <ErrorState error={store.error} onRetry={() => store.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface-dark">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10" keyboardShouldPersistTaps="handled">
        <View className="bg-ink">
          <StoreBanner store={{ bannerUrl: s?.bannerUrl ?? null }} height={190} />
          <SafeAreaView edges={['top']} className="absolute start-3 top-0">
            <Pressable
              onPress={() => navigation.goBack()}
              className="mt-2 h-10 w-10 items-center justify-center rounded-full bg-white/90"
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <BackIcon size={22} color="#1E1B18" />
            </Pressable>
          </SafeAreaView>
        </View>

        {!s ? (
          <View className="mx-4 -mt-10 gap-3">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-60 w-full rounded-2xl" />
          </View>
        ) : (
          <>
            {/* Carte d'identité de la boutique */}
            <View className="mx-4 -mt-10 rounded-2xl border border-[#E2D9CB] bg-white p-4 dark:border-gray-800 dark:bg-surface-dark-card">
              <View className="flex-row items-center gap-4">
                <StoreLogo store={s} size={76} />
                <View className="flex-1">
                  <Text className="text-xl font-extrabold text-ink dark:text-gray-100">{s.name}</Text>
                  <View className="mt-1.5 flex-row flex-wrap gap-1.5">
                    <View className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${s.verified ? 'bg-green-50 dark:bg-green-900/30' : 'bg-surface-muted dark:bg-surface-dark-muted'}`}>
                      {s.verified ? <BadgeCheck size={13} color={colors.success} /> : null}
                      <Text className={`text-xs font-bold ${s.verified ? 'text-success' : 'text-ink-muted'}`}>
                        {s.verified ? t('stores.verified') : t('stores.active')}
                      </Text>
                    </View>
                    {s.rating.count > 0 ? (
                      <View className="flex-row items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 dark:bg-amber-900/30">
                        <Star size={12} color="#F5A623" fill="#F5A623" />
                        <Text className="text-xs font-bold text-amber-700 dark:text-amber-300">
                          {s.rating.average} · {t('stores.reviewsCount', { count: s.rating.count })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <Text className="mt-3 text-sm text-ink-muted dark:text-gray-400">{s.description || t('stores.defaultDescription')}</Text>
              <View className="mt-3 flex-row flex-wrap gap-4">
                <InfoChip icon={<Package size={14} color={colors.muted} />} label={t('stores.products', { count: s.productCount })} />
                {s.governorate ? <InfoChip icon={<MapPin size={14} color={colors.muted} />} label={s.governorate} /> : null}
                <InfoChip icon={<Truck size={14} color={colors.muted} />} label={t('stores.nationalDelivery')} />
              </View>
            </View>

            {/* Onglets */}
            <View className="mx-4 mt-4 flex-row border-b border-[#E2D9CB] dark:border-gray-800">
              {(
                [
                  ['products', t('stores.tabProducts')],
                  ['about', t('stores.tabAbout')],
                  ['reviews', `${t('stores.tabReviews')}${s.rating.count ? ` (${s.rating.count})` : ''}`],
                ] as [Tab, string][]
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  onPress={() => setTab(value)}
                  className={`border-b-2 px-3 py-3 ${tab === value ? 'border-primary' : 'border-transparent'}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === value }}
                >
                  <Text className={`text-sm font-bold ${tab === value ? 'text-primary' : 'text-ink-muted'}`}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'products' ? (
              <View className="px-4 pt-4">
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('stores.searchInStore')}
                  leftIcon={<Search size={16} color={colors.muted} />}
                />
                {products.length === 0 ? (
                  <EmptyState icon={<Package size={36} color={colors.primary} />} title={t('stores.noProducts')} text="" />
                ) : (
                  <View className="mt-4 flex-row flex-wrap justify-between">
                    {products.map((p) => (
                      <ProductCard key={p.id} product={p} width={cardWidth} />
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {tab === 'about' ? <AboutTab store={s} /> : null}
            {tab === 'reviews' ? <ReviewsTab store={s} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      {icon}
      <Text className="text-xs font-semibold text-ink-muted">{label}</Text>
    </View>
  );
}

function AboutCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <View className="rounded-2xl border border-[#E2D9CB] bg-white p-4 dark:border-gray-800 dark:bg-surface-dark-card">
      <Text className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">{title}</Text>
      <Text className="mt-1 text-sm font-bold text-ink dark:text-gray-100">{value}</Text>
      {hint ? <Text className="mt-0.5 text-2xs text-ink-subtle">{hint}</Text> : null}
    </View>
  );
}

function AboutTab({ store }: { store: StoreDetail }) {
  const { t } = useTranslation();
  return (
    <View className="gap-3 px-4 pt-4">
      <View className="rounded-2xl border border-[#E2D9CB] bg-white p-5 dark:border-gray-800 dark:bg-surface-dark-card">
        <Text className="text-lg font-extrabold text-ink dark:text-gray-100">{t('stores.aboutTitle')}</Text>
        <Text className="mt-2 text-sm leading-6 text-ink-muted dark:text-gray-400">{store.description || t('stores.aboutDefault')}</Text>
      </View>
      <AboutCard
        title={t('stores.averageRating')}
        value={store.rating.count ? `${store.rating.average} / 5` : '—'}
        hint={t('stores.verifiedReviews', { count: store.rating.count })}
      />
      <AboutCard title={t('stores.address')} value={store.address || t('stores.notProvided')} hint={store.governorate ?? undefined} />
      <AboutCard
        title={t('stores.verification')}
        value={store.verified ? t('stores.identityVerified') : t('stores.identityNotVerified')}
        hint={t('stores.returnPolicyHint')}
      />
    </View>
  );
}

function ReviewsTab({ store }: { store: StoreDetail }) {
  const { t } = useTranslation();
  const lang = useSettingsStore((st) => st.language);
  const { rating } = store;

  return (
    <View className="mx-4 mt-4 rounded-2xl border border-[#E2D9CB] bg-white p-5 dark:border-gray-800 dark:bg-surface-dark-card">
      <Text className="text-lg font-extrabold text-ink dark:text-gray-100">{t('stores.reviewsTitle')}</Text>
      {rating.count === 0 ? (
        <Text className="mt-2 text-sm text-ink-muted dark:text-gray-400">{t('stores.noReviews')}</Text>
      ) : (
        <>
          <View className="mt-3 flex-row items-center gap-3 rounded-2xl bg-surface-page p-4 dark:bg-surface-dark-muted">
            <Text className="text-3xl font-extrabold text-ink dark:text-gray-100">{rating.average}</Text>
            <View>
              <Stars value={Math.round(rating.average)} size={16} />
              <Text className="mt-0.5 text-xs text-ink-muted">{t('stores.verifiedReviews', { count: rating.count })}</Text>
            </View>
          </View>
          {rating.reviews.map((r) => (
            <View key={r.id} className="border-b border-[#EFE7DA] py-4 last:border-b-0 dark:border-gray-800">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-ink dark:text-gray-100">{r.author}</Text>
                <Stars value={r.rating} size={13} />
              </View>
              {r.productName ? <Text className="mt-1 text-xs font-semibold text-primary">{r.productName}</Text> : null}
              {r.comment ? <Text className="mt-1.5 text-sm text-ink-muted dark:text-gray-300">{r.comment}</Text> : null}
              <Text className="mt-1 text-2xs text-ink-subtle">{formatDate(r.createdAt, lang)}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
