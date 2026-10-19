import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api, ApiError } from './client';
import { API_URL } from '@/config';
import { useAuthStore } from '@/store/auth';
import { imageUrl, toMillimes, type WebEnvelope } from './web';
import type {
  BankTransferInfo,
  ChatMessage,
  Conversation,
  Coupon,
  ReturnReason,
  ReturnRequest,
  ReturnStatus,
  Wallet,
} from './types';

/**
 * Espaces personnels du client — mêmes routes que le site (server/) :
 * messagerie avec les boutiques, retours, portefeuille, coupons, facture et
 * moyens de paiement disponibles. Montants convertis en millimes comme
 * partout dans l'app.
 */

// ─── Messagerie ───

type WebParticipant = {
  id: number;
  nom: string;
  prenom: string;
  boutique?: { id: number; nom: string; logo: string | null } | null;
};

type WebConversation = {
  id: number;
  sujet: string | null;
  dernierMessage: string | null;
  dateDernierMessage: string | null;
  clientId: number;
  vendeurId: number;
  client?: WebParticipant | null;
  vendeur?: WebParticipant | null;
};

type WebMessage = {
  id: number;
  contenu: string;
  dateEnvoi: string;
  lu: boolean;
  expediteurId: number;
};

const currentUserId = () => Number(useAuthStore.getState().user?.id ?? 0);

function mapConversation(c: WebConversation): Conversation {
  // Côté client, l'interlocuteur est la boutique ; côté vendeur, le client.
  const iAmClient = Number(c.clientId) === currentUserId();
  const peer = iAmClient ? c.vendeur : c.client;
  return {
    id: String(c.id),
    subject: c.sujet,
    lastMessage: c.dernierMessage,
    lastMessageAt: c.dateDernierMessage,
    peer: {
      userId: String(iAmClient ? c.vendeurId : c.clientId),
      name: (iAmClient ? peer?.boutique?.nom : null) ?? [peer?.prenom, peer?.nom].filter(Boolean).join(' ') ?? '',
      logoUrl: iAmClient ? imageUrl(peer?.boutique?.logo) : null,
    },
  };
}

export const chatApi = {
  conversations: async (): Promise<Conversation[]> => {
    const r = await api.get<WebEnvelope<WebConversation[]>>('/chat/conversations');
    return r.data.data.map(mapConversation);
  },
  /** Ouvre (ou retrouve) la conversation avec le vendeur d'une boutique. */
  open: async (vendorId: string, subject?: string): Promise<Conversation> => {
    const r = await api.post<WebEnvelope<WebConversation>>('/chat/conversations', {
      vendeurId: Number(vendorId),
      sujet: subject,
    });
    return mapConversation(r.data.data);
  },
  /** Lire les messages les marque aussi comme lus côté serveur. */
  messages: async (conversationId: string): Promise<ChatMessage[]> => {
    const r = await api.get<WebEnvelope<WebMessage[]>>(`/chat/conversations/${conversationId}/messages`);
    const me = currentUserId();
    return r.data.data.map((m) => ({
      id: String(m.id),
      body: m.contenu,
      sentAt: m.dateEnvoi,
      mine: Number(m.expediteurId) === me,
      read: m.lu,
    }));
  },
  send: async (conversationId: string, body: string) => {
    await api.post('/chat/messages', {
      conversationId: Number(conversationId),
      contenu: body,
    });
  },
};

// ─── Retours ───

type WebReturn = {
  id: number;
  commandeId: number;
  motif: string;
  motifCategorie: ReturnReason;
  statut: ReturnStatus;
  photos: string[] | null;
  montantRemboursement: number | null;
  commentaireVendeur: string | null;
  dateLimiteReponseVendeur: string | null;
  dateTraitement: string | null;
  createdAt: string;
  Commande?: { id: number; numeroCommande: string | null } | null;
  boutique?: { id: number; nom: string } | null;
  client?: { nom: string; prenom: string } | null;
};

const mapReturn = (r: WebReturn): ReturnRequest => ({
  id: String(r.id),
  orderId: String(r.commandeId),
  orderNumber: r.Commande?.numeroCommande ?? `#${r.commandeId}`,
  storeName: r.boutique?.nom ?? null,
  customerName: r.client ? `${r.client.prenom} ${r.client.nom}` : null,
  reason: r.motif,
  reasonCategory: r.motifCategorie,
  status: r.statut,
  photos: (r.photos ?? []).map((p) => imageUrl(p)).filter((p): p is string => Boolean(p)),
  refundAmount: r.montantRemboursement !== null ? toMillimes(r.montantRemboursement) : null,
  sellerComment: r.commentaireVendeur,
  vendorDeadline: r.dateLimiteReponseVendeur,
  createdAt: r.createdAt,
  processedAt: r.dateTraitement,
});

