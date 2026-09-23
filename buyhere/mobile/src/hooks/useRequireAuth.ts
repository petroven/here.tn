import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useIsLoggedIn } from '@/store/auth';

/**
 * Le catalogue est accessible sans compte. Les actions personnelles (panier,
 * favoris, commande) passent par ce garde : exécute l'action si l'utilisateur
 * est connecté, sinon ouvre l'écran de connexion (qui revient ensuite ici).
 */
export function useRequireAuth() {
  const loggedIn = useIsLoggedIn();
  const navigation = useNavigation();

  return useCallback(
    (action: () => void) => {
      if (loggedIn) action();
      else navigation.navigate('Login', { redirect: 'back' });
    },
    [loggedIn, navigation],
  );
}
