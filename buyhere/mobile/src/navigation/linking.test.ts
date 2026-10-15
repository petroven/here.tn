// Deep links : liens d'app (buyhere://…), liens du site partagés
// (https://buyhere.tn/produits/12) et liens des notifications push doivent
// tous ouvrir le bon écran avec les bons paramètres. Vérifie aussi que les
// domaines et chemins déclarés dans app.json (Android App Links, iOS
// Universal Links) correspondent à cette table : un chemin intercepté par
// l'app mais inconnu ici ouvrirait l'app sans écran.
import { describe, expect, it, jest } from '@jest/globals';
import { getStateFromPath } from '@react-navigation/native';
import type { NavigationState, PartialState } from '@react-navigation/native';
import appJson from '../../app.json';
import { linking } from './linking';

// createURL dépend du runtime (exp:// dans Expo Go, buyhere:// dans un build)
// et exige le manifeste Expo, absent sous Jest : seule cette fonction est simulée.
jest.mock('expo-linking', () => ({ createURL: () => 'exp://127.0.0.1:8081/--/' }));

type State = PartialState<NavigationState> | NavigationState | undefined;

// Écran le plus profond atteint par un chemin, avec ses paramètres.
function ecran(path: string): { name: string; params?: object } | undefined {
  let state: State = getStateFromPath(path, linking.config);
  let route: { name: string; params?: object; state?: State } | undefined;
  while (state?.routes?.length) {
    route = state.routes[state.index ?? state.routes.length - 1] as typeof route;
    state = route?.state;
  }
  return route ? { name: route.name, params: route.params } : undefined;
}

describe('deep links : liens de l’app', () => {
  it.each([
    ['produit/123', 'ProductDetail', { idOrSlug: '123' }],
    ['produit/chechia-rouge', 'ProductDetail', { idOrSlug: 'chechia-rouge' }],
    ['boutique/5', 'Store', { storeId: '5' }],
    ['commande/789', 'OrderDetail', { orderId: '789' }],
    ['promotion/ETE2026', 'Promotion', { code: 'ETE2026' }],
    ['livreur/courses/42', 'CourierCourse', { courseId: '42' }],
    ['vendeur/produits/9', 'SellerProductForm', { productId: '9' }],
    ['admin/commandes/77', 'AdminOrder', { orderId: '77' }],
  ])('%s → %s', (path, name, params) => {
    expect(ecran(path)).toEqual({ name, params });
  });

  it.each([
    ['panier', 'Cart'],
    ['compte', 'Profile'],
    ['recherche', 'Search'],
    ['categories', 'Categories'],
  ])('onglet %s → Main/%s', (path, name) => {
    expect(ecran(path)?.name).toBe(name);
    expect(getStateFromPath(path, linking.config)?.routes[0].name).toBe('Main');
  });

  it.each([
    ['commandes', 'Orders'],
    ['notifications', 'Notifications'],
    ['portefeuille', 'Wallet'],
    ['messages', 'Conversations'],
    ['messages/31', 'Conversations'],
    ['connexion', 'Login'],
  ])('%s → %s', (path, name) => {
    expect(ecran(path)?.name).toBe(name);
  });
});

describe('deep links : chemins du site (alias pluriels)', () => {
  it.each([
    ['produits/123', 'ProductDetail', { idOrSlug: '123' }],
    ['boutiques/5', 'Store', { storeId: '5' }],
    ['commandes/789', 'OrderDetail', { orderId: '789' }],
    ['coupons/ETE2026', 'Promotion', { code: 'ETE2026' }],
  ])('%s → %s', (path, name, params) => {
    expect(ecran(path)).toEqual({ name, params });
  });
});

describe('deep links : préfixes', () => {
  it('accepte le schéma buyhere:// et les deux domaines du site', () => {
    expect(linking.prefixes).toEqual(expect.arrayContaining(['buyhere://', 'https://buyhere.tn', 'https://www.buyhere.tn']));
  });

  it('le schéma de app.json est celui des liens d’app', () => {
    expect(`${appJson.expo.scheme}://`).toBe('buyhere://');
  });
});

describe('cohérence avec app.json (App Links / Universal Links)', () => {
  type Filtre = { data?: { scheme?: string; host?: string; pathPrefix?: string }[] };
  const filtres = (appJson.expo.android.intentFilters as Filtre[]).flatMap((f) => f.data ?? []);
  const hotesIos = appJson.expo.ios.associatedDomains.map((d: string) => d.replace(/^applinks:/, ''));

  it('chaque domaine Android et iOS est un préfixe de la table de routes', () => {
    const hotes = new Set([...filtres.map((d) => d.host), ...hotesIos]);
    for (const hote of hotes) {
      expect(linking.prefixes).toContain(`https://${hote}`);
    }
  });

  const cheminsInterceptes: [string, string][] = filtres
    .filter((d) => d.host && d.pathPrefix)
    .map((d) => [d.host as string, d.pathPrefix as string]);

  it('app.json déclare bien des chemins interceptés', () => {
    expect(cheminsInterceptes.length).toBeGreaterThan(0);
  });

  it.each(cheminsInterceptes)(
    'https://%s%s… ouvre un écran connu',
    (_hote, prefixe) => {
      const exemple = `${prefixe.replace(/^\//, '').replace(/\/$/, '')}${prefixe.endsWith('/') ? '/12' : ''}`;
      const route = ecran(exemple);
      const ecransConnus = Object.keys(linking.config?.screens ?? {});
      expect(route).toBeDefined();
      expect(ecransConnus).toContain(route?.name);
    },
  );
});
