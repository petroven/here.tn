import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, ApiError } from './client';
import { API_URL } from '@/config';
import { useAuthStore } from '@/store/auth';
import { imageUrl, toMillimes, type WebEnvelope } from './web';

/**
 * Espace vendeur — mêmes routes que le tableau de bord vendeur du site
 * (server/src/routes/vendorRoutes.js). Les routes vendeur sont indexées par
 * l'id du compte vendeur, pas par celui de la boutique.
 */

const vendorId = () => {
  const id = useAuthStore.getState().user?.id;
  if (!id) throw new ApiError('UNAUTHORIZED', 'Session expirée.', 401);
  return id;
};

// ─── Types ───

export type SellerOrderStatus =
  | 'en_attente'
  | 'payee'
  | 'preparation'
  | 'expediee'
  | 'en_cours_livraison'
  | 'livree'
  | 'annulee'
  | 'retour'
  | 'litige'
  | 'retournee';

/** Statuts de livraison que le vendeur peut appliquer (machine d'états du site). */
export type ShippingStep = 'en_preparation' | 'expedie' | 'en_cours_livraison' | 'livre';

export type SellerOrder = {
  id: string;
  number: string;
  status: SellerOrderStatus;
  createdAt: string;
  customer: { name: string; phone: string | null } | null;
  address: string;
  items: {
    id: string;
    productId: string;
    name: string;
    imageUrl: string | null;
    quantity: number;
    unitPrice: number;
  }[];
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  /** Timbre fiscal payé par le client (reversé à l'État, hors ventes de la boutique). */
  stampDuty: number;
  total: number;
  commission: number;
  net: number;
  paymentMethod: string;
  paymentStatus: string | null;
  /** COD : le client doit confirmer sa commande (lien SMS) avant l'expédition. */
  awaitingCustomerConfirmation: boolean;
  tracking: { trackingId: string; awb: string | null; status: string } | null;
};

export type SellerStore = {
  id: string;
  name: string;
  description: string | null;
  status: 'en_attente' | 'validee' | 'suspendue';
  kycStatus: 'non_soumis' | 'en_attente' | 'valide' | 'rejete';
  kycComment: string | null;
  kycCin: string | null;
  kycRib: string | null;
  iban: string | null;
};

export type SellerWithdrawal = {
  id: string;
  amount: number;
  status: 'demande' | 'approuve' | 'verse' | 'rejete';
  iban: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export type SellerDashboard = {
  store: SellerStore;
  finances: {
    gross: number;
    commissions: number;
    net: number;
    escrow: number;
    available: number;
    paidOut: number;
    orderCount: number;
  };
  orders: SellerOrder[];
  withdrawals: SellerWithdrawal[];
};

export type SellerStats = {
  today: { revenue: number; orders: number };
  week: { revenue: number; orders: number };
  month: { revenue: number; orders: number };
  itemsSoldMonth: number;
  averageBasketMonth: number;
  returnRate: number;
  commissions: number;
  available: number;
  escrow: number;
  lowStock: number;
  lowStockThreshold: number;
  series: { date: string; revenue: number; orders: number }[];
};

export type SellerVariant = {
  id: string;
  label: string;
  stock: number;
};

export type SellerProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  stock: number;
  status: 'actif' | 'inactif' | 'en_attente';
  categoryId: string | null;
  images: string[];
  variants: SellerVariant[];
};

export type ProductInput = {
  name: string;
  description: string;
  price: number;
  compareAt?: number | null;
  stock?: number;
  categoryId: string | null;
  status: 'actif' | 'inactif';
  /** URLs déjà téléversées (voir uploadImage). */
  images: string[];
};

export type StockFilter = 'tous' | 'faible' | 'rupture';

// ─── Formes brutes de l'API ───

type WebSellerOrder = {
  id: number;
  numeroCommande: string | null;
  statut: SellerOrderStatus;
  createdAt: string;
  adresseLivraison: string;
  sousTotal: number;
  fraisLivraison: number;
  timbreFiscal?: number | null;
  total: number;
  montantCommission: number;
  montantVendeur: number;
  confirmationStatut?: string;
  client?: { nom: string; prenom: string; telephone: string | null } | null;
  guestNom?: string | null;
  guestPrenom?: string | null;
  guestTelephone?: string | null;
  paiement?: { methode: string; statut: string } | null;
  livraison?: { trackingId: string; awbNumber: string | null; statut: string } | null;
  lignes?: {
    id: number;
    produitId: number;
    quantite: number;
    prixUnitaire: number;
    produit?: { nom: string; image: string | null } | null;
  }[];
};

