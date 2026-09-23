import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useFavorites } from '@/hooks/queries';
import { useIsLoggedIn } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import type { TabScreenProps } from '@/navigation/types';

/** Liste de souhaits : grille des produits favoris. */
export function FavoritesScreen({ navigation }: TabScreenProps<'Favorites'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const loggedIn = useIsLoggedIn();
  const favorites = useFavorites();

  const title = (
    <Text className="px-4 pb-3 pt-2 text-2xl font-extrabold text-ink dark:text-gray-100">{t('favorites.title')}</Text>
  );

  if (!loggedIn) {
    return (
      <Screen>
        {title}
        <EmptyState
          icon={<Heart size={40} color={colors.primary} />}
          title={t('auth.loginRequired')}
          text={t('auth.loginRequiredText')}
          action={{ label: t('auth.login'), onPress: () => navigation.navigate('Login', { redirect: 'back' }) }}
        />
      </Screen>
    );
  }

  if (favorites.isError && !favorites.data) {
    return (
      <Screen>
        {title}
        <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {title}
      <ProductGrid
        products={(favorites.data ?? []).map((p) => ({ ...p, isFavorite: true }))}
        loading={favorites.isLoading}
        refreshing={favorites.isRefetching}
        onRefresh={() => favorites.refetch()}
        empty={
          <EmptyState
            icon={<Heart size={40} color={colors.primary} />}
            title={t('favorites.empty')}
            text={t('favorites.emptyText')}
            action={{ label: t('cart.startShopping'), onPress: () => navigation.navigate('Home') }}
          />
        }
      />
    </Screen>
  );
}
