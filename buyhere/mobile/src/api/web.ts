import { API_ORIGIN } from '@/config';
import type {
  Category,
  Governorate,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductCard,
  ProductDetail,
  Review,
  User,
} from './types';

/**
 * Formes brutes renvoyées par l'API du site web (server/) et conversion vers
 * les types de l'app. L'API web parle français (nom, prix, commande…),
 * utilise des identifiants numériques et des montants en TND ; l'app
 * travaille en millimes avec des identifiants texte.
 */

export type WebEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
  pagination?: { page: number; limit: number; totalPages: number };
  count?: number;
};

export type WebUser = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  telephone?: string | null;
  photo?: string | null;
  soldeWallet?: number;
  createdAt?: string;
};

export type WebCategory = { id: number; nom: string; slug: string | null; icone: string | null };

export type WebVariant = {
  id: number;
  taille: string | null;
  couleur: string | null;
  pointure: string | null;
  stock: number;
  prixSupplement: number;
  image: string | null;
};

export type WebProduct = {
  id: number;
  nom: string;
  description: string;
  marque: string | null;
  prix: number;
  prixAvant: number | null;
  stock: number;
  image: string | null;
  images: string[] | null;
  boutiqueId: number;
  boutique?: { id: number; nom: string } | null;
  categorie?: { id: number; nom: string } | null;
  variantes?: WebVariant[];
  note?: number | string | null;
  nombreAvis?: number | string | null;
  Avis?: WebReview[];
};

export type WebReview = {
  id: number;
  note: number;
  commentaire: string | null;
  createdAt: string;
  auteur?: { prenom: string; nom: string } | null;
};

export type WebOrder = {
  id: number;
  numeroCommande: string | null;
  statut: 'en_attente' | 'payee' | 'expediee' | 'livree' | 'annulee' | 'retournee';
  sousTotal: number;
  fraisLivraison: number;
  remiseCoupon: number;
  walletUtilise: number;
  total: number;
  couponCode: string | null;
  adresseLivraison: string;
  gouvernoratId: number | null;
  confirmationStatut?: string;
  confirmationDate?: string | null;
  createdAt: string;
  updatedAt: string;
  boutique?: { id: number; nom: string } | null;
  paiement?: { methode: string; statut: string } | null;
  livraison?: {
    trackingId: string;
    statut: string;
    historiqueStatuts?: { statut: string; date: string }[] | null;
  } | null;
  lignes?: {
    id: number;
    produitId: number;
    varianteId: number | null;
    quantite: number;
    prixUnitaire: number;
    produit?: { nom: string; image: string | null } | null;
  }[];
};

export type WebGovernorate = { id: number; nom: string; nomAr: string | null; fraisLivraison: number };

/** TND (float) → millimes (entier). */
export const toMillimes = (tnd: number | string | null | undefined) => Math.round(Number(tnd || 0) * 1000);

/** Les uploads vendeurs sont des chemins relatifs (/uploads/...) : on préfixe l'origine du serveur. */
export function imageUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//.test(src)) return src;
  return `${API_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`;
}

export function mapUser(u: WebUser): User {
  return {
    id: String(u.id),
    email: u.email,
    phone: u.telephone ?? null,
    firstName: u.prenom,
    lastName: u.nom,
    avatarUrl: imageUrl(u.photo),
    role: u.role,
    language: 'fr',
    createdAt: u.createdAt ?? new Date().toISOString(),
    walletBalance: toMillimes(u.soldeWallet),
  };
}

/** Icône Lucide devinée à partir du nom de la catégorie (voir CategoryItem). */
function categoryIcon(name: string): string | null {
  const n = name.toLowerCase();
  if (/mode|vêtement|vetement|chauss|textile/.test(n)) return 'shirt';
  if (/électro|electro|phone|téléphone|informatique|high-tech|tech/.test(n)) return 'smartphone';
  if (/beauté|beaute|cosmét|cosmet|parfum|soin/.test(n)) return 'sparkles';
  if (/maison|déco|deco|meuble|cuisine/.test(n)) return 'sofa';
  if (/sport|fitness/.test(n)) return 'dumbbell';
  return null;
}

