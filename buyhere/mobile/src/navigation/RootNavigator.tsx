import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { navigationRef } from './navigationRef';
import { linking } from './linking';
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
import { DeleteAccountScreen } from '@/screens/profile/DeleteAccountScreen';
import { AddressesScreen } from '@/screens/profile/AddressesScreen';
import { AddressFormScreen } from '@/screens/profile/AddressFormScreen';
import { NotificationsScreen } from '@/screens/NotificationsScreen';
import { FavoritesScreen } from '@/screens/FavoritesScreen';
import { StoresScreen } from '@/screens/StoresScreen';
import { StoreScreen } from '@/screens/StoreScreen';
import { BecomeVendorScreen } from '@/screens/BecomeVendorScreen';
import { PromotionScreen } from '@/screens/PromotionScreen';
import { ConversationsScreen } from '@/screens/messages/ConversationsScreen';
import { ChatScreen } from '@/screens/messages/ChatScreen';
import { ReturnsScreen } from '@/screens/returns/ReturnsScreen';
import { ReturnRequestScreen } from '@/screens/returns/ReturnRequestScreen';
import { WalletScreen } from '@/screens/WalletScreen';
import { CouponsScreen } from '@/screens/CouponsScreen';
import { SellerHomeScreen } from '@/screens/seller/SellerHomeScreen';
import { SellerOrdersScreen } from '@/screens/seller/SellerOrdersScreen';
import { SellerOrderDetailScreen } from '@/screens/seller/SellerOrderDetailScreen';
import { SellerProductsScreen } from '@/screens/seller/SellerProductsScreen';
import { SellerProductFormScreen } from '@/screens/seller/SellerProductFormScreen';
import { SellerQuickAddScreen } from '@/screens/seller/SellerQuickAddScreen';
import { SellerReturnsScreen } from '@/screens/seller/SellerReturnsScreen';
import { SellerWithdrawalsScreen } from '@/screens/seller/SellerWithdrawalsScreen';
import { SellerKycScreen } from '@/screens/seller/SellerKycScreen';
import { CourierHomeScreen } from '@/screens/courier/CourierHomeScreen';
import { CourierCourseScreen } from '@/screens/courier/CourierCourseScreen';
import { CourierHistoryScreen } from '@/screens/courier/CourierHistoryScreen';
import { CourierRegisterScreen } from '@/screens/courier/CourierRegisterScreen';
import { CourierRuntime } from '@/components/courier/CourierRuntime';
import { AdminHomeScreen } from '@/screens/admin/AdminHomeScreen';
import { AdminStoresScreen } from '@/screens/admin/AdminStoresScreen';
import { AdminStoreScreen } from '@/screens/admin/AdminStoreScreen';
import { AdminWithdrawalsScreen } from '@/screens/admin/AdminWithdrawalsScreen';
import { AdminTransfersScreen } from '@/screens/admin/AdminTransfersScreen';
import { AdminOrdersScreen } from '@/screens/admin/AdminOrdersScreen';
import { AdminOrderScreen } from '@/screens/admin/AdminOrderScreen';
import { AdminProductsScreen } from '@/screens/admin/AdminProductsScreen';
import { AdminReviewsScreen } from '@/screens/admin/AdminReviewsScreen';
import { AdminUsersScreen } from '@/screens/admin/AdminUsersScreen';
import { AdminAuditScreen } from '@/screens/admin/AdminAuditScreen';
import { AdminCategoriesScreen } from '@/screens/admin/AdminCategoriesScreen';

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
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
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
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="Addresses" component={AddressesScreen} />
        <Stack.Screen name="AddressForm" component={AddressFormScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} />
        <Stack.Screen name="Stores" component={StoresScreen} />
        <Stack.Screen name="Store" component={StoreScreen} />
        <Stack.Screen name="BecomeVendor" component={BecomeVendorScreen} />
        <Stack.Screen name="Promotion" component={PromotionScreen} />
        <Stack.Screen name="Conversations" component={ConversationsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Returns" component={ReturnsScreen} />
        <Stack.Screen name="ReturnRequest" component={ReturnRequestScreen} />
        <Stack.Screen name="Wallet" component={WalletScreen} />
        <Stack.Screen name="Coupons" component={CouponsScreen} />

        {/* Espace vendeur */}
        <Stack.Screen name="SellerHome" component={SellerHomeScreen} />
        <Stack.Screen name="SellerOrders" component={SellerOrdersScreen} />
        <Stack.Screen name="SellerOrderDetail" component={SellerOrderDetailScreen} />
        <Stack.Screen name="SellerProducts" component={SellerProductsScreen} />
        <Stack.Screen name="SellerProductForm" component={SellerProductFormScreen} />
        <Stack.Screen name="SellerQuickAdd" component={SellerQuickAddScreen} />
        <Stack.Screen name="SellerReturns" component={SellerReturnsScreen} />
        <Stack.Screen name="SellerWithdrawals" component={SellerWithdrawalsScreen} />
        <Stack.Screen name="SellerKyc" component={SellerKycScreen} />

        {/* Espace livreur */}
        <Stack.Screen name="CourierHome" component={CourierHomeScreen} />
        <Stack.Screen name="CourierCourse" component={CourierCourseScreen} />
        <Stack.Screen name="CourierHistory" component={CourierHistoryScreen} />
        <Stack.Screen name="CourierRegister" component={CourierRegisterScreen} />

        {/* Espace administrateur */}
        <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
        <Stack.Screen name="AdminStores" component={AdminStoresScreen} />
        <Stack.Screen name="AdminStore" component={AdminStoreScreen} />
        <Stack.Screen name="AdminWithdrawals" component={AdminWithdrawalsScreen} />
        <Stack.Screen name="AdminTransfers" component={AdminTransfersScreen} />
        <Stack.Screen name="AdminOrders" component={AdminOrdersScreen} />
        <Stack.Screen name="AdminOrder" component={AdminOrderScreen} />
        <Stack.Screen name="AdminProducts" component={AdminProductsScreen} />
        <Stack.Screen name="AdminReviews" component={AdminReviewsScreen} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
        <Stack.Screen name="AdminAudit" component={AdminAuditScreen} />
        <Stack.Screen name="AdminCategories" component={AdminCategoriesScreen} />
      </Stack.Navigator>
      {/* GPS et propositions de course du livreur, par-dessus tous les écrans. */}
      <CourierRuntime />
    </NavigationContainer>
  );
}
