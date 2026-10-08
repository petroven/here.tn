import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { BankTransferInfo, ProductFilters } from '@/api/types';
import type { StockFilter } from '@/api/vendor';

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
  /** bankTransfer : coordonnées à afficher après une commande payée par virement. */
  OrderConfirmation: { orderId: string; bankTransfer?: BankTransferInfo | null };
  Orders: undefined;
  OrderDetail: { orderId: string };
  EditProfile: undefined;
  DeleteAccount: undefined;
  Addresses: { selectMode?: boolean } | undefined;
  AddressForm: { addressId?: string } | undefined;
  Notifications: undefined;
  Favorites: undefined;
  Stores: undefined;
  Store: { storeId: string };
  BecomeVendor: undefined;
  Promotion: { code: string };
  Conversations: undefined;
  Chat: { conversationId: string; title: string };
  Returns: undefined;
  ReturnRequest: { orderId: string; orderNumber: string };
  Wallet: undefined;
  Coupons: undefined;
  // Espace vendeur
  SellerHome: undefined;
  SellerOrders: undefined;
  SellerOrderDetail: { orderId: string };
  SellerProducts: { filter?: StockFilter } | undefined;
  SellerProductForm: { productId?: string } | undefined;
  SellerQuickAdd: undefined;
  SellerReturns: undefined;
  SellerWithdrawals: undefined;
  SellerKyc: undefined;
  // Espace livreur
  CourierHome: undefined;
  CourierCourse: { courseId: string };
  CourierHistory: undefined;
  CourierRegister: undefined;
  // Espace administrateur
  AdminHome: undefined;
  AdminStores: undefined;
  AdminStore: { storeId: string };
  AdminWithdrawals: undefined;
  AdminTransfers: undefined;
  AdminOrders: undefined;
  AdminOrder: { orderId: string };
  AdminProducts: undefined;
  AdminReviews: undefined;
  AdminUsers: undefined;
  AdminAudit: undefined;
  AdminCategories: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  namespace ReactNavigation {
    // Typage global de useNavigation()
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- idem
    interface RootParamList extends RootStackParamList {}
  }
}
