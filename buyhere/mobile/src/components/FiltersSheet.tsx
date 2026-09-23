import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import type { ProductFilters, ProductSort } from '@/api/types';
import { useCategories } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Input } from './ui/Input';
import { Stars } from './ui/Rating';

type Props = {
  visible: boolean;
  value: ProductFilters;
  onClose: () => void;
  onApply: (filters: ProductFilters) => void;
  hideCategory?: boolean;
};

export const SORT_OPTIONS: { value: ProductSort; key: string }[] = [
  { value: 'newest', key: 'search.sortNewest' },
  { value: 'popular', key: 'search.sortPopular' },
  { value: 'price_asc', key: 'search.sortPriceAsc' },
  { value: 'price_desc', key: 'search.sortPriceDesc' },
  { value: 'rating', key: 'search.sortRating' },
];

/** Feuille de filtres : tri, prix (DT), catégorie, note minimale, promotions. */
export function FiltersSheet({ visible, value, onClose, onApply, hideCategory }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: categories = [] } = useCategories();
  const [draft, setDraft] = useState<ProductFilters>(value);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Réinitialise le brouillon à chaque ouverture (prix saisis en DT, envoyés en millimes).
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMinPrice(value.minPrice ? String(value.minPrice / 1000) : '');
    setMaxPrice(value.maxPrice ? String(value.maxPrice / 1000) : '');
  }, [visible, value]);

  const toMillimes = (s: string) => {
    const n = parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : undefined;
  };

  const apply = () => {
    onApply({ ...draft, minPrice: toMillimes(minPrice), maxPrice: toMillimes(maxPrice) });
    onClose();
  };

  const reset = () => {
    setDraft({ q: value.q, category: hideCategory ? value.category : undefined, sort: 'newest' });
    setMinPrice('');
    setMaxPrice('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top', 'bottom']}>
        <View className="h-14 flex-row items-center justify-between border-b border-gray-100 px-4 dark:border-gray-800">
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <X size={24} color={colors.text} />
          </Pressable>
          <Text className="text-lg font-bold text-ink dark:text-gray-100">{t('search.filters')}</Text>
          <Pressable onPress={reset} hitSlop={10}>
            <Text className="font-semibold text-primary">{t('common.reset')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="p-4 gap-7" keyboardShouldPersistTaps="handled">
          <View>
            <Text className="mb-3 font-bold text-ink dark:text-gray-100">{t('search.sort')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {SORT_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={t(o.key)}
                  selected={(draft.sort ?? 'newest') === o.value}
                  onPress={() => setDraft((d) => ({ ...d, sort: o.value }))}
                />
              ))}
            </View>
          </View>

          <View>
            <Text className="mb-3 font-bold text-ink dark:text-gray-100">{t('search.priceRange')}</Text>
            <View className="flex-row items-center gap-3">
              <Input containerClassName="flex-1" placeholder={t('search.min')} keyboardType="decimal-pad" value={minPrice} onChangeText={setMinPrice} />
              <Text className="text-ink-muted">—</Text>
              <Input containerClassName="flex-1" placeholder={t('search.max')} keyboardType="decimal-pad" value={maxPrice} onChangeText={setMaxPrice} />
            </View>
          </View>

          {!hideCategory ? (
            <View>
              <Text className="mb-3 font-bold text-ink dark:text-gray-100">{t('search.category')}</Text>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label={t('search.allCategories')}
                  selected={!draft.category}
                  onPress={() => setDraft((d) => ({ ...d, category: undefined }))}
                />
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    selected={draft.category === c.slug}
                    onPress={() => setDraft((d) => ({ ...d, category: c.slug }))}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <View>
            <Text className="mb-3 font-bold text-ink dark:text-gray-100">{t('search.minRating')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {[4, 3, 2].map((n) => (
                <Chip
                  key={n}
                  label={`${n}+`}
                  icon={<Stars value={1} size={12} />}
                  selected={draft.minRating === n}
                  onPress={() => setDraft((d) => ({ ...d, minRating: d.minRating === n ? undefined : n }))}
                />
              ))}
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={t('search.onSale')}
              selected={!!draft.onSale}
              onPress={() => setDraft((d) => ({ ...d, onSale: d.onSale ? undefined : true }))}
            />
          </View>
        </ScrollView>

        <View className="border-t border-gray-100 p-4 dark:border-gray-800">
          <Button title={t('search.showResults')} size="lg" onPress={apply} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Nombre de filtres actifs (hors recherche texte et tri) pour le badge du bouton. */
export function activeFilterCount(f: ProductFilters, ignoreCategory = false) {
  return [f.minPrice, f.maxPrice, ignoreCategory ? undefined : f.category, f.minRating, f.onSale].filter(
    (v) => v !== undefined && v !== false,
  ).length;
}
