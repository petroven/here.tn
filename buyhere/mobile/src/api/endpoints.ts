import { api, ApiError } from './client';
import {
  mapCategory,
  mapGovernorate,
  mapOrder,
  mapProductCard,
  mapProductDetail,
  mapReview,
  mapUser,
  toMillimes,
  toWebPaymentMethod,
  type WebCategory,
  type WebEnvelope,
  type WebGovernorate,
  type WebOrder,
  type WebProduct,
  type WebReview,
  type WebUser,
} from './web';
import type {
  Address,
  AddressInput,
  AppNotification,
  AuthResponse,
  Cart,
  CartLine,
  Category,
  Delegation,
  Governorate,
  HomeData,
  Order,
  OrderStatus,
  Paginated,
  PaymentMethod,
  PaymentStatus,
  ProductCard,
  ProductDetail,
  ProductFilters,
  Review,
  ReviewsPage,
  User,
} from './types';
import { localAddresses, localCart, type StoredCart } from '@/store/local';

/**
 * Couche d'accès à l'API du site web (server/, préfixe /api) : une fonction
 * typée par besoin de l'app. Les réponses sont converties vers les types de
 * l'app (api/web.ts) pour que les écrans n'aient pas à connaître l'API web.
 */

const get = <T>(url: string, params?: object, headers?: Record<string, string>) =>
  api.get<WebEnvelope<T>>(url, { params, headers }).then((r) => r.data);

/** Numéro tunisien au format accepté par l'API web : 8 chiffres, éventuellement +216. */
const cleanPhone = (phone?: string | null) => {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^(00)?216/, '');
  return digits.length === 8 ? digits : undefined;
};

// ─── Auth ───

async function sessionFrom(token: string): Promise<AuthResponse> {
  const me = await get<WebUser>('/users/me', undefined, { Authorization: `Bearer ${token}` });
  return { accessToken: token, user: mapUser(me.data) };
}

export const authApi = {
  login: (email: string, password: string) =>
    api
      .post<{ token: string }>('/auth/login', { email: email.toLowerCase(), password })
      .then((r) => sessionFrom(r.data.token)),
  register: (input: { firstName: string; lastName: string; email: string; phone?: string; password: string }) =>
    api
      .post<{ token: string }>('/auth/register', {
        prenom: input.firstName,
        nom: input.lastName,
        email: input.email,
        password: input.password,
        telephone: cleanPhone(input.phone),
        // L'écran d'inscription n'appelle cette fonction qu'après la case cochée.
        accepteConditions: true,
      })
      .then((r) => sessionFrom(r.data.token)),
  /** Le site envoie un lien de réinitialisation par email (valable 1 h). */
  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email: email.toLowerCase() }).then((r) => r.data),
};

// ─── Géographie (gouvernorats / délégations, frais de livraison) ───

let governoratesCache: Promise<Governorate[]> | null = null;

export const geoApi = {
  governorates: () => {
    governoratesCache ??= get<WebGovernorate[]>('/gouvernorats')
      .then((r) => r.data.map(mapGovernorate))
      .catch((err) => {
        governoratesCache = null;
        throw err;
      });
    return governoratesCache;
  },
  delegations: (governorateId: number) =>
    get<{ id: number; nom: string; nomAr: string | null }[]>(`/gouvernorats/${governorateId}/delegations`).then((r) =>
      r.data.map((d): Delegation => ({ id: d.id, name: d.nom, nameAr: d.nomAr })),
    ),
};

// ─── Utilisateur ───

let addressSeq = 0;

