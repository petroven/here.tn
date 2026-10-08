import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Deep linking — une seule table de routes pour :
 *  - les liens d'app : buyhere://produit/123, buyhere://boutique/5,
 *    buyhere://commande/789, buyhere://promotion/ETE2026 ;
 *  - les liens du site partagés (WhatsApp, SMS…) : https://buyhere.tn/produits/123
 *    s'ouvre directement dans l'app quand elle est installée (Android App
 *    Links / iOS Universal Links, voir app.json et server/src/routes/appLinkRoutes.js) ;
 *  - le toucher d'une notification push (son « lien » passe par ici).
 *
 * Les chemins du site (pluriel : /produits, /boutiques) sont des alias des
 * chemins courts de l'app, pour qu'un même lien fonctionne partout.
 */
const WEB_ORIGINS = ['https://buyhere.tn', 'https://www.buyhere.tn', process.env.EXPO_PUBLIC_WEB_URL]
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => origin.replace(/\/$/, ''));

export const linking: LinkingOptions<RootStackParamList> = {
  // createURL('/') = exp://… dans Expo Go, buyhere:// dans un build.
  prefixes: [Linking.createURL('/'), 'buyhere://', ...WEB_ORIGINS],
  config: {
    screens: {
      Main: {
        screens: {
          Home: '',
          Categories: 'categories',
          Search: 'recherche',
          Cart: 'panier',
          Profile: 'compte',
        },
      },
      ProductDetail: { path: 'produit/:idOrSlug', alias: ['produits/:idOrSlug'] },
      Store: { path: 'boutique/:storeId', alias: ['boutiques/:storeId'] },
      Stores: 'boutiques',
      OrderDetail: { path: 'commande/:orderId', alias: ['commandes/:orderId'] },
      Orders: 'commandes',
      Promotion: { path: 'promotion/:code', alias: ['coupons/:code'] },
      Coupons: 'coupons',
      Notifications: 'notifications',
      // Une notification de message ouvre la messagerie (le fil exige le
      // nom de la boutique, connu seulement une fois la liste chargée).
      Conversations: { path: 'messages', alias: ['messages/:conversationId'] },
      Returns: 'retours',
      Wallet: 'portefeuille',
      Favorites: 'favoris',
      SellerHome: 'vendeur',
      SellerOrders: 'vendeur/commandes',
      SellerProductForm: { path: 'vendeur/produits/:productId' },
      SellerReturns: 'vendeur/retours',
      SellerWithdrawals: 'vendeur/retraits',
      SellerKyc: 'vendeur/kyc',
      CourierHome: 'livreur',
      CourierCourse: 'livreur/courses/:courseId',
      CourierHistory: 'livreur/historique',
      CourierRegister: 'livreur/inscription',
      AdminHome: 'admin',
      AdminStores: 'admin/boutiques',
      AdminStore: 'admin/boutiques/:storeId',
      AdminWithdrawals: 'admin/retraits',
      AdminTransfers: 'admin/virements',
      AdminOrders: 'admin/commandes',
      AdminOrder: 'admin/commandes/:orderId',
      AdminProducts: 'admin/produits',
      AdminReviews: 'admin/avis',
      AdminUsers: 'admin/utilisateurs',
      AdminAudit: 'admin/audit',
      AdminCategories: 'admin/categories',
      Login: 'connexion',
    },
  },
};