type WebSellerProduct = {
  id: number;
  nom: string;
  description: string;
  prix: number;
  prixAvant: number | null;
  stock: number;
  status: SellerProduct['status'];
  categorieId: number | null;
  image: string | null;
  images: string[] | null;
  variantes?: { id: number; taille: string | null; couleur: string | null; pointure: string | null; stock: number }[];
};

type WebDashboard = {
  boutique: {
    id: number;
    nom: string;
    description: string | null;
    statut: SellerStore['status'];
    kycStatut: SellerStore['kycStatus'];
    kycCommentaireAdmin: string | null;
    kycCin: string | null;
    kycRib: string | null;
    iban: string | null;
  };
  stats: {
    totalVentesBrutes: number;
    totalCommissions: number;
    totalVentes: number;
    soldeEnAttenteEscrow: number;
    soldeDisponible: number;
    totalVerse: number;
    nombreCommandes: number;
  };
  commandes: WebSellerOrder[];
  retraits: {
    id: number;
    montant: number;
    statut: SellerWithdrawal['status'];
    iban: string | null;
    motifRejection: string | null;
    createdAt: string;
  }[];
};

type WebStats = {
  aujourdHui: { ca: number; commandes: number };
  semaine: { ca: number; commandes: number };
  mois: { ca: number; commandes: number };
  produitsVendusMois: number;
  panierMoyenMois: number;
  tauxRetour: number;
  commissions: number;
  soldeDisponible: number;
  sequestre: number;
  stockFaible: number;
  seuilStockFaible: number;
  serie: { date: string; ca: number; commandes: number }[];
};

// ─── Conversions ───

function mapSellerOrder(o: WebSellerOrder): SellerOrder {
  const items = (o.lignes ?? []).map((l) => ({
    id: String(l.id),
    productId: String(l.produitId),
    name: l.produit?.nom ?? `#${l.produitId}`,
    imageUrl: imageUrl(l.produit?.image),
    quantity: l.quantite,
    unitPrice: toMillimes(l.prixUnitaire),
  }));
  const customerName = o.client
    ? `${o.client.prenom} ${o.client.nom}`
    : [o.guestPrenom, o.guestNom].filter(Boolean).join(' ') || null;
  return {
    id: String(o.id),
    number: o.numeroCommande ?? `#${o.id}`,
    status: o.statut,
    createdAt: o.createdAt,
    customer: customerName ? { name: customerName, phone: o.client?.telephone ?? o.guestTelephone ?? null } : null,
    address: o.adresseLivraison,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: toMillimes(o.sousTotal),
    shippingFee: toMillimes(o.fraisLivraison),
    stampDuty: toMillimes(o.timbreFiscal),
    total: toMillimes(o.total),
    commission: toMillimes(o.montantCommission),
    net: toMillimes(o.montantVendeur),
    paymentMethod: o.paiement?.methode ?? 'cod',
    paymentStatus: o.paiement?.statut ?? null,
    awaitingCustomerConfirmation: o.confirmationStatut === 'en_attente',
    tracking: o.livraison
      ? { trackingId: o.livraison.trackingId, awb: o.livraison.awbNumber, status: o.livraison.statut }
      : null,
  };
}

export function mapSellerProduct(p: WebSellerProduct): SellerProduct {
  const gallery = [p.image, ...(p.images ?? [])].filter(
    (src, i, all): src is string => Boolean(src) && all.indexOf(src) === i,
  );
  return {
    id: String(p.id),
    name: p.nom,
    description: p.description,
    price: toMillimes(p.prix),
    compareAt: p.prixAvant ? toMillimes(p.prixAvant) : null,
    stock: p.stock,
    status: p.status,
    categoryId: p.categorieId ? String(p.categorieId) : null,
    images: gallery.map((src) => imageUrl(src)!).filter(Boolean),
    variants: (p.variantes ?? []).map((v) => ({
      id: String(v.id),
      label: [v.taille, v.couleur, v.pointure].filter(Boolean).join(' / ') || `#${v.id}`,
      stock: v.stock,
    })),
  };
}

// Les URLs d'images téléversées sont relatives au serveur (/uploads/…) : on
// renvoie au serveur exactement ce qu'il a fourni, sans l'origine ajoutée
// pour l'affichage.
const rawUrl = (displayed: string) => displayed.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/, '');

const productBody = (input: ProductInput) => {
  const images = input.images.map(rawUrl);
  return {
    nom: input.name.trim(),
    description: input.description.trim(),
    prix: input.price / 1000,
    ...(input.compareAt !== undefined ? { prixAvant: input.compareAt ? input.compareAt / 1000 : '' } : {}),
    ...(input.stock !== undefined ? { stock: input.stock } : {}),
    categorieId: input.categoryId ? Number(input.categoryId) : null,
    status: input.status,
    image: images[0] ?? null,
    images,
  };
};

