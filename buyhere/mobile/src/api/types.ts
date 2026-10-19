/**
 * Modèle de données utilisé par les écrans de l'app.
 * Les réponses de l'API web (server/, champs en français, montants en TND)
 * sont converties vers ces types dans api/web.ts.
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
  /** Rôle du site web : seuls les comptes « client » peuvent commander. */
  role: string;
  language: Language;
  createdAt: string;
  /** Solde BuyHere (cashback), en millimes. */
  walletBalance: number;
};

export type AuthResponse = { user: User; accessToken: string };

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
  /** Sous-catégories (comme le tiroir des catégories du site). */
  children?: Category[];
};

/** Boutique d'un vendeur (pages « Boutiques » du site). */
export type Store = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  category: string | null;
  governorate: string | null;
  productCount: number;
  verified: boolean;
  seller: { firstName: string; lastName: string; photoUrl: string | null } | null;
  /** Compte du vendeur : destinataire des messages « Contacter la boutique ». */
  vendorId: string | null;
};

export type StoreReview = {
  id: string;
  author: string;
  productName: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type StoreDetail = Store & {
  address: string | null;
  products: ProductCard[];
  rating: { average: number; count: number; reviews: StoreReview[] };
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
  store: { id: string; name: string; vendorId?: string | null } | null;
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
  storeId: string | null;
};

export type Cart = {
  items: CartLine[];
  itemCount: number;
  couponCode: string | null;
  couponError: string | null;
  subtotal: number;
  discount: number;
  /** null : dépend du gouvernorat, calculé au moment du paiement. */
  shippingFee: number | null;
  total: number;
};

export type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  /** Nom du gouvernorat (affichage) + identifiants de l'API pour la commande. */
  governorate: string;
  governorateId: number;
  delegationId: number;
  city: string;
  street: string;
  postalCode: string | null;
  isDefault: boolean;
};

export type AddressInput = Omit<Address, 'id' | 'postalCode'> & { postalCode?: string };

/**
 * Statuts affichés — miroir de la machine d'états du site
 * (server/src/utils/orderStatus.js) : en_attente → payee/confirmée →
 * preparation → expediee → en_cours_livraison → livree, puis retour /
 * remboursement, ou annulation.
 */
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURN_REQUESTED'
  | 'REFUNDED'
  | 'CANCELLED';

/** Livreur assigné à la commande, visible par le client pendant la course. */
export type Courier = {
  name: string;
  phone: string | null;
  vehicle: 'moto' | 'voiture' | 'velo' | 'camionnette' | null;
  rating: number | null;
  position: { latitude: number; longitude: number; updatedAt: string | null } | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  /** 'assignee' = récupère le colis, 'en_cours' = en route vers le client */
  stage: 'assignee' | 'en_cours';
};
/** Précision d'un point géocodé : l'adresse exacte, ou à défaut le centre de la zone. */
export type MapPrecision = 'adresse' | 'delegation' | 'gouvernorat';
export type MapPoint = { latitude: number; longitude: number; precision?: MapPrecision };
/** Carte de suivi d'une commande (points absents tant qu'ils ne sont pas connus). */
export type OrderMap = {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  courier: MapPoint | null;
  storeName: string | null;
};
export type PaymentMethod = 'CASH_ON_DELIVERY' | 'KONNECT' | 'FLOUCI' | 'CARD' | 'BANK_TRANSFER';
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
  /** TVA comprise (prix TTC) ; null sur les commandes antérieures à son enregistrement. */
  vat: number | null;
  /** Timbre fiscal ajouté au total (0 sur les anciennes commandes). */
  stampDuty: number;
  total: number;
  couponCode: string | null;
  trackingId: string | null;
  store: { id: string; name: string; vendorId: string | null } | null;
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
  courier: Courier | null;
  map: OrderMap | null;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  type: 'ORDER' | 'PROMO' | 'SYSTEM';
  title: string;
  body: string;
  /** link : chemin d'app (ex. 'commande/12') ouvert au toucher via le deep linking. */
  data: { orderId?: string; link?: string | null } | null;
  readAt: string | null;
  createdAt: string;
};

/** Format d'erreur renvoyé par l'API web. */
export type ApiErrorBody = { success: false; message?: string };

export type Governorate = { id: number; name: string; nameAr: string | null; shippingFee: number };
export type Delegation = { id: number; name: string; nameAr: string | null };

export type Conversation = {
  id: string;
  subject: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  /** L'autre participant : la boutique côté client. */
  peer: { userId: string; name: string; logoUrl: string | null };
};

export type ChatMessage = {
  id: string;
  body: string;
  sentAt: string;
  mine: boolean;
  read: boolean;
};

export type ReturnReason = 'defaut' | 'non_conforme' | 'changement_avis';
export type ReturnStatus = 'demande' | 'approuve' | 'refuse' | 'rembourse' | 'litige';

export type ReturnRequest = {
  id: string;
  orderId: string;
  orderNumber: string;
  storeName: string | null;
  /** Renseigné pour le vendeur (le client voit sa propre demande). */
  customerName: string | null;
  reason: string;
  reasonCategory: ReturnReason;
  status: ReturnStatus;
  photos: string[];
  refundAmount: number | null;
  sellerComment: string | null;
  vendorDeadline: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type WalletEntry = {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string;
  orderNumber: string | null;
  createdAt: string;
};

export type Wallet = { balance: number; entries: WalletEntry[] };

export type Coupon = {
  code: string;
  type: 'pourcentage' | 'montant_fixe';
  value: number;
  minimum: number;
  expiresAt: string;
};

export type BankTransferInfo = { holder: string; rib: string; bank: string; amount: number; reference: string };