export function mapCategory(c: WebCategory): Category {
  // Le « slug » de l'app sert de filtre : on y met l'id numérique attendu par /produits?categoryId=
  return { id: String(c.id), slug: String(c.id), name: c.nom, imageUrl: null, icon: c.icone ?? categoryIcon(c.nom) };
}

export function mapProductCard(p: WebProduct, favoriteIds?: Set<string>): ProductCard {
  const price = toMillimes(p.prix);
  const compareAt = p.prixAvant && p.prixAvant > p.prix ? toMillimes(p.prixAvant) : null;
  const variants = p.variantes ?? [];
  const inStock = variants.length ? variants.some((v) => v.stock > 0) : p.stock > 0;
  return {
    id: String(p.id),
    slug: String(p.id),
    name: p.nom,
    price,
    compareAt,
    discountPercent: compareAt ? Math.round((1 - price / compareAt) * 100) : 0,
    imageUrl: imageUrl(p.image ?? p.images?.[0]),
    rating: Math.round(Number(p.note || 0) * 10) / 10,
    ratingCount: Number(p.nombreAvis || 0),
    inStock,
    isFlash: false,
    flashEndsAt: null,
    category: { slug: String(p.categorie?.id ?? ''), name: p.categorie?.nom ?? '' },
    isFavorite: favoriteIds?.has(String(p.id)) ?? false,
    store: p.boutique ? { id: String(p.boutique.id), name: p.boutique.nom } : null,
  };
}

export function mapProductDetail(p: WebProduct, similar: ProductCard[]): ProductDetail {
  const card = mapProductCard(p);
  const variants = (p.variantes ?? []).map((v) => ({
    id: String(v.id),
    size: v.taille ?? v.pointure ?? null,
    color: v.couleur ?? null,
    colorHex: null,
    price: toMillimes(p.prix + (v.prixSupplement || 0)),
    stock: v.stock,
  }));
  const gallery = [p.image, ...(p.images ?? [])].filter((src, i, all): src is string => !!src && all.indexOf(src) === i);
  const unique = <T,>(values: (T | null)[]) => [...new Set(values.filter((v): v is T => v != null))];

  return {
    ...card,
    description: p.description,
    brand: p.marque,
    stock: variants.length ? variants.reduce((sum, v) => sum + v.stock, 0) : p.stock,
    soldCount: 0,
    images: gallery.map((src, i) => ({ id: String(i), url: imageUrl(src)! })),
    category: { id: String(p.categorie?.id ?? ''), slug: String(p.categorie?.id ?? ''), name: p.categorie?.nom ?? '' },
    options: {
      sizes: unique(variants.map((v) => v.size)),
      colors: unique(variants.map((v) => v.color)).map((name) => ({ name, hex: null })),
    },
    variants,
    similar: similar.filter((s) => s.id !== card.id),
  };
}

export function mapReview(r: WebReview): Review {
  const author = r.auteur ? `${r.auteur.prenom} ${r.auteur.nom.charAt(0)}.` : 'Client BuyHere';
  return { id: String(r.id), rating: r.note, comment: r.commentaire, createdAt: r.createdAt, author, avatarUrl: null };
}

const PAYMENT_METHODS: Record<string, PaymentMethod> = {
  cod: 'CASH_ON_DELIVERY',
  konnect: 'KONNECT',
  flouci: 'FLOUCI',
  carte: 'CARD',
  virement: 'BANK_TRANSFER',
};
export const toWebPaymentMethod = (m: PaymentMethod) =>
  (Object.keys(PAYMENT_METHODS) as string[]).find((k) => PAYMENT_METHODS[k] === m) ?? 'cod';

