import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, ImagePlus, Trash2, XCircle } from 'lucide-react-native';
import { catalogApi } from '@/api/endpoints';
import { ApiError, errorMessage } from '@/api/client';
import { sellerApi } from '@/api/vendor';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { toast } from '@/components/ui/toast';
import { useRefreshSeller } from '@/hooks/useSeller';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Ajout rapide : une photo = un produit. Le vendeur prend ses articles en
 * rafale (appareil photo) ou en sélectionne plusieurs dans la galerie, tape
 * nom + prix, puis publie tout d'un coup. Même principe que « Ajout rapide
 * par photos » du site (client/src/components/vendor/QuickAddModal.jsx).
 * Fiable sur réseau mobile : 3 envois en parallèle, 2 nouvelles tentatives
 * sur coupure, photo jamais renvoyée si elle est déjà en ligne, et brouillon
 * sauvegardé sur le téléphone (rien n'est perdu si l'app se ferme).
 */
const MAX_ITEMS = 60;
const CONCURRENCY = 3;
const QUALITY = 0.6; // photos de 4–8 Mo → ~0,5 Mo : envoi bien plus rapide en 3G/4G

type Status = 'draft' | 'sending' | 'done' | 'error';
type Item = {
  id: string;
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  name: string;
  price: string;
  stock: string;
  status: Status;
  error?: string;
  /** URL en ligne une fois la photo envoyée (pas de renvoi au « Réessayer »). */
  imageUrl?: string;
};
type Draft = { items: Item[]; categoryId: string | null; defaultStock: string };

const draftKey = () => `seller.quickAdd.${useAuthStore.getState().user?.id ?? 'anon'}`;