// ─── Appels ───

export const sellerApi = {
  dashboard: async (): Promise<SellerDashboard> => {
    const { data } = (await api.get<WebEnvelope<WebDashboard>>(`/vendor/dashboard/${vendorId()}`)).data;
    return {
      store: {
        id: String(data.boutique.id),
        name: data.boutique.nom,
        description: data.boutique.description,
        status: data.boutique.statut,
        kycStatus: data.boutique.kycStatut,
        kycComment: data.boutique.kycCommentaireAdmin,
        kycCin: data.boutique.kycCin,
        kycRib: data.boutique.kycRib,
        iban: data.boutique.iban,
      },
      finances: {
        gross: toMillimes(data.stats.totalVentesBrutes),
        commissions: toMillimes(data.stats.totalCommissions),
        net: toMillimes(data.stats.totalVentes),
        escrow: toMillimes(data.stats.soldeEnAttenteEscrow),
        available: toMillimes(data.stats.soldeDisponible),
        paidOut: toMillimes(data.stats.totalVerse),
        orderCount: data.stats.nombreCommandes,
      },
      orders: data.commandes.map(mapSellerOrder),
      withdrawals: data.retraits.map((r) => ({
        id: String(r.id),
        amount: toMillimes(r.montant),
        status: r.statut,
        iban: r.iban,
        rejectionReason: r.motifRejection,
        createdAt: r.createdAt,
      })),
    };
  },

  stats: async (days: 7 | 30 = 7): Promise<SellerStats> => {
    const { data } = (await api.get<WebEnvelope<WebStats>>(`/vendor/stats/${vendorId()}`, { params: { jours: days } }))
      .data;
    const period = (p: { ca: number; commandes: number }) => ({ revenue: toMillimes(p.ca), orders: p.commandes });
    return {
      today: period(data.aujourdHui),
      week: period(data.semaine),
      month: period(data.mois),
      itemsSoldMonth: data.produitsVendusMois,
      averageBasketMonth: toMillimes(data.panierMoyenMois),
      returnRate: data.tauxRetour,
      commissions: toMillimes(data.commissions),
      available: toMillimes(data.soldeDisponible),
      escrow: toMillimes(data.sequestre),
      lowStock: data.stockFaible,
      lowStockThreshold: data.seuilStockFaible,
      series: data.serie.map((p) => ({ date: p.date, revenue: toMillimes(p.ca), orders: p.commandes })),
    };
  },

  /** Avance la commande (préparation → expédition → livraison) ; refus 409 si l'étape est impossible. */
  advanceShipping: async (orderId: string, step: ShippingStep) => {
    await api.put(`/commandes/${orderId}/livraison`, { statut: step });
  },

  orderHistory: async (orderId: string) => {
    const r = await api.get<
      WebEnvelope<{
        historique: {
          id: number;
          nouveauStatut: string;
          ancienStatut: string | null;
          commentaire: string | null;
          createdAt: string;
        }[];
      }>
    >(`/commandes/${orderId}/historique`);
    return r.data.data.historique.map((h) => ({
      id: String(h.id),
      status: h.nouveauStatut,
      event: h.ancienStatut === h.nouveauStatut,
      comment: h.commentaire,
      at: h.createdAt,
    }));
  },

  products: async (filter: StockFilter = 'tous'): Promise<{ items: SellerProduct[]; lowStockThreshold: number }> => {
    const r = await api.get<WebEnvelope<WebSellerProduct[]> & { lowStockThreshold?: number }>(
      `/vendor/products/${vendorId()}`,
      {
        params: filter === 'tous' ? undefined : { stock: filter },
      },
    );
    return { items: r.data.data.map(mapSellerProduct), lowStockThreshold: r.data.lowStockThreshold ?? 5 };
  },

  /** Ajustement relatif (variation) ou absolu (stock), produit ou variante — journalisé côté serveur. */
  adjustStock: async (productId: string, change: { variation?: number; stock?: number; variantId?: string | null }) => {
    const r = await api.patch<WebEnvelope<WebSellerProduct>>(`/vendor/products/${productId}/stock`, {
      ...(change.stock !== undefined ? { stock: change.stock } : { variation: change.variation ?? 0 }),
      varianteId: change.variantId ? Number(change.variantId) : null,
      motif: 'ajustement_mobile',
    });
    return mapSellerProduct(r.data.data);
  },

  /** `idempotencyKey` : une nouvelle tentative avec la même clé renvoie le produit déjà créé. */
  createProduct: async (input: ProductInput, idempotencyKey?: string) => {
    const r = await api.post<WebEnvelope<WebSellerProduct>>(
      `/vendor/products/${vendorId()}`,
      productBody(input),
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    );
    return mapSellerProduct(r.data.data);
  },

  updateProduct: async (productId: string, input: ProductInput) => {
    const r = await api.put<WebEnvelope<WebSellerProduct>>(`/vendor/products/${productId}`, productBody(input));
    return mapSellerProduct(r.data.data);
  },

  deleteProduct: async (productId: string) => {
    await api.delete(`/vendor/products/${productId}`);
  },

  /** Téléverse une photo (Cloudinary ou disque du serveur) et renvoie son URL d'affichage. */
  uploadImage: async (photo: { uri: string; mimeType?: string | null; fileName?: string | null }) => {
    const form = new FormData();
    const type = photo.mimeType ?? 'image/jpeg';
    form.append('image', {
      uri: photo.uri,
      type,
      name: photo.fileName ?? `produit.${type.split('/')[1] ?? 'jpg'}`,
    } as unknown as Blob);
    const r = await api.post<{ url: string }>('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return imageUrl(r.data.url)!;
  },

  /** Décision sur une demande de retour (refus : commentaire conseillé). */
  decideReturn: async (returnId: string, status: 'approuve' | 'refuse' | 'rembourse', comment?: string) => {
    await api.put(`/retours/${returnId}/statut`, { statut: status, commentaireVendeur: comment || undefined });
  },

  requestWithdrawal: async (amount: number, iban: string) => {
    await api.post('/vendor/withdrawal', { vendeurId: Number(vendorId()), montant: amount / 1000, iban });
  },

  /** KYC : numéros CIN et RIB + justificatifs photographiés (déjà fournis = facultatifs). */
  submitKyc: async (input: {
    cin: string;
    rib: string;
    cinDocument?: { uri: string; mimeType?: string | null } | null;
    ribDocument?: { uri: string; mimeType?: string | null } | null;
  }) => {
    const form = new FormData();
    form.append('kycCin', input.cin.trim());
    form.append('kycRib', input.rib.replace(/\s/g, ''));
    const attach = (field: string, doc?: { uri: string; mimeType?: string | null } | null) => {
      if (!doc) return;
      const type = doc.mimeType ?? 'image/jpeg';
      form.append(field, { uri: doc.uri, type, name: `${field}.${type.split('/')[1] ?? 'jpg'}` } as unknown as Blob);
    };
    attach('documentCin', input.cinDocument);
    attach('documentRib', input.ribDocument);
    await api.post(`/vendor/kyc/${vendorId()}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  /** Bordereau d'expédition (AWB) en PDF, ouvert dans la feuille de partage. */
  shareAwb: async (orderId: string, orderNumber: string) => {
    const token = useAuthStore.getState().accessToken;
    if (!token) throw new ApiError('UNAUTHORIZED', 'Session expirée.', 401);
    const destination = new File(Paths.cache, `awb-${orderNumber.replace(/[^\w-]/g, '')}.pdf`);
    const file = await File.downloadFileAsync(`${API_URL}/livraisons/${orderId}/awb`, destination, {
      headers: { Authorization: `Bearer ${token}` },
      idempotent: true,
    });
    if (!(await Sharing.isAvailableAsync())) {
      throw new ApiError('SHARING', 'Le partage de fichiers est indisponible sur cet appareil.');
    }
    await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: orderNumber });
  },
};

/** Étapes encore possibles pour une commande (même règle que la machine d'états du serveur). */
export function nextShippingSteps(order: SellerOrder): ShippingStep[] {
  const rank: Partial<Record<SellerOrderStatus, number>> = {
    en_attente: 0,
    payee: 1,
    preparation: 2,
    expediee: 3,
    en_cours_livraison: 4,
  };
  const current = rank[order.status];
  if (current === undefined) return [];
  const steps: [ShippingStep, number][] = [
    ['en_preparation', 2],
    ['expedie', 3],
    ['en_cours_livraison', 4],
    ['livre', 5],
  ];
  return steps.filter(([, r]) => r > current).map(([step]) => step);
}

/** Une commande payable en ligne mais non payée ne peut pas être préparée. */
export function isAwaitingPayment(order: SellerOrder) {
  return order.status === 'en_attente' && order.paymentMethod !== 'cod' && order.paymentStatus !== 'valide';
}

/** Commandes qui attendent une action du vendeur. */
export function needsAction(order: SellerOrder) {
  return ['en_attente', 'payee', 'preparation'].includes(order.status) && !isAwaitingPayment(order);
}
