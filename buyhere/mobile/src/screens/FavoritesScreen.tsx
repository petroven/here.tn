import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useFavorites } from '@/hooks/queries';
import { useIsLoggedIn } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/** Liste de souhaits : grille des produits favoris. */
export function FavoritesScreen({ navigation }: RootScreenProps<'Favorites'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const loggedIn = useIsLoggedIn();
  const favorites = useFavorites();

  const title = <Header title={t('favorites.title')} />;

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
            action={{ label: t('cart.startShopping'), onPress: () => navigation.navigate('Main', { screen: 'Home' }) }}
          />
        }
      />
    </Screen>
  );
}
