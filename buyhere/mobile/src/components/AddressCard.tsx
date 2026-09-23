import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin, Pencil } from 'lucide-react-native';
import type { Address } from '@/api/types';
import { useSettingsStore } from '@/store/settings';
import { formatPhone } from '@/utils/format';
import { governorateLabel } from '@/utils/governorates';
import { useTheme } from '@/theme/useTheme';

type Props = {
  address: Address;
  selected?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
};

/** Carte d'adresse (liste des adresses, choix au checkout). */
export function AddressCard({ address, selected, onPress, onEdit }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row gap-3 rounded-2xl border bg-white p-4 dark:bg-surface-dark-card ${
        selected ? 'border-primary' : 'border-gray-100 dark:border-gray-800'
      }`}
      accessibilityRole={onPress ? 'radio' : undefined}
      accessibilityState={{ selected }}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${
          selected ? 'bg-primary' : 'bg-primary-50 dark:bg-primary-900/30'
        }`}
      >
        <MapPin size={18} color={selected ? '#fff' : colors.primary} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-bold text-ink dark:text-gray-100">{address.label}</Text>
          {address.isDefault ? (
            <View className="rounded-full bg-primary-50 px-2 py-0.5 dark:bg-primary-900/40">
              <Text className="text-2xs font-semibold text-primary">{t('address.default')}</Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-sm text-ink dark:text-gray-200">{address.fullName}</Text>
        <Text className="text-sm text-ink-muted dark:text-gray-400">
          {address.street}, {address.city}, {governorateLabel(address.governorate, lang)}
          {address.postalCode ? ` ${address.postalCode}` : ''}
        </Text>
        <Text className="text-sm text-ink-muted dark:text-gray-400" style={{ writingDirection: 'ltr' }}>
          {formatPhone(address.phone)}
        </Text>
      </View>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.edit')}>
          <Pencil size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}