export const returnsApi = {
  list: async (): Promise<ReturnRequest[]> => {
    const r = await api.get<WebEnvelope<WebReturn[]>>('/retours');
    return r.data.data.map(mapReturn);
  },
  /**
   * Demande de retour : motif catégorisé, description et 1 à 5 photos
   * (obligatoires côté serveur), dans la fenêtre de retour de la commande.
   */
  create: async (input: {
    orderId: string;
    reasonCategory: ReturnReason;
    reason: string;
    photos: {
      uri: string;
      mimeType?: string | null;
      fileName?: string | null;
    }[];
  }): Promise<ReturnRequest> => {
    const form = new FormData();
    form.append('commandeId', input.orderId);
    form.append('motifCategorie', input.reasonCategory);
    form.append('motif', input.reason);
    input.photos.forEach((photo, i) => {
      const type = photo.mimeType ?? 'image/jpeg';
      const extension = type.split('/')[1] ?? 'jpg';
      // Format de fichier attendu par FormData en React Native.
      form.append('photos', {
        uri: photo.uri,
        type,
        name: photo.fileName ?? `retour-${i + 1}.${extension}`,
      } as unknown as Blob);
    });
    const r = await api.post<WebEnvelope<WebReturn>>('/retours', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return mapReturn(r.data.data);
  },
};

// ─── Portefeuille ───

type WebWallet = {
  solde: number;
  transactions: {
    id: number;
    montant: number;
    type: 'credit' | 'debit';
    motif: string;
    createdAt: string;
    Commande?: { numeroCommande: string | null } | null;
  }[];
};

export const walletApi = {
  get: async (): Promise<Wallet> => {
    const r = await api.get<WebEnvelope<WebWallet>>('/wallet/me');
    return {
      balance: toMillimes(r.data.data.solde),
      entries: r.data.data.transactions.map((t) => ({
        id: String(t.id),
        amount: toMillimes(t.montant),
        type: t.type,
        reason: t.motif,
        orderNumber: t.Commande?.numeroCommande ?? null,
        createdAt: t.createdAt,
      })),
    };
  },
};

// ─── Coupons ───

type WebCoupon = {
  code: string;
  type: Coupon['type'];
  valeur: number;
  montantMinimum: number | null;
  dateExpiration: string;
};

export const couponsApi = {
  active: async (): Promise<Coupon[]> => {
    const r = await api.get<WebEnvelope<WebCoupon[]>>('/coupons/actifs');
    return r.data.data.map((c) => ({
      code: c.code,
      type: c.type,
      // Pourcentage gardé tel quel ; montant fixe converti en millimes.
      value: c.type === 'pourcentage' ? c.valeur : toMillimes(c.valeur),
      minimum: toMillimes(c.montantMinimum ?? 0),
      expiresAt: c.dateExpiration,
    }));
  },
};

// ─── Moyens de paiement ───

export const paymentConfigApi = {
  /** Le virement n'est proposé que si un RIB plateforme est configuré côté serveur. */
  get: async () => {
    const r = await api.get<
      WebEnvelope<{ virementDisponible: boolean; paiementTest?: boolean; tvaTaux?: number; timbreFiscal?: number }>
    >(
      '/config/payment-methods',
    );
    return {
      bankTransfer: r.data.data.virementDisponible,
      // Paiements en ligne en mode test : badge « Test » sur Konnect / Flouci.
      testMode: r.data.data.paiementTest ?? false,
      // Prix TTC : TVA comprise (taux) ; timbre fiscal (millimes) ajouté par commande.
      vatRate: r.data.data.tvaTaux ?? 0.19,
      stampDuty: toMillimes(r.data.data.timbreFiscal ?? 1),
    };
  },
};

export function mapBankTransfer(
  v:
    | {
        titulaire: string;
        rib: string;
        banque: string;
        montant: number;
        reference: string;
      }
    | null
    | undefined,
): BankTransferInfo | null {
  if (!v) return null;
  return {
    holder: v.titulaire,
    rib: v.rib,
    bank: v.banque,
    amount: toMillimes(v.montant),
    reference: v.reference,
  };
}

// ─── Facture ───

/**
 * Télécharge la facture PDF d'une commande (route protégée : le jeton passe
 * en en-tête) puis ouvre la feuille de partage du système (enregistrer,
 * imprimer, envoyer par WhatsApp/email…).
 */
export async function shareInvoice(orderId: string, orderNumber: string, lang: 'fr' | 'ar') {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new ApiError('UNAUTHORIZED', 'Connectez-vous pour télécharger la facture.', 401);
  const destination = new File(Paths.cache, `facture-${orderNumber.replace(/[^\w-]/g, '')}.pdf`);
  const file = await File.downloadFileAsync(`${API_URL}/commandes/${orderId}/facture?lang=${lang}`, destination, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new ApiError('SHARING', 'Le partage de fichiers est indisponible sur cet appareil.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: orderNumber,
  });
}
