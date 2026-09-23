import type { ReactNode } from 'react';
import { I18nManager, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  transparent?: boolean;
};

/** En-tête d'écran : bouton retour (orienté selon LTR/RTL), titre centré, action à droite. */
export function Header({ title, back = true, right, transparent }: Props) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  return (
    <View
      className={`h-14 flex-row items-center px-2 ${
        transparent ? '' : 'border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-surface-dark'
      }`}
    >
      <View className="w-12 items-start">
        {back && navigation.canGoBack() ? (
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-surface-dark-muted"
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={6}
          >
            <BackIcon size={26} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <Text className="flex-1 text-center text-lg font-bold text-ink dark:text-gray-100" numberOfLines={1}>
        {title}
      </Text>
      <View className="min-w-12 flex-row items-center justify-end">{right}</View>
    </View>
  );
}
