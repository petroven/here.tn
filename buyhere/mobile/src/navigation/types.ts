import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { ProductFilters } from '@/api/types';

/** Mêmes onglets que la barre du bas du site mobile : Accueil, Catégories, Recherche, Panier, Compte. */
export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Search: { initialQuery?: string; focus?: boolean } | undefined;
  Cart: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Login: { redirect?: 'back' } | undefined;
  Register: undefined;
  ForgotPassword: undefined;
  CategoryProducts: { slug?: string; title: string; filters?: ProductFilters };
  ProductDetail: { idOrSlug: string };
  Reviews: { productId: string; productName: string };
  Checkout: undefined;
  OrderConfirmation: { orderId: string };
  Orders: undefined;
  OrderDetail: { orderId: string };
  EditProfile: undefined;
  Addresses: { selectMode?: boolean } | undefined;
  AddressForm: { addressId?: string } | undefined;
  Notifications: undefined;
  Favorites: undefined;
  Stores: undefined;
  Store: { storeId: string };
  BecomeVendor: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // Typage global de useNavigation()
    interface RootParamList extends RootStackParamList {}
  }
}
