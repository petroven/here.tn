import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ImagePlus, Minus, Plus, Trash2, X } from 'lucide-react-native';
import { catalogApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { sellerApi, type SellerProduct } from '@/api/vendor';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { confirm, toast } from '@/components/ui/toast';
import { useRefreshSeller, useSellerProducts } from '@/hooks/useSeller';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

const MAX_PHOTOS = 6;

/** « 49,900 » ou « 49.9 » (dinars) → millimes ; null si invalide. */
function parseTnd(text: string): number | null {
  const n = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}
const tndText = (millimes: number | null | undefined) => (millimes ? String(millimes / 1000) : '');

type Photo = { uri: string; local: boolean; mimeType?: string | null; fileName?: string | null };

/**
 * Création / modification d'un produit : photos, nom, description, prix,
 * prix barré (modification seulement, soumis à la règle anti-fausses
 * promotions du serveur), stock, catégorie et mise en ligne. Les variantes se
 * créent depuis le site ; leur stock s'ajuste ici.
 */
export function SellerProductFormScreen({ route, navigation }: RootScreenProps<'SellerProductForm'>) {
  const { t } = useTranslation();
  const productId = route.params?.productId;
  const all = useSellerProducts('tous');
  const existing = useMemo(() => all.data?.items.find((p) => p.id === productId), [all.data, productId]);

  // Le formulaire n'est monté qu'une fois le produit chargé : ses champs
  // partent directement des valeurs du produit (pas de recopie après coup).
  if (productId && !existing) {
    return (
      <Screen muted>
        <Header title={t('seller.form.editTitle')} />
        <Skeleton className="m-4 h-96 rounded-2xl" />
      </Screen>
    );
  }
  return <ProductForm key={productId ?? 'new'} productId={productId} existing={existing} navigation={navigation} />;
}

function ProductForm({
  productId,
  existing,
  navigation,
}: {
  productId?: string;
  existing?: SellerProduct;
  navigation: RootScreenProps<'SellerProductForm'>['navigation'];
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const refresh = useRefreshSeller();
  const editing = Boolean(productId);
  const categories = useQuery({
    queryKey: ['categories', lang],
    queryFn: catalogApi.categories,
    staleTime: 10 * 60_000,
  });

  const [photos, setPhotos] = useState<Photo[]>(() => (existing?.images ?? []).map((uri) => ({ uri, local: false })));
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [price, setPrice] = useState(tndText(existing?.price));
  const [compareAt, setCompareAt] = useState(tndText(existing?.compareAt));
  const [stock, setStock] = useState(String(existing?.stock ?? 0));
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [parentChoice, setParentId] = useState<string | null>(null);
  const [online, setOnline] = useState(existing ? existing.status !== 'inactif' : true);
  const [error, setError] = useState<string | null>(null);

  // Univers affiché : celui choisi, sinon celui de la catégorie du produit.
  const parentId =
    parentChoice ??
    categories.data?.find((c) => c.id === categoryId || c.children?.some((ch) => ch.id === categoryId))?.id ??
    null;

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.75,
    });
    if (result.canceled) return;
    setPhotos((list) =>
      [
        ...list,
        ...result.assets.map((a) => ({ uri: a.uri, local: true, mimeType: a.mimeType, fileName: a.fileName })),
      ].slice(0, MAX_PHOTOS),
    );
  };

  const save = useMutation({
    mutationFn: async () => {
      const priceValue = parseTnd(price);
      if (name.trim().length < 2) throw new Error(t('seller.form.nameRequired'));
      if (description.trim().length < 10) throw new Error(t('seller.form.descriptionRequired'));
      if (!priceValue) throw new Error(t('seller.form.priceInvalid'));
      const compareValue = compareAt.trim() ? parseTnd(compareAt) : null;
      if (compareAt.trim() && (!compareValue || compareValue <= priceValue))
        throw new Error(t('seller.form.compareInvalid'));
      const stockValue = Number(stock);
      const simple = !existing || existing.variants.length === 0;
      if (simple && (!Number.isInteger(stockValue) || stockValue < 0)) throw new Error(t('seller.form.stockInvalid'));

      // Les nouvelles photos sont téléversées une à une, dans l'ordre affiché.
      const images: string[] = [];
      for (const photo of photos) images.push(photo.local ? await sellerApi.uploadImage(photo) : photo.uri);

      const input = {
        name,
        description,
        price: priceValue,
        categoryId,
        status: online ? ('actif' as const) : ('inactif' as const),
        images,
        // Stock : seulement pour un produit sans variantes (sinon somme des variantes).
        ...(simple ? { stock: stockValue } : {}),
        ...(editing ? { compareAt: compareValue } : {}),
      };
      return editing ? sellerApi.updateProduct(productId!, input) : sellerApi.createProduct(input);
    },
    onSuccess: () => {
      refresh();
      toast(editing ? t('seller.form.saved') : t('seller.form.created'));
      navigation.goBack();
    },
    // Erreur affichée en haut du formulaire et en toast (le haut peut être hors écran).
    onError: (err) => {
      const message = errorMessage(err, t('common.networkError'));
      setError(message);
      toast(message);
    },
  });

  const remove = useMutation({
    mutationFn: () => sellerApi.deleteProduct(productId!),
    onSuccess: () => {
      refresh();
      toast(t('seller.form.deleted'));
      navigation.goBack();
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const variantStock = useMutation({
    mutationFn: ({ variantId, variation }: { variantId: string; variation: number }) =>
      sellerApi.adjustStock(productId!, { variantId, variation }),
    onSuccess: refresh,
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const variants: SellerProduct['variants'] = existing?.variants ?? [];
  const parent = categories.data?.find((c) => c.id === parentId);

  return (
    <Screen muted keyboard>
      <Header
        title={editing ? t('seller.form.editTitle') : t('seller.form.createTitle')}
        right={
          editing ? (
            <Pressable
              onPress={() =>
                confirm(
                  t('seller.form.deleteTitle'),
                  t('seller.form.deleteConfirm'),
                  { confirm: t('common.delete'), cancel: t('common.cancel') },
                  () => remove.mutate(),
                )
              }
              className="me-2 h-10 w-10 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel={t('seller.form.deleteTitle')}
            >
              <Trash2 size={20} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerClassName="p-4 pb-8 gap-3" keyboardShouldPersistTaps="handled">
        {error ? (
          <View className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

        {/* Photos */}
        <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <Text className="mb-1 font-bold text-ink dark:text-gray-100">
            {t('seller.form.photos', { count: photos.length, max: MAX_PHOTOS })}
          </Text>
          <Text className="mb-3 text-xs text-ink-muted dark:text-gray-400">{t('seller.form.photosHint')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5 pt-1.5">
            {photos.map((photo, i) => (
              <View key={`${photo.uri}-${i}`}>
                <Image source={{ uri: photo.uri }} style={{ width: 84, height: 84, borderRadius: 14 }} />
                {i === 0 ? (
                  <View className="absolute bottom-1 start-1 rounded bg-ink/80 px-1.5 py-0.5">
                    <Text className="text-2xs font-bold text-white">{t('seller.form.cover')}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  className="absolute -end-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-ink"
                  accessibilityRole="button"
                  accessibilityLabel={t('returns.removePhoto')}
                  hitSlop={6}
                >
                  <X size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable
                onPress={pickPhotos}
                className="h-[84px] w-[84px] items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600"
                accessibilityRole="button"
                accessibilityLabel={t('returns.pickPhoto')}
              >
                <ImagePlus size={22} color={colors.primary} />
                <Text className="text-2xs font-semibold text-primary">{t('returns.gallery')}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        {/* Informations */}
        <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <Input label={t('seller.form.name')} value={name} onChangeText={setName} maxLength={150} />
          <View>
            <Text className="mb-1.5 text-sm font-medium text-ink dark:text-gray-200">
              {t('seller.form.description')}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              maxLength={4000}
              placeholderTextColor={colors.subtle}
              className="min-h-28 rounded-2xl border border-gray-200 bg-surface-muted p-3.5 text-base text-ink dark:border-gray-700 dark:bg-surface-dark-muted dark:text-gray-100"
              accessibilityLabel={t('seller.form.description')}
            />
          </View>
          <View className="flex-row gap-3">
            <Input
              label={t('seller.form.price')}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              containerClassName="flex-1"
              placeholder="49.900"
            />
            {editing ? (
              <Input
                label={t('seller.form.compareAt')}
                value={compareAt}
                onChangeText={setCompareAt}
                keyboardType="decimal-pad"
                containerClassName="flex-1"
              />
            ) : null}
          </View>
          {editing ? <Text className="text-2xs text-ink-subtle">{t('seller.form.compareAtHint')}</Text> : null}
          {variants.length === 0 ? (
            <Input label={t('seller.form.stock')} value={stock} onChangeText={setStock} keyboardType="number-pad" />
          ) : null}
        </View>

        {/* Variantes : stock par variante */}
        {variants.length ? (
          <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
            <Text className="mb-1 font-bold text-ink dark:text-gray-100">{t('seller.form.variants')}</Text>
            <Text className="mb-3 text-xs text-ink-muted dark:text-gray-400">{t('seller.form.variantsHint')}</Text>
            {variants.map((v) => (
              <View
                key={v.id}
                className="flex-row items-center justify-between border-b border-gray-100 py-2 last:border-0 dark:border-gray-800"
              >
                <Text className="flex-1 text-sm text-ink dark:text-gray-100">{v.label}</Text>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() => variantStock.mutate({ variantId: v.id, variation: -1 })}
                    disabled={v.stock < 1 || variantStock.isPending}
                    className={`h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-surface-dark-muted ${v.stock < 1 ? 'opacity-40' : ''}`}
                    accessibilityLabel={t('seller.stockMinus', { name: v.label })}
                  >
                    <Minus size={15} color={colors.text} />
                  </Pressable>
                  <Text className="w-8 text-center font-bold text-ink dark:text-gray-100">{v.stock}</Text>
                  <Pressable
                    onPress={() => variantStock.mutate({ variantId: v.id, variation: 1 })}
                    disabled={variantStock.isPending}
                    className="h-8 w-8 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30"
                    accessibilityLabel={t('seller.stockPlus', { name: v.label })}
                  >
                    <Plus size={15} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Catégorie */}
        <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <Text className="mb-3 font-bold text-ink dark:text-gray-100">{t('seller.form.category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {(categories.data ?? []).map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={parentId === c.id}
                onPress={() => {
                  setParentId(c.id);
                  if (!c.children?.length) setCategoryId(c.id);
                }}
              />
            ))}
          </ScrollView>
          {parent?.children?.length ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {parent.children.map((c) => (
                <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
              ))}
            </View>
          ) : null}
        </View>

        {/* Mise en ligne */}
        <View className="flex-row items-center gap-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <View className="flex-1">
            <Text className="font-bold text-ink dark:text-gray-100">{t('seller.form.online')}</Text>
            <Text className="text-xs text-ink-muted dark:text-gray-400">
              {online ? t('seller.form.onlineOn') : t('seller.form.onlineOff')}
            </Text>
          </View>
          <Switch
            value={online}
            onValueChange={setOnline}
            trackColor={{ true: colors.primary, false: undefined }}
            accessibilityLabel={t('seller.form.online')}
          />
        </View>
      </ScrollView>

      <View className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-surface-dark">
        <Button
          title={editing ? t('seller.form.save') : t('seller.form.create')}
          size="lg"
          loading={save.isPending}
          onPress={() => {
            setError(null);
            save.mutate();
          }}
        />
      </View>
    </Screen>
  );
}
