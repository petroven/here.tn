import { api } from './client';
import type {
  Address,
  AddressInput,
  AppNotification,
  AuthResponse,
  Cart,
  Category,
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

/** Couche d'accès à l'API : une fonction typée par endpoint. */

// ─── Auth ───
export const authApi = {
  login: (identifier: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { identifier, password }).then((r) => r.data),
  register: (input: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    password: string;
    language: 'fr' | 'ar';
  }) => api.post<AuthResponse>('/auth/register', input).then((r) => r.data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  forgotPassword: (identifier: string) =>
    api
      .post<{ message: string; devCode?: string }>('/auth/forgot-password', { identifier })
      .then((r) => r.data),
  resetPassword: (identifier: string, code: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { identifier, code, password }).then((r) => r.data),
};

// ─── Utilisateur ───
export const meApi = {
  get: () => api.get<User>('/users/me').then((r) => r.data),
  update: (input: Partial<Pick<User, 'firstName' | 'lastName' | 'phone' | 'language'>>) =>
    api.patch<User>('/users/me', input).then((r) => r.data),
  uploadAvatar: (uri: string, mimeType = 'image/jpeg') => {
    const form = new FormData();
    // React Native : un fichier se décrit par { uri, name, type }.
    form.append('avatar', { uri, name: 'avatar.jpg', type: mimeType } as unknown as Blob);
    return api
      .post<User>('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/users/me/password', { currentPassword, newPassword }),
  setPushToken: (token: string | null) => api.put('/users/me/push-token', { token }),
  deleteAccount: () => api.delete('/users/me'),
  addresses: () => api.get<Address[]>('/users/me/addresses').then((r) => r.data),
  createAddress: (input: AddressInput) => api.post<Address>('/users/me/addresses', input).then((r) => r.data),
  updateAddress: (id: string, input: Partial<AddressInput>) =>
    api.patch<Address>(`/users/me/addresses/${id}`, input).then((r) => r.data),
  deleteAddress: (id: string) => api.delete(`/users/me/addresses/${id}`),
};

// ─── Catalogue ───
export const catalogApi = {
  home: () => api.get<HomeData>('/home').then((r) => r.data),
  categories: () => api.get<Category[]>('/categories').then((r) => r.data),
  products: (filters: ProductFilters & { page?: number; limit?: number }) =>
    api.get<Paginated<ProductCard>>('/products', { params: filters }).then((r) => r.data),
  suggestions: (q: string) =>
    api.get<{ slug: string; name: string }[]>('/products/suggestions', { params: { q } }).then((r) => r.data),
  product: (idOrSlug: string) => api.get<ProductDetail>(`/products/${idOrSlug}`).then((r) => r.data),
  reviews: (productId: string, page = 1) =>
    api.get<ReviewsPage>(`/reviews/product/${productId}`, { params: { page, limit: 10 } }).then((r) => r.data),
  addReview: (productId: string, rating: number, comment?: string) =>
    api.post<Review>('/reviews', { productId, rating, comment }).then((r) => r.data),
};

// ─── Panier ───
export const cartApi = {
  get: () => api.get<Cart>('/cart').then((r) => r.data),
  add: (productId: string, variantId: string | null, quantity = 1) =>
    api.post<Cart>('/cart/items', { productId, variantId, quantity }).then((r) => r.data),
  update: (itemId: string, quantity: number) =>
    api.patch<Cart>(`/cart/items/${itemId}`, { quantity }).then((r) => r.data),
  remove: (itemId: string) => api.delete<Cart>(`/cart/items/${itemId}`).then((r) => r.data),
  clear: () => api.delete<Cart>('/cart').then((r) => r.data),
  applyCoupon: (code: string) => api.post<Cart>('/cart/coupon', { code }).then((r) => r.data),
  removeCoupon: () => api.delete<Cart>('/cart/coupon').then((r) => r.data),
};

// ─── Commandes & paiement ───
export const ordersApi = {
  create: (input: { addressId: string; paymentMethod: PaymentMethod; note?: string }) =>
    api.post<{ order: Order; payUrl: string | null }>('/orders', input).then((r) => r.data),
  list: (page: number, status?: OrderStatus) =>
    api.get<Paginated<Order>>('/orders', { params: { page, limit: 10, status } }).then((r) => r.data),
  get: (id: string) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  cancel: (id: string) => api.post<Order>(`/orders/${id}/cancel`).then((r) => r.data),
  pay: (id: string) => api.post<{ payUrl: string }>(`/orders/${id}/pay`).then((r) => r.data),
  verifyPayment: (id: string) =>
    api
      .post<{ paymentStatus: PaymentStatus; status: OrderStatus }>(`/payments/verify/${id}`)
      .then((r) => r.data),
};

// ─── Favoris ───
export const favoritesApi = {
  list: () => api.get<ProductCard[]>('/favorites').then((r) => r.data),
  ids: () => api.get<string[]>('/favorites/ids').then((r) => r.data),
  add: (productId: string) => api.put(`/favorites/${productId}`),
  remove: (productId: string) => api.delete(`/favorites/${productId}`),
};

// ─── Notifications ───
export const notificationsApi = {
  list: (page: number) =>
    api
      .get<Paginated<AppNotification> & { unread: number }>('/notifications', { params: { page, limit: 20 } })
      .then((r) => r.data),
  unreadCount: () => api.get<{ unread: number }>('/notifications/unread-count').then((r) => r.data.unread),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};
