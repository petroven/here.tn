/**
 * Types des réponses de l'API BuyHere.
 * Tous les montants sont en MILLIMES (1 DT = 1000) — voir utils/format.ts.
 */

export type Language = 'fr' | 'ar';

export type User = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: 'CUSTOMER' | 'ADMIN';
  language: Language;
  createdAt: string;
};

export type AuthResponse = { user: User; accessToken: string; refreshToken: string };

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  icon: string | null;
  productCount?: number;
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAt: number | null;
  discountPercent: number;
  imageUrl: string | null;
  rating: number;
  ratingCount: number;
  inStock: boolean;
  isFlash: boolean;
  flashEndsAt: string | null;
  category: { slug: string; name: string };
  isFavorite: boolean;
};

export type ProductVariant = {
  id: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  price: number;
  stock: number;
};

export type ProductDetail = Omit<ProductCard, 'imageUrl' | 'category'> & {
  description: string;
  brand: string | null;
  stock: number;
  soldCount: number;
  images: { id: string; url: string }[];
  category: { id: string; slug: string; name: string };
  options: { sizes: string[]; colors: { name: string; hex: string | null }[] };
  variants: ProductVariant[];
  similar: ProductCard[];
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  target: string | null; // "category:<slug>" | "product:<slug>"
};

export type HomeData = {
  banners: Banner[];
  categories: Category[];
  flashEndsAt: string | null;
  flash: ProductCard[];
  popular: ProductCard[];
  newest: ProductCard[];
};

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popular';

export type ProductFilters = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  onSale?: boolean;
  flash?: boolean;
  featured?: boolean;
  sort?: ProductSort;
};

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: string;
  avatarUrl: string | null;
};

export type ReviewsPage = Paginated<Review> & { distribution: Record<string, number> };

export type CartLine = {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  imageUrl: string | null;
  size: string | null;
  color: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: number;
  isAvailable: boolean;
};

export type Cart = {
  items: CartLine[];
  itemCount: number;
  couponCode: string | null;
  couponError: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  freeShippingThreshold: number;
  total: number;
};

export type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  postalCode: string | null;
  isDefault: boolean;
};

export type AddressInput = Omit<Address, 'id' | 'postalCode'> & { postalCode?: string };

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'CASH_ON_DELIVERY' | 'KONNECT' | 'FLOUCI';
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponCode: string | null;
  note: string | null;
  shippingAddress: { fullName: string; phone: string; governorate: string; city: string; street: string };
  items: {
    id: string;
    productId: string | null;
    name: string;
    imageUrl: string | null;
    size: string | null;
    color: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
  itemCount: number;
  history: { status: OrderStatus; note: string | null; at: string }[];
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: 'ORDER' | 'PROMO' | 'SYSTEM';
  title: string;
  body: string;
  data: { orderId?: string } | null;
  readAt: string | null;
  createdAt: string;
};

/** Format d'erreur unique renvoyé par l'API. */
export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};