/** « 49,900 » ou « 49.9 » (dinars) → millimes ; null si invalide. */
function parseTnd(text: string): number | null {
  const n = Number(text.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

const isValid = (it: Item) => it.name.trim().length >= 2 && parseTnd(it.price) !== null;

/** Réessaie 2 fois sur coupure réseau ou erreur serveur ; pas sur une erreur de saisie (4xx). */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (err instanceof ApiError && err.status !== undefined && err.status < 500) throw err;
      if (attempt < tries - 1) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw last;
}

// Identifiant de fiche, aussi utilisé comme clé d'idempotence côté serveur
// (8 caractères minimum) : conservé dans le brouillon, donc stable entre tentatives.
let seq = 0;
const newId = () => `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${seq++}`;

export function SellerQuickAddScreen({ navigation }: RootScreenProps<'SellerQuickAdd'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const refresh = useRefreshSeller();
  const categories = useQuery({ queryKey: ['categories', lang], queryFn: catalogApi.categories, staleTime: 10 * 60_000 });

  const [items, setItems] = useState<Item[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [defaultStock, setDefaultStock] = useState('1');
  const [publishing, setPublishing] = useState(false);
  const [restored, setRestored] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Brouillon : restauré à l'ouverture, sauvegardé à chaque changement.
  useEffect(() => {
    AsyncStorage.getItem(draftKey())
      .then((raw) => {
        if (!raw) return;
        const draft = JSON.parse(raw) as Draft;
        // Un envoi interrompu par la fermeture de l'app redevient un brouillon.
        setItems(draft.items.map((it) => (it.status === 'sending' ? { ...it, status: 'draft' } : it)));
        setCategoryId(draft.categoryId);
        setDefaultStock(draft.defaultStock);
      })
      .catch(() => undefined)
      .finally(() => setRestored(true));
  }, []);
  useEffect(() => {
    if (!restored) return;
    const pending = items.filter((it) => it.status !== 'done');
    const save = pending.length
      ? AsyncStorage.setItem(draftKey(), JSON.stringify({ items: pending, categoryId, defaultStock } satisfies Draft))
      : AsyncStorage.removeItem(draftKey());
    save.catch(() => undefined);
  }, [items, categoryId, defaultStock, restored]);

  const patch = (id: string, changes: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...changes } : it)));

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const room = MAX_ITEMS - itemsRef.current.length;
    if (room <= 0) return toast(t('seller.quick.limit', { max: MAX_ITEMS }));
    const added = assets.slice(0, room).map<Item>((a) => ({
      id: newId(),
      uri: a.uri,
      mimeType: a.mimeType,
      fileName: a.fileName,
      name: '',
      price: '',
      stock: '',
      status: 'draft',
    }));
    setItems((list) => [...list, ...added]);
  };

  const pickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ITEMS - items.length,
      quality: QUALITY,
      orderedSelection: true,
    });
    if (!result.canceled) addAssets(result.assets);
  };

  // Rafale : après chaque photo, l'appareil se rouvre jusqu'à « Annuler ».
  const shoot = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return toast(t('seller.quick.cameraDenied'));
    for (;;) {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: QUALITY });
      if (result.canceled) break;
      addAssets(result.assets);
      if (itemsRef.current.length + 1 >= MAX_ITEMS) break;
    }
  };

  const publishOne = async (it: Item) => {
    patch(it.id, { status: 'sending', error: undefined });
    try {
      let url = it.imageUrl;
      if (!url) {
        url = await withRetry(() => sellerApi.uploadImage(it));
        patch(it.id, { imageUrl: url });
      }
      const name = it.name.trim();
      const stock = Number((it.stock || defaultStock || '0').trim());
      await withRetry(() =>
        sellerApi.createProduct({
          name,
          description: name,
          price: parseTnd(it.price)!,
          stock: Number.isInteger(stock) && stock >= 0 ? stock : 0,
          categoryId,
          status: 'actif',
          images: [url!],
        }, it.id),
      );
      patch(it.id, { status: 'done' });
    } catch (err) {
      patch(it.id, { status: 'error', error: errorMessage(err, t('common.networkError')) });
    }
  };

  const toSend = items.filter((it) => it.status !== 'done' && isValid(it));
  const doneCount = items.filter((it) => it.status === 'done').length;
  const invalidCount = items.filter((it) => it.status !== 'done' && !isValid(it)).length;

  const publishAll = async () => {
    const queue = [...toSend];
    if (!queue.length) return;
    setPublishing(true);
    const worker = async () => {
      while (queue.length) await publishOne(queue.shift()!);
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setPublishing(false);
    refresh();
    const failed = itemsRef.current.filter((it) => it.status === 'error').length;
    toast(failed ? t('seller.quick.someFailed', { count: failed }) : t('seller.quick.allPublished'));
    if (!failed && itemsRef.current.every((it) => it.status === 'done')) navigation.goBack();
  };

  const parent = categories.data?.find((c) => c.id === parentId);

  const header = (
    <View className="gap-3 pb-3">
      <View className="flex-row gap-3">
        <Pressable
          onPress={shoot}
          disabled={publishing}
          className="flex-1 items-center gap-1.5 rounded-2xl bg-primary py-4"
          accessibilityRole="button"
        >
          <Camera size={24} color="#fff" />
          <Text className="font-bold text-white">{t('seller.quick.camera')}</Text>
        </Pressable>
        <Pressable
          onPress={pickGallery}
          disabled={publishing}
          className="flex-1 items-center gap-1.5 rounded-2xl border border-primary bg-white py-4 dark:bg-surface-dark-card"
          accessibilityRole="button"
        >
          <ImagePlus size={24} color={colors.primary} />
          <Text className="font-bold text-primary">{t('seller.quick.gallery')}</Text>
        </Pressable>
      </View>
      <Text className="text-xs text-ink-muted dark:text-gray-400">{t('seller.quick.hint')}</Text>

      <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
        <Text className="mb-3 font-bold text-ink dark:text-gray-100">{t('seller.quick.categoryForAll')}</Text>
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
        <View className="mt-4 flex-row items-center gap-3">
          <Text className="flex-1 text-sm text-ink dark:text-gray-200">{t('seller.quick.defaultStock')}</Text>
          <TextInput
            value={defaultStock}
            onChangeText={setDefaultStock}
            keyboardType="number-pad"
            className="w-20 rounded-xl border border-gray-200 bg-surface-muted px-3 py-2 text-center text-base text-ink dark:border-gray-700 dark:bg-surface-dark-muted dark:text-gray-100"
            accessibilityLabel={t('seller.quick.defaultStock')}
          />
        </View>
      </View>
    </View>
  );

  return (
    <Screen muted keyboard>
      <Header title={t('seller.quick.title')} />
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={header}
        contentContainerClassName="p-4 pb-8"
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        renderItem={({ item: it }) => {
          const locked = publishing || it.status === 'done' || it.status === 'sending';
          return (
            <View
              className={`flex-row gap-3 rounded-2xl border bg-white p-2.5 dark:bg-surface-dark-card ${
                it.status === 'error' ? 'border-red-300' : it.status === 'done' ? 'border-green-300' : 'border-transparent'
              }`}
            >
              <View>
                <Image source={{ uri: it.uri }} style={{ width: 84, height: 84, borderRadius: 12 }} />
                {it.status === 'sending' ? (
                  <View className="absolute inset-0 items-center justify-center rounded-xl bg-white/60">
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : it.status === 'done' ? (
                  <View className="absolute inset-0 items-center justify-center rounded-xl bg-white/60">
                    <CheckCircle2 size={28} color={colors.success} />
                  </View>
                ) : null}
              </View>
              <View className="flex-1 gap-2">
                <TextInput
                  value={it.name}
                  onChangeText={(name) => patch(it.id, { name })}
                  editable={!locked}
                  placeholder={t('seller.form.name')}
                  placeholderTextColor={colors.subtle}
                  maxLength={150}
                  className="rounded-xl border border-gray-200 bg-surface-muted px-3 py-2 text-base text-ink dark:border-gray-700 dark:bg-surface-dark-muted dark:text-gray-100"
                  accessibilityLabel={t('seller.form.name')}
                />
                <View className="flex-row gap-2">
                  <TextInput
                    value={it.price}
                    onChangeText={(price) => patch(it.id, { price })}
                    editable={!locked}
                    keyboardType="decimal-pad"
                    placeholder={t('seller.quick.pricePlaceholder')}
                    placeholderTextColor={colors.subtle}
                    className="flex-1 rounded-xl border border-gray-200 bg-surface-muted px-3 py-2 text-base text-ink dark:border-gray-700 dark:bg-surface-dark-muted dark:text-gray-100"
                    accessibilityLabel={t('seller.form.price')}
                  />
                  <TextInput
                    value={it.stock}
                    onChangeText={(stock) => patch(it.id, { stock })}
                    editable={!locked}
                    keyboardType="number-pad"
                    placeholder={`${t('seller.form.stock')} ${defaultStock || 0}`}
                    placeholderTextColor={colors.subtle}
                    className="w-24 rounded-xl border border-gray-200 bg-surface-muted px-3 py-2 text-base text-ink dark:border-gray-700 dark:bg-surface-dark-muted dark:text-gray-100"
                    accessibilityLabel={t('seller.form.stock')}
                  />
                </View>
                {it.status === 'error' ? (
                  <View className="flex-row items-start gap-1">
                    <XCircle size={13} color={colors.danger} />
                    <Text className="flex-1 text-xs text-danger">{it.error}</Text>
                  </View>
                ) : null}
              </View>
              {!locked ? (
                <Pressable
                  onPress={() => setItems((list) => list.filter((x) => x.id !== it.id))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                >
                  <Trash2 size={18} color={colors.subtle} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      {items.length ? (
        <View className="gap-1.5 border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-surface-dark">
          <Text className="text-xs text-ink-muted dark:text-gray-400">
            {doneCount ? `${t('seller.quick.published', { count: doneCount })} · ` : ''}
            {invalidCount
              ? t('seller.quick.incomplete', { count: invalidCount })
              : t('seller.quick.ready', { count: toSend.length })}
          </Text>
          <Button
            title={t('seller.quick.publish', { count: toSend.length })}
            size="lg"
            loading={publishing}
            disabled={!toSend.length}
            onPress={publishAll}
          />
        </View>
      ) : null}
    </Screen>
  );
}
