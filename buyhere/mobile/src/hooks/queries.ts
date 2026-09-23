import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import {
  cartApi,
  catalogApi,
  favoritesApi,
  meApi,
  notificationsApi,
  ordersApi,
} from '@/api/endpoints';
import type {
  Cart,
  HomeData,
  OrderStatus,
  Paginated,
  ProductCard,
  ProductDetail,
  ProductFilters,
} from '@/api/types';
import { useIsLoggedIn } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';

/**
 * Clés de cache React Query. La langue fait partie des clés du catalogue :
 * changer de langue recharge les noms/descriptions traduits.
 */
export const qk = {
  home: (lang: string) => ['home', lang] as const,
  categories: (lang: string) => ['categories', lang] as const,
  products: (lang: string, filters: ProductFilters) => ['products', lang, filters] as const,
  product: (lang: string, id: string) => ['product', lang, id] as const,
  reviews: (productId: string) => ['reviews', productId] as const,
  cart: ['cart'] as const,
  favorites: ['favorites'] as const,
  favoriteIds: ['favoriteIds'] as const,
  addresses: ['addresses'] as const,
  orders: (status?: OrderStatus) => ['orders', status ?? 'all'] as const,
  order: (id: string) => ['order', id] as const,
  notifications: ['notifications'] as const,
  unread: ['unread'] as const,
};

const useLang = () => useSettingsStore((s) => s.language);

// ─── Catalogue ───

export function useHome() {
  const lang = useLang();
  return useQuery({ queryKey: qk.home(lang), queryFn: catalogApi.home });
}

export function useCategories() {
  const lang = useLang();
  return useQuery({ queryKey: qk.categories(lang), queryFn: catalogApi.categories, staleTime: 10 * 60_000 });
}

/** Liste paginée pour le scroll infini (grille 2 colonnes). */
export function useProducts(filters: ProductFilters, enabled = true) {
  const lang = useLang();
  return useInfiniteQuery({
    queryKey: qk.products(lang, filters),
    queryFn: ({ pageParam }) => catalogApi.products({ ...filters, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  });
}

export function useProduct(idOrSlug: string) {
  const lang = useLang();
  return useQuery({ queryKey: qk.product(lang, idOrSlug), queryFn: () => catalogApi.product(idOrSlug) });
}

export function useReviews(productId: string) {
  return useInfiniteQuery({
    queryKey: qk.reviews(productId),
    queryFn: ({ pageParam }) => catalogApi.reviews(productId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!productId,
  });
}

export function useAddReview(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; comment?: string }) =>
      catalogApi.addReview(productId, input.rating, input.comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reviews(productId) });
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}

// ─── Panier ───

export function useCart() {
  const loggedIn = useIsLoggedIn();
  return useQuery({ queryKey: qk.cart, queryFn: cartApi.get, enabled: loggedIn });
}

/** Toutes les mutations du panier renvoient le panier recalculé : on remplace le cache. */
function useCartMutation<V>(fn: (vars: V) => Promise<Cart>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => qc.setQueryData(qk.cart, cart),
  });
}

export const useAddToCart = () =>
  useCartMutation((v: { productId: string; variantId: string | null; quantity?: number }) =>
    cartApi.add(v.productId, v.variantId, v.quantity),
  );
export const useUpdateCartItem = () =>
  useCartMutation((v: { itemId: string; quantity: number }) => cartApi.update(v.itemId, v.quantity));
export const useRemoveCartItem = () => useCartMutation((itemId: string) => cartApi.remove(itemId));
export const useClearCart = () => useCartMutation((_: void) => cartApi.clear());
export const useApplyCoupon = () => useCartMutation((code: string) => cartApi.applyCoupon(code));
export const useRemoveCoupon = () => useCartMutation((_: void) => cartApi.removeCoupon());

// ─── Favoris (mise à jour optimiste des cœurs) ───

export function useFavoriteIds() {
  const loggedIn = useIsLoggedIn();
  return useQuery({
    queryKey: qk.favoriteIds,
    queryFn: async () => new Set(await favoritesApi.ids()),
    enabled: loggedIn,
  });
}

export function useFavorites() {
  const loggedIn = useIsLoggedIn();
  return useQuery({ queryKey: qk.favorites, queryFn: favoritesApi.list, enabled: loggedIn });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, favorite }: { productId: string; favorite: boolean }) =>
      favorite ? favoritesApi.add(productId) : favoritesApi.remove(productId),
    onMutate: async ({ productId, favorite }) => {
      await qc.cancelQueries({ queryKey: qk.favoriteIds });
      const previous = qc.getQueryData<Set<string>>(qk.favoriteIds);
      const next = new Set(previous);
      if (favorite) next.add(productId);
      else next.delete(productId);
      qc.setQueryData(qk.favoriteIds, next);
      // Retire immédiatement de l'écran Favoris
      if (!favorite) {
        qc.setQueryData<ProductCard[]>(qk.favorites, (list) => list?.filter((p) => p.id !== productId));
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => qc.setQueryData(qk.favoriteIds, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.favorites }),
  });
}

// ─── Adresses ───

export function useAddresses() {
  const loggedIn = useIsLoggedIn();
  return useQuery({ queryKey: qk.addresses, queryFn: meApi.addresses, enabled: loggedIn });
}

// ─── Commandes ───

export function useOrders(status?: OrderStatus) {
  return useInfiniteQuery({
    queryKey: qk.orders(status),
    queryFn: ({ pageParam }) => ordersApi.list(pageParam, status),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: qk.order(id), queryFn: () => ordersApi.get(id) });
}

// ─── Notifications ───

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: qk.notifications,
    queryFn: ({ pageParam }) => notificationsApi.list(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useUnreadCount() {
  const loggedIn = useIsLoggedIn();
  return useQuery({
    queryKey: qk.unread,
    queryFn: notificationsApi.unreadCount,
    enabled: loggedIn,
    refetchInterval: 60_000,
  });
}

/** Aplatit les pages d'une requête infinie. */
export function flattenPages<T>(data: InfiniteData<Paginated<T>> | undefined): T[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

/** Applique l'état « favori » courant à une liste de cartes produit. */
export function withFavorites<T extends ProductCard>(items: T[], ids: Set<string> | undefined): T[] {
  if (!ids) return items;
  return items.map((p) => (p.isFavorite === ids.has(p.id) ? p : { ...p, isFavorite: ids.has(p.id) }));
}

export type { HomeData, ProductDetail };
