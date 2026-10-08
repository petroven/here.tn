import { ScrollView, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme/useTheme';

export type Tone = 'amber' | 'green' | 'red' | 'blue' | 'gray' | 'primary';

const TONES: Record<Tone, { box: string; text: string }> = {
  amber: { box: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  green: { box: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  red: { box: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
  blue: { box: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  gray: { box: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  primary: { box: 'bg-primary-100 dark:bg-primary-900/40', text: 'text-primary-700 dark:text-primary-300' },
};

/** Pastille de statut colorée. */
export function Pill({ label, tone }: { label: string; tone: Tone }) {
  const s = TONES[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${s.box}`}>
      <Text className={`text-xs font-semibold ${s.text}`}>{label}</Text>
    </View>
  );
}

/** Recherche + filtres en pastilles, sous l'en-tête des listes admin. */
export function FilterBar<K extends string>({
  query,
  onQuery,
  placeholder,
  filters,
  value,
  onChange,
}: {
  query?: string;
  onQuery?: (q: string) => void;
  placeholder?: string;
  filters: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="gap-2.5 bg-white py-2.5 dark:bg-surface-dark">
      {onQuery ? (
        <View className="px-4">
          <Input
            value={query}
            onChangeText={onQuery}
            placeholder={placeholder}
            leftIcon={<Search size={18} color={colors.subtle} />}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4">
        {filters.map((f) => (
          <Chip
            key={f.key}
            label={f.count != null ? `${f.label} (${f.count})` : f.label}
            selected={value === f.key}
            onPress={() => onChange(f.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** Recherche insensible à la casse et aux accents. */
export function matches(query: string, ...fields: (string | null | undefined)[]) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  return !q || fields.some((f) => f && norm(f).includes(q));
}
