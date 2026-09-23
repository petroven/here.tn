import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type Props = { title: string; onSeeAll?: () => void; extra?: ReactNode };

/** Titre de section de l'accueil avec lien « Voir tout ». */
export function SectionHeader({ title, onSeeAll, extra }: Props) {
  const { t } = useTranslation();
  return (
    <View className="mb-3 flex-row items-center justify-between px-4">
      <View className="flex-1 flex-row items-center gap-2">
        <Text className="text-lg font-bold text-ink dark:text-gray-100">{title}</Text>
        {extra}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="link">
          <Text className="text-sm font-semibold text-primary">{t('common.seeAll')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