const PAYMENT_STATUS: Record<string, PaymentStatus> = {
  valide: 'PAID',
  paye_livraison: 'PAID',
  en_attente_livraison: 'UNPAID',
  en_attente: 'PENDING',
  en_attente_validation: 'PENDING',
  echec: 'FAILED',
};

/**
 * Statut affiché : la livraison fait foi une fois le colis parti (une commande
 * COD livrée repasse en « payee » côté web au moment de l'encaissement).
 */
function orderStatus(o: WebOrder): OrderStatus {
  if (o.statut === 'annulee' || o.statut === 'retournee') return 'CANCELLED';
  const shipping = o.livraison?.statut;
  if (o.statut === 'livree' || shipping === 'livre') return 'DELIVERED';
  if (o.statut === 'expediee' || shipping === 'expedie' || shipping === 'en_cours_livraison') return 'SHIPPED';
  if (o.statut === 'payee' || o.confirmationStatut === 'confirmee') return 'CONFIRMED';
  return 'PENDING';
}

function orderHistory(o: WebOrder, status: OrderStatus): Order['history'] {
  const history: Order['history'] = [{ status: 'PENDING', note: null, at: o.createdAt }];
  const add = (s: OrderStatus, at: string) => {
    if (!history.some((h) => h.status === s)) history.push({ status: s, note: null, at });
  };
  if (status !== 'PENDING' && status !== 'CANCELLED') add('CONFIRMED', o.confirmationDate ?? o.createdAt);
  for (const h of o.livraison?.historiqueStatuts ?? []) {
    if (h.statut === 'expedie' || h.statut === 'en_cours_livraison') add('SHIPPED', h.date);
    if (h.statut === 'livre') add('DELIVERED', h.date);
  }
  if (status === 'CANCELLED') add('CANCELLED', o.updatedAt);
  return history;
}

export function mapOrder(o: WebOrder, ctx: { governorates: Governorate[] }): Order {
  const status = orderStatus(o);
  const lines = o.lignes ?? [];
  const items = lines.map((l) => ({
    id: String(l.id),
    productId: String(l.produitId),
    name: l.produit?.nom ?? '',
    imageUrl: imageUrl(l.produit?.image),
    size: null,
    color: null,
    unitPrice: toMillimes(l.prixUnitaire),
    quantity: l.quantite,
    lineTotal: toMillimes(l.prixUnitaire * l.quantite),
  }));
  const governorate = ctx.governorates.find((g) => g.id === o.gouvernoratId)?.name ?? '';

  return {
    id: String(o.id),
    number: o.numeroCommande ?? `#${o.id}`,
    status,
    paymentMethod: PAYMENT_METHODS[o.paiement?.methode ?? 'cod'] ?? 'CASH_ON_DELIVERY',
    paymentStatus: PAYMENT_STATUS[o.paiement?.statut ?? ''] ?? (o.statut === 'payee' ? 'PAID' : 'UNPAID'),
    subtotal: toMillimes(o.sousTotal),
    discount: toMillimes(o.remiseCoupon + (o.walletUtilise || 0)),
    shippingFee: toMillimes(o.fraisLivraison),
    total: toMillimes(o.total),
    couponCode: o.couponCode,
    trackingId: o.livraison?.trackingId ?? null,
    store: o.boutique ? { id: String(o.boutique.id), name: o.boutique.nom } : null,
    // Le site stocke l'adresse en un seul texte (nom et téléphone inclus quand elle vient de l'app).
    shippingAddress: {
      fullName: '',
      phone: '',
      governorate,
      city: '',
      street: o.adresseLivraison,
    },
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    history: orderHistory(o, status),
    createdAt: o.createdAt,
  };
}

export const mapGovernorate = (g: WebGovernorate): Governorate => ({
  id: g.id,
  name: g.nom,
  nameAr: g.nomAr,
  shippingFee: toMillimes(g.fraisLivraison),
});