export const meApi = {
  get: () => get<WebUser>('/users/me').then((r) => mapUser(r.data)),
  update: async (input: Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'language'>>) => {
    const body: Record<string, unknown> = {};
    if (input.firstName !== undefined) body.prenom = input.firstName;
    if (input.lastName !== undefined) body.nom = input.lastName;
    if (input.phone !== undefined) body.telephone = cleanPhone(input.phone) ?? null;
    // La langue reste un réglage de l'app : l'API web ne la stocke pas.
    if (Object.keys(body).length === 0) return meApi.get();
    const r = await api.patch<WebEnvelope<WebUser>>('/users/me', body);
    return mapUser(r.data.data);
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/users/me/password', { currentPassword, newPassword }),
  /** Pas de notifications push côté API web pour l'instant. */
  setPushToken: (_token: string | null) => Promise.resolve(),

  // Carnet d'adresses : conservé sur le téléphone (voir store/local.ts).
  addresses: () => localAddresses.get(),
  createAddress: async (input: AddressInput) => {
    const list = await localAddresses.get();
    const address: Address = {
      ...input,
      id: `${Date.now()}-${addressSeq++}`,
      postalCode: input.postalCode ?? null,
      isDefault: input.isDefault || list.length === 0,
    };
    const next = address.isDefault ? list.map((a) => ({ ...a, isDefault: false })) : list;
    await localAddresses.save([...next, address]);
    return address;
  },
  updateAddress: async (id: string, input: Partial<AddressInput>) => {
    const list = await localAddresses.get();
    const next = list.map((a) =>
      a.id === id ? { ...a, ...input, postalCode: input.postalCode ?? a.postalCode } : input.isDefault ? { ...a, isDefault: false } : a,
    );
    await localAddresses.save(next);
    return next.find((a) => a.id === id)!;
  },
  deleteAddress: async (id: string) => {
    const list = (await localAddresses.get()).filter((a) => a.id !== id);
    if (list.length && !list.some((a) => a.isDefault)) list[0] = { ...list[0], isDefault: true };
    await localAddresses.save(list);
  },
};

// ─── Catalogue ───

const SORTS: Record<string, string> = {
  newest: 'newest',
  price_asc: 'price_asc',
  price_desc: 'price_desc',
  rating: 'rating',
  popular: 'rating',
};

function productParams(filters: ProductFilters & { page?: number; limit?: number }) {
  return {
    page: filters.page,
    limit: filters.limit,
    search: filters.q || undefined,
    categoryId: filters.category || undefined,
    minPrice: filters.minPrice ? filters.minPrice / 1000 : undefined,
    maxPrice: filters.maxPrice ? filters.maxPrice / 1000 : undefined,
    minRating: filters.minRating || undefined,
    promotion: filters.onSale || filters.flash ? 'true' : undefined,
    sort: SORTS[filters.sort ?? 'newest'] ?? 'newest',
  };
}

const productList = (filters: ProductFilters & { page?: number; limit?: number }) =>
  get<WebProduct[]>('/produits', productParams(filters));

export const catalogApi = {
  /** L'accueil de l'app est composé à partir des mêmes listes que la page d'accueil du site. */
  home: async (): Promise<HomeData> => {
    const [categories, promos, popular, newest] = await Promise.all([
      catalogApi.categories(),
      productList({ onSale: true, limit: 10 }),
      productList({ sort: 'rating', limit: 10 }),
      productList({ sort: 'newest', limit: 10 }),
    ]);
    return {
      banners: [],
      categories,
      flashEndsAt: null,
      flash: promos.data.map((p) => mapProductCard(p)),
      popular: popular.data.map((p) => mapProductCard(p)),
      newest: newest.data.map((p) => mapProductCard(p)),
    };
  },
  categories: (): Promise<Category[]> => get<WebCategory[]>('/categories').then((r) => r.data.map(mapCategory)),
  products: async (filters: ProductFilters & { page?: number; limit?: number }): Promise<Paginated<ProductCard>> => {
    const r = await productList(filters);
    const page = r.pagination?.page ?? 1;
    return {
      items: r.data.map((p) => mapProductCard(p)),
      page,
      limit: r.pagination?.limit ?? r.data.length,
      total: r.count ?? r.data.length,
      hasMore: page < (r.pagination?.totalPages ?? 1),
    };
  },
  suggestions: (q: string) =>
    productList({ q, limit: 6 }).then((r) => r.data.map((p) => ({ slug: String(p.id), name: p.nom }))),
  product: async (id: string): Promise<ProductDetail> => {
    const { data } = await get<WebProduct>(`/produits/${id}`);
    const similar = data.categorie
      ? await productList({ category: String(data.categorie.id), limit: 8 }).catch(() => null)
      : null;
    return mapProductDetail(data, (similar?.data ?? []).map((p) => mapProductCard(p)));
  },
  /** L'API web renvoie tous les avis d'un coup : une seule page. */
  reviews: async (productId: string, _page = 1): Promise<ReviewsPage> => {
    const r = await get<WebReview[]>(`/produits/${productId}/avis`);
    const items = r.data.map(mapReview);
    const distribution: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const review of items) distribution[review.rating] = (distribution[review.rating] ?? 0) + 1;
    return { items, page: 1, limit: items.length, total: items.length, hasMore: false, distribution };
  },
  /** Comme sur le site : un avis est rattaché à une commande livrée contenant le produit. */
  addReview: async (productId: string, rating: number, comment?: string): Promise<Review> => {
    const orders = await get<WebOrder[]>('/commandes/mes-commandes');
    const order = orders.data.find(
      (o) => o.statut === 'livree' && o.lignes?.some((l) => String(l.produitId) === productId),
    );
    if (!order) {
      throw new ApiError('FORBIDDEN', 'Vous ne pouvez laisser un avis que sur un produit acheté et livré.', 403);
    }
    const r = await api.post<WebEnvelope<WebReview>>('/avis', {
      produitId: Number(productId),
      commandeId: order.id,
      note: rating,
      commentaire: comment || undefined,
    });
    return mapReview(r.data.data);
  },
};

