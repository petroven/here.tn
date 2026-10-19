import { api } from './client';
import { imageUrl, toMillimes, type WebEnvelope } from './web';

/**
 * Espace administrateur — mêmes routes que le tableau de bord admin du site
 * (server/src/routes/adminRoutes.js), réservées aux rôles administrateur et
 * super_admin. Montants convertis en millimes.
 */

export const ADMIN_ROLES = ['administrateur', 'super_admin'];

// ─── Types ───

export type AdminStats = {
  stores: { total: number; verified: number; pending: number };
  orders: number;
  products: { total: number; lowStock: number; lowStockThreshold: number };
  commission: number;
  users: { total: number; vendors: number; customers: number };
};

export type StoreStatus = 'en_attente' | 'validee' | 'suspendue';
export type KycStatus = 'non_soumis' | 'en_attente' | 'valide' | 'rejete';

export type AdminStore = {
  id: string;
  name: string;
  status: StoreStatus;
  logoUrl: string | null;
  address: string | null;
  acceptedTerms: boolean;
  vendor: { name: string; email: string | null; phone: string | null } | null;
  kyc: {
    status: KycStatus;
    cin: string | null;
    rib: string | null;
    cinDocument: string | null;
    ribDocument: string | null;
    comment: string | null;
    submittedAt: string | null;
  };
  stats: { net: number; gross: number; commissions: number; orders: number; available: number };
  createdAt: string;
};

export type WithdrawalStatus = 'demande' | 'approuve' | 'verse' | 'rejete';
export type AdminWithdrawal = {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  iban: string | null;
  rejectionReason: string | null;
  storeName: string;
  vendorEmail: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type AdminTransfer = {
  id: string;
  amount: number;
  status: 'en_attente' | 'en_attente_validation' | 'valide' | 'echec' | string;
  reference: string | null;
  orderId: string | null;
  orderNumber: string | null;
  orderStatus: string | null;
  customer: { name: string; email: string | null; phone: string | null } | null;
  storeName: string | null;
  createdAt: string;
};

export type AdminReview = {
  id: string;
  rating: number;
  comment: string | null;
  visible: boolean;
  verified: boolean;
  author: string;
  productId: string | null;
  productName: string | null;
  createdAt: string;
};

export type OrderStatusFr =
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

export type AdminOrder = {
  id: string;
  number: string;
  status: OrderStatusFr;
  total: number;
  address: string;
  customer: { name: string; email: string | null; phone: string | null; guest: boolean };
  storeName: string | null;
  createdAt: string;
};

export type AdminOrderEvent = {
  id: string;
  from: string | null;
  to: string;
  comment: string | null;
  author: string | null;
  createdAt: string;
};

export type ProductStatus = 'actif' | 'inactif' | 'en_attente';
export type AdminProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  status: ProductStatus;
  imageUrl: string | null;
  storeName: string | null;
  categoryName: string | null;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  provider: string;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  comment: string | null;
  createdAt: string;
};

// ─── Machine d'états des commandes (copie de server/src/utils/orderStatus.js) ───

const MAIN_PATH: OrderStatusFr[] = ['en_attente', 'payee', 'preparation', 'expediee', 'en_cours_livraison', 'livree'];
const BRANCHES: Partial<Record<OrderStatusFr, OrderStatusFr[]>> = {
  en_attente: ['annulee'],
  payee: ['annulee'],
  preparation: ['annulee'],
  en_cours_livraison: ['expediee'],
  livree: ['retour'],
  retour: ['litige', 'livree', 'retournee'],
  litige: ['livree', 'retournee'],
};

/** Statuts qu'un admin peut appliquer à une commande (le serveur revérifie). */
export function nextOrderStatuses(status: OrderStatusFr): OrderStatusFr[] {
  const i = MAIN_PATH.indexOf(status);
  const forward = i === -1 ? [] : MAIN_PATH.slice(i + 1);
  return [...forward, ...(BRANCHES[status] ?? [])].filter((s, k, all) => all.indexOf(s) === k);
}

