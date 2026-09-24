import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { navigationRef } from './navigationRef';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { CategoryProductsScreen } from '@/screens/CategoryProductsScreen';
import { ProductDetailScreen } from '@/screens/ProductDetailScreen';
import { ReviewsScreen } from '@/screens/ReviewsScreen';
import { CheckoutScreen } from '@/screens/CheckoutScreen';
import { OrderConfirmationScreen } from '@/screens/OrderConfirmationScreen';
import { OrdersScreen } from '@/screens/OrdersScreen';
import { OrderDetailScreen } from '@/screens/OrderDetailScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { AddressesScreen } from '@/screens/profile/AddressesScreen';
import { AddressFormScreen } from '@/screens/profile/AddressFormScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { FavoritesScreen } from '@/screens/FavoritesScreen';
import { StoresScreen } from '@/screens/StoresScreen';
import { StoreScreen } from '@/screens/StoreScreen';
import { BecomeVendorScreen } from '@/screens/BecomeVendorScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Navigation racine : onboarding (1re ouverture), onglets, puis écrans empilés. */
export function RootNavigator() {
  const onboardingDone = useSettingsStore((s) => s.onboardingDone);
  const { isDark, colors } = useTheme();
  usePushNotifications();

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <Stack.Navigator
        initialRouteName={onboardingDone ? 'Main' : 'Onboarding'}
        screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ animation: 'fade' }} />

        {/* Authentification présentée en modale : on revient là où l'on était. */}
        <Stack.Group screenOptions={{ presentation: 'modal', animation: 'slide_from_bottom' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>

        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
        <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
        <Stack.Screen name="Reviews" component={ReviewsScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen
          name="OrderConfirmation"
          component={OrderConfirmationScreen}
          options={{ gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Addresses" component={AddressesScreen} />
        <Stack.Screen name="AddressForm" component={AddressFormScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} />
        <Stack.Screen name="Stores" component={StoresScreen} />
        <Stack.Screen name="Store" component={StoreScreen} />
        <Stack.Screen name="BecomeVendor" component={BecomeVendorScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
