import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Heart, House, Search, ShoppingBag, User } from 'lucide-react-native';
import { useCart } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import { HomeScreen } from '@/screens/HomeScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { CartScreen } from '@/screens/CartScreen';
import { FavoritesScreen } from '@/screens/FavoritesScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/** Barre d'onglets : Accueil, Recherche, Panier (badge), Favoris, Profil. */
export function MainTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: cart } = useCart();
  const cartCount = cart?.itemCount ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('tabs.home'), tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: t('tabs.search'), tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: t('tabs.cart'),
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
          tabBarBadge: cartCount > 0 ? (cartCount > 99 ? '99+' : cartCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: '#fff', fontSize: 10 },
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: t('tabs.favorites'), tabBarIcon: ({ color, size }) => <Heart color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.profile'), tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