// ─── Mapping ───

type WebUserLite = { nom?: string; prenom?: string; email?: string; telephone?: string | null } | null | undefined;
const fullName = (u: WebUserLite) => (u ? `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() : '');

type WebStore = {
  id: number;
  nom: string;
  statut: StoreStatus;
  logo: string | null;
  adresse: string | null;
  accepteConditionsRetour: boolean;
  kycStatut: KycStatus;
  kycCin: string | null;
  kycRib: string | null;
  kycDocumentCin: string | null;
  kycDocumentRib: string | null;
  kycCommentaireAdmin: string | null;
  kycDateSoumission: string | null;
  createdAt: string;
  vendeur?: WebUserLite;
  stats?: {
    totalVentes: number;
    totalVentesBrutes: number;
    totalCommissions: number;
    nombreCommandes: number;
    soldeDisponible: number;
  };
};

const mapStore = (b: WebStore): AdminStore => ({
  id: String(b.id),
  name: b.nom,
  status: b.statut,
  logoUrl: imageUrl(b.logo),
  address: b.adresse,
  acceptedTerms: !!b.accepteConditionsRetour,
  vendor: b.vendeur
    ? { name: fullName(b.vendeur), email: b.vendeur.email ?? null, phone: b.vendeur.telephone ?? null }
    : null,
  kyc: {
    status: b.kycStatut,
    cin: b.kycCin,
    rib: b.kycRib,
    cinDocument: imageUrl(b.kycDocumentCin),
    ribDocument: imageUrl(b.kycDocumentRib),
    comment: b.kycCommentaireAdmin,
    submittedAt: b.kycDateSoumission,
  },
  stats: {
    net: toMillimes(b.stats?.totalVentes),
    gross: toMillimes(b.stats?.totalVentesBrutes),
    commissions: toMillimes(b.stats?.totalCommissions),
    orders: b.stats?.nombreCommandes ?? 0,
    available: toMillimes(b.stats?.soldeDisponible),
  },
  createdAt: b.createdAt,
});

// ─── Endpoints ───

export const adminApi = {
  stats: async (): Promise<AdminStats> => {
    const { data } = await api.get<
      WebEnvelope<{
        vendors: { total: number; verified: number; pending: number };
        orders: { total: number };
        products: { total: number; lowStock: number; lowStockThreshold: number };
        revenue: { commission: number };
        users: { total: number; vendors: number; customers: number };
      }>
    >('/admin/stats');
    const s = data.data;
    return {
      stores: s.vendors,
      orders: s.orders.total,
      products: s.products,
      commission: toMillimes(s.revenue.commission),
      users: s.users,
    };
  },

  stores: async (): Promise<AdminStore[]> => {
    const { data } = await api.get<WebEnvelope<WebStore[]>>('/admin/vendors');
    return data.data.map(mapStore);
  },

  setStoreStatus: (storeId: string, statut: StoreStatus) =>
    api.patch(`/admin/boutiques/${storeId}/statut`, { statut }).then(() => undefined),

  decideKyc: (storeId: string, kycStatut: 'valide' | 'rejete', comment?: string) =>
    api
      .patch(`/admin/boutiques/${storeId}/kyc`, { kycStatut, kycCommentaireAdmin: comment || undefined })
      .then(() => undefined),

  withdrawals: async (): Promise<AdminWithdrawal[]> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          montant: number;
          statut: WithdrawalStatus;
          iban: string | null;
          motifRejection: string | null;
          dateRetrait: string | null;
          createdAt: string;
          Boutique?: { nom: string; vendeur?: WebUserLite } | null;
        }[]
      >
    >('/admin/withdrawals');
    return data.data.map((r) => ({
      id: String(r.id),
      amount: toMillimes(r.montant),
      status: r.statut,
      iban: r.iban,
      rejectionReason: r.motifRejection,
      storeName: r.Boutique?.nom ?? '—',
      vendorEmail: r.Boutique?.vendeur?.email ?? null,
      createdAt: r.createdAt,
      paidAt: r.dateRetrait,
    }));
  },

  decideWithdrawal: (id: string, statut: 'approuve' | 'verse' | 'rejete', reason?: string) =>
    api.put(`/admin/withdrawals/${id}`, { statut, motifRejection: reason || undefined }).then(() => undefined),

  transfers: async (): Promise<AdminTransfer[]> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          montant: number;
          statut: string;
          referenceVirement: string | null;
          reference: string | null;
          createdAt: string;
          Commande?: {
            id: number;
            numeroCommande: string | null;
            statut: string;
            client?: WebUserLite;
            boutique?: { nom: string } | null;
          } | null;
        }[]
      >
    >('/admin/virements');
    return data.data.map((p) => ({
      id: String(p.id),
      amount: toMillimes(p.montant),
      status: p.statut,
      reference: p.referenceVirement || p.reference,
      orderId: p.Commande ? String(p.Commande.id) : null,
      orderNumber: p.Commande?.numeroCommande ?? null,
      orderStatus: p.Commande?.statut ?? null,
      customer: p.Commande?.client
        ? {
            name: fullName(p.Commande.client),
            email: p.Commande.client.email ?? null,
            phone: p.Commande.client.telephone ?? null,
          }
        : null,
      storeName: p.Commande?.boutique?.nom ?? null,
      createdAt: p.createdAt,
    }));
  },

  validateTransfer: (id: string) => api.patch(`/admin/virements/${id}/valider`).then(() => undefined),
  rejectTransfer: (id: string) => api.patch(`/admin/virements/${id}/rejeter`).then(() => undefined),

  reviews: async (): Promise<AdminReview[]> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          note: number;
          commentaire: string | null;
          valide: boolean;
          verifie: boolean;
          createdAt: string;
          auteur?: WebUserLite;
          produit?: { id: number; nom: string } | null;
        }[]
      >
    >('/admin/avis');
    return data.data.map((a) => ({
      id: String(a.id),
      rating: a.note,
      comment: a.commentaire,
      visible: a.valide,
      verified: a.verifie,
      author: fullName(a.auteur) || '—',
      productId: a.produit ? String(a.produit.id) : null,
      productName: a.produit?.nom ?? null,
      createdAt: a.createdAt,
    }));
  },

  setReviewVisible: (id: string, visible: boolean) =>
    api.patch(`/admin/avis/${id}`, { valide: visible }).then(() => undefined),

  orders: async (): Promise<AdminOrder[]> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          numeroCommande: string | null;
          statut: OrderStatusFr;
          total: number;
          adresseLivraison: string;
          createdAt: string;
          guestNom?: string | null;
          guestPrenom?: string | null;
          guestEmail?: string | null;
          guestTelephone?: string | null;
          client?: WebUserLite;
          boutique?: { nom: string } | null;
        }[]
      >
    >('/admin/orders');
    return data.data.map((o) => ({
      id: String(o.id),
      number: o.numeroCommande ?? `#${o.id}`,
      status: o.statut,
      total: toMillimes(o.total),
      address: o.adresseLivraison,
      customer: o.client
        ? { name: fullName(o.client), email: o.client.email ?? null, phone: o.client.telephone ?? null, guest: false }
        : {
            name: `${o.guestPrenom ?? ''} ${o.guestNom ?? ''}`.trim() || '—',
            email: o.guestEmail ?? null,
            phone: o.guestTelephone ?? null,
            guest: true,
          },
      storeName: o.boutique?.nom ?? null,
      createdAt: o.createdAt,
    }));
  },

  orderHistory: async (id: string): Promise<AdminOrderEvent[]> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          ancienStatut: string | null;
          nouveauStatut: string;
          commentaire: string | null;
          createdAt: string;
          utilisateur?: (WebUserLite & { role?: string }) | null;
        }[]
      >
    >(`/admin/orders/${id}/historique`);
    return data.data.map((h) => ({
      id: String(h.id),
      from: h.ancienStatut,
      to: h.nouveauStatut,
      comment: h.commentaire,
      author: h.utilisateur ? fullName(h.utilisateur) : null,
      createdAt: h.createdAt,
    }));
  },

  /** Changement manuel : commentaire obligatoire, transition vérifiée par le serveur. */
  setOrderStatus: (id: string, statut: OrderStatusFr, commentaire: string) =>
    api.patch(`/admin/orders/${id}/statut`, { statut, commentaire }).then(() => undefined),

  products: async (lowStock = false): Promise<{ items: AdminProduct[]; lowStockThreshold: number }> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          nom: string;
          prix: number;
          stock: number;
          status: ProductStatus;
          image: string | null;
          images?: string[] | null;
          boutique?: { nom: string } | null;
          categorie?: { nom: string } | null;
        }[]
      > & { lowStockThreshold?: number }
    >('/admin/products', { params: lowStock ? { stock: 'faible' } : undefined });
    return {
      lowStockThreshold: data.lowStockThreshold ?? 5,
      items: data.data.map((p) => ({
        id: String(p.id),
        name: p.nom,
        price: toMillimes(p.prix),
        stock: p.stock,
        status: p.status,
        imageUrl: imageUrl(p.image ?? p.images?.[0] ?? null),
        storeName: p.boutique?.nom ?? null,
        categoryName: p.categorie?.nom ?? null,
      })),
    };
  },

  setProductStatus: (id: string, status: ProductStatus) =>
    api.patch(`/admin/products/${id}/status`, { status }).then(() => undefined),

  users: async (): Promise<AdminUser[]> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          nom: string;
          prenom: string;
          email: string;
          telephone: string | null;
          role: string;
          provider: string;
          createdAt: string;
        }[]
      >
    >('/admin/users');
    return data.data.map((u) => ({
      id: String(u.id),
      name: `${u.prenom} ${u.nom}`.trim(),
      email: u.email,
      phone: u.telephone,
      role: u.role,
      provider: u.provider,
      createdAt: u.createdAt,
    }));
  },

  auditLogs: async (page: number): Promise<{ items: AuditEntry[]; total: number; limit: number }> => {
    const { data } = await api.get<
      WebEnvelope<
        {
          id: number;
          action: string;
          entite: string;
          entiteId: number | null;
          avant: Record<string, unknown> | null;
          apres: Record<string, unknown> | null;
          commentaire: string | null;
          acteurRole: string | null;
          createdAt: string;
          acteur?: WebUserLite;
        }[]
      > & { pagination: { page: number; limit: number; total: number } }
    >('/admin/audit-logs', { params: { page, limit: 30 } });
    return {
      total: data.pagination.total,
      limit: data.pagination.limit,
      items: data.data.map((e) => ({
        id: String(e.id),
        action: e.action,
        entity: e.entite,
        entityId: e.entiteId != null ? String(e.entiteId) : null,
        actor: e.acteur ? fullName(e.acteur) || e.acteur.email || null : e.acteurRole,
        before: e.avant,
        after: e.apres,
        comment: e.commentaire,
        createdAt: e.createdAt,
      })),
    };
  },

  categories: async (): Promise<{ id: string; name: string; imageUrl: string | null }[]> => {
    const { data } = await api.get<WebEnvelope<{ id: number; nom: string; image?: string | null }[]>>('/categories');
    return data.data.map((c) => ({ id: String(c.id), name: c.nom, imageUrl: imageUrl(c.image ?? null) }));
  },

  /** Photo de catégorie : envoi (POST /upload) puis enregistrement de l'URL. null = photo automatique. */
  setCategoryImage: async (id: string, uri: string | null) => {
    let image: string | null = null;
    if (uri) {
      const name = uri.split('/').pop() || 'categorie.jpg';
      const form = new FormData();
      form.append('image', { uri, name, type: name.endsWith('.png') ? 'image/png' : 'image/jpeg' } as unknown as Blob);
      const { data } = await api.post<{ url: string }>('/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      image = data.url;
    }
    await api.patch(`/admin/categories/${id}`, { image });
  },
};