// ─── Panier (sur le téléphone, prix et stock relus depuis l'API) ───

const lineId = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ''}`;

async function buildCart(stored: StoredCart): Promise<Cart> {
  const products = await Promise.all(
    [...new Set(stored.lines.map((l) => l.productId))].map((id) =>
      get<WebProduct>(`/produits/${id}`)
        .then((r) => [id, r.data] as const)
        .catch(() => [id, null] as const),
    ),
  );
  const byId = new Map(products);

  const items: CartLine[] = stored.lines.map((line) => {
    const p = byId.get(line.productId) ?? null;
    const variant = p?.variantes?.find((v) => String(v.id) === line.variantId) ?? null;
    const available = p ? (variant ? variant.stock : p.stock) : 0;
    const unitPrice = p ? toMillimes(p.prix + (variant?.prixSupplement ?? 0)) : 0;
    return {
      id: lineId(line.productId, line.variantId),
      productId: line.productId,
      variantId: line.variantId,
      slug: line.productId,
      name: p?.nom ?? '—',
      imageUrl: p ? mapProductCard(p).imageUrl : null,
      size: variant ? (variant.taille ?? variant.pointure) : null,
      color: variant?.couleur ?? null,
      unitPrice,
      quantity: line.quantity,
      lineTotal: unitPrice * line.quantity,
      available,
      isAvailable: !!p && available >= line.quantity,
      storeId: p ? String(p.boutiqueId) : null,
    };
  });

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
  let discount = 0;
  let couponError: string | null = null;
  if (stored.couponCode && subtotal > 0) {
    try {
      const r = await api.post<WebEnvelope<{ remise: number }>>('/coupons/valider', {
        code: stored.couponCode,
        sousTotal: subtotal / 1000,
      });
      discount = toMillimes(r.data.data.remise);
    } catch (err) {
      couponError = err instanceof ApiError ? err.message : null;
    }
  }

  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    couponCode: stored.couponCode,
    couponError,
    subtotal,
    discount,
    shippingFee: null,
    total: subtotal - discount,
  };
}

async function updateCart(change: (cart: StoredCart) => StoredCart | Promise<StoredCart>): Promise<Cart> {
  const next = await change(await localCart.get());
  await localCart.save(next);
  return buildCart(next);
}

export const cartApi = {
  get: async () => buildCart(await localCart.get()),
  add: (productId: string, variantId: string | null, quantity = 1) =>
    updateCart((cart) => {
      const existing = cart.lines.find((l) => l.productId === productId && l.variantId === variantId);
      const lines = existing
        ? cart.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l))
        : [...cart.lines, { productId, variantId, quantity }];
      return { ...cart, lines };
    }),
  update: (itemId: string, quantity: number) =>
    updateCart((cart) => ({
      ...cart,
      lines: cart.lines.map((l) => (lineId(l.productId, l.variantId) === itemId ? { ...l, quantity } : l)),
    })),
  remove: (itemId: string) =>
    updateCart((cart) => ({ ...cart, lines: cart.lines.filter((l) => lineId(l.productId, l.variantId) !== itemId) })),
  clear: () => updateCart(() => ({ lines: [], couponCode: null })),
  applyCoupon: (code: string) =>
    updateCart(async (cart) => {
      const current = await buildCart(cart);
      // Refus immédiat si le code est invalide : même vérification que le site.
      await api.post('/coupons/valider', { code, sousTotal: current.subtotal / 1000 });
      return { ...cart, couponCode: code.toUpperCase() };
    }),
  removeCoupon: () => updateCart((cart) => ({ ...cart, couponCode: null })),
};

// ─── Commandes & paiement ───

async function fetchOrders(): Promise<Order[]> {
  const [orders, governorates] = await Promise.all([
    get<WebOrder[]>('/commandes/mes-commandes'),
    geoApi.governorates().catch(() => [] as Governorate[]),
  ]);
  return orders.data.map((o) => mapOrder(o, { governorates }));
}

type CreatedOrder = {
  commande: WebOrder;
  paymentRedirect: { paymentUrl?: string; paymentRef?: string; sandbox?: boolean } | null;
};

export const ordersApi = {
  /**
   * Même appel que le checkout du site (POST /commandes). Une commande avec
   * plusieurs boutiques est découpée en une commande par boutique côté API.
   */
  create: async (input: { addressId: string; paymentMethod: PaymentMethod }) => {
    const [stored, addresses] = await Promise.all([localCart.get(), localAddresses.get()]);
    const address = addresses.find((a) => a.id === input.addressId);
    if (!address) throw new ApiError('VALIDATION_ERROR', 'Adresse de livraison introuvable.');

    const r = await api.post<WebEnvelope<CreatedOrder>>('/commandes', {
      lignes: stored.lines.map((l) => ({
        produitId: Number(l.productId),
        ...(l.variantId ? { varianteId: Number(l.variantId) } : {}),
        quantite: l.quantity,
      })),
      adresseLivraison: `${address.fullName} (${address.phone}) — ${address.street}, ${address.city}${
        address.postalCode ? ` ${address.postalCode}` : ''
      }`,
      gouvernoratId: address.governorateId,
      delegationId: address.delegationId,
      methodePaiement: toWebPaymentMethod(input.paymentMethod),
      couponCode: stored.couponCode ?? undefined,
    });
    await localCart.save({ lines: [], couponCode: null });

    const { commande, paymentRedirect } = r.data.data;
    const order = mapOrder(commande, { governorates: [] });
    order.paymentMethod = input.paymentMethod;
    return {
      order,
      payUrl: paymentRedirect?.sandbox ? null : (paymentRedirect?.paymentUrl ?? null),
      // Mode sandbox du site : le paiement simulé se confirme directement, sans page externe.
      sandboxRef: paymentRedirect?.sandbox ? (paymentRedirect.paymentRef ?? null) : null,
    };
  },
  list: async (_page: number, status?: OrderStatus): Promise<Paginated<Order>> => {
    const items = (await fetchOrders()).filter((o) => !status || o.status === status);
    return { items, page: 1, limit: items.length, total: items.length, hasMore: false };
  },
  get: async (id: string) => {
    const order = (await fetchOrders()).find((o) => o.id === id);
    if (!order) throw new ApiError('NOT_FOUND', 'Commande introuvable.', 404);
    return order;
  },
  cancel: async (id: string) => {
    await api.put(`/commandes/${id}/annuler`);
    return ordersApi.get(id);
  },
  pay: async (id: string) => {
    const order = await ordersApi.get(id);
    const provider = toWebPaymentMethod(order.paymentMethod);
    const r = await api.post<WebEnvelope<{ paymentUrl?: string }>>('/payments/initiate', {
      commandeId: Number(id),
      provider,
    });
    if (!r.data.data.paymentUrl) throw new ApiError('PAYMENT', 'Le paiement en ligne est indisponible pour cette commande.');
    return { payUrl: r.data.data.paymentUrl };
  },
  confirmSandbox: (paymentRef: string) => api.post('/paiements/confirm', { paymentRef }),
  verifyPayment: async (id: string): Promise<{ paymentStatus: PaymentStatus; status: OrderStatus }> => {
    const r = await get<{ commandeStatut: string; transaction: { statut: string } | null }>(`/payments/${id}/status`);
    const paid = r.data.commandeStatut === 'payee' || r.data.transaction?.statut === 'validee';
    const failed = r.data.transaction?.statut === 'echec';
    return {
      paymentStatus: paid ? 'PAID' : failed ? 'FAILED' : 'PENDING',
      status: paid ? 'CONFIRMED' : 'PENDING',
    };
  },
};

// ─── Favoris (même liste que sur le site) ───

type WebWishlistItem = { produitId: number; produit: WebProduct | null };

export const favoritesApi = {
  list: () =>
    get<WebWishlistItem[]>('/wishlist').then((r) =>
      r.data.filter((i) => i.produit).map((i) => ({ ...mapProductCard(i.produit!), isFavorite: true })),
    ),
  ids: () => get<WebWishlistItem[]>('/wishlist').then((r) => r.data.map((i) => String(i.produitId))),
  add: (productId: string) => api.post('/wishlist', { produitId: Number(productId) }),
  remove: (productId: string) => api.delete(`/wishlist/${productId}`),
};

// ─── Notifications ───
// L'API web n'expose pas encore de notifications client : liste vide.

export const notificationsApi = {
  list: async (_page: number): Promise<Paginated<AppNotification> & { unread: number }> => ({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
    unread: 0,
  }),
  unreadCount: async () => 0,
  markRead: async (_id: string) => undefined,
  markAllRead: async () => undefined,
};
