import { api } from './client';
import { toMillimes, type WebEnvelope } from './web';
import { sessionFrom } from './endpoints';
import type { AuthResponse } from './types';

/**
 * Espace livreur — mêmes routes que le tableau de bord livreur du site
 * (server/src/routes/livreurRoutes.js). Montants convertis en millimes.
 */

// ─── Types ───

export type CourierStatus = 'disponible' | 'occupe' | 'hors_ligne';
export type CourseStatus = 'en_attente' | 'assignee' | 'en_cours' | 'livree' | 'echec';
export type VehicleType = 'moto' | 'voiture' | 'velo' | 'camionnette';

export type Course = {
  id: string;
  trackingId: string;
  status: CourseStatus;
  /** Rémunération du livreur (frais de livraison). */
  fee: number;
  /** Distance livreur → client, null si une des positions est inconnue. */
  distanceKm: number | null;
  orderNumber: string;
  orderTotal: number;
  /** Montant à encaisser auprès du client (paiement à la livraison non encore réglé). */
  cashToCollect: number;
  pickup: { name: string; address: string | null; coords: { latitude: number; longitude: number } | null };
  dropoff: {
    name: string;
    phone: string | null;
    address: string | null;
    coords: { latitude: number; longitude: number } | null;
  };
  updatedAt: string;
  deliveredAt: string | null;
};

export type CourierCourses = { available: Course[]; active: Course[] };

export type CourierStats = {
  status: CourierStatus;
  deliveries: number;
  rating: number;
  earningsToday: number;
  earningsWeek: number;
};

export type CourierHistory = { courses: Course[]; earnings: number };

/** Course proposée au livreur : à accepter avant expiresAt (cascade du serveur). */
export type CourseOffer = {
  notificationId: string;
  courseId: string;
  trackingId: string | null;
  distanceKm: number | null;
  pickupAddress: string | null;
  dropoffAddress: string | null;
  fee: number;
  expiresAt: string;
};

// ─── Mapping (formats de l'API web) ───

type WebCourse = {
  id: number;
  trackingId: string;
  statutAssignation: CourseStatus;
  fraisLivraison: number | null;
  distanceEstimeeKm?: number | null;
  latitudeArrivee: number | null;
  longitudeArrivee: number | null;
  latitudeDepart?: number | null;
  longitudeDepart?: number | null;
  updatedAt: string;
  dateLivraison: string | null;
  Commande?: {
    numeroCommande: string | null;
    total: number;
    adresseLivraison: string | null;
    guestNom?: string | null;
    guestPrenom?: string | null;
    guestTelephone?: string | null;
    client?: { nom: string; prenom: string; telephone: string | null } | null;
    boutique?: { nom: string; adresse: string | null } | null;
    paiement?: { methode: string; statut: string } | null;
  } | null;
};

function mapCourse(c: WebCourse): Course {
  const o = c.Commande ?? null;
  const client = o?.client;
  const name = client
    ? `${client.prenom} ${client.nom}`.trim()
    : `${o?.guestPrenom ?? ''} ${o?.guestNom ?? ''}`.trim();
  const cod = o?.paiement?.methode === 'cod' && o.paiement.statut === 'en_attente_livraison';
  return {
    id: String(c.id),
    trackingId: c.trackingId,
    status: c.statutAssignation,
    fee: toMillimes(c.fraisLivraison),
    distanceKm: typeof c.distanceEstimeeKm === 'number' ? c.distanceEstimeeKm : null,
    orderNumber: o?.numeroCommande ?? c.trackingId,
    orderTotal: toMillimes(o?.total),
    cashToCollect: cod ? toMillimes(o?.total) : 0,
    pickup: {
      name: o?.boutique?.nom ?? '',
      address: o?.boutique?.adresse || null,
      coords:
        c.latitudeDepart != null && c.longitudeDepart != null
          ? { latitude: c.latitudeDepart, longitude: c.longitudeDepart }
          : null,
    },
    dropoff: {
      name,
      phone: client?.telephone || o?.guestTelephone || null,
      address: o?.adresseLivraison || null,
      coords:
        c.latitudeArrivee != null && c.longitudeArrivee != null
          ? { latitude: c.latitudeArrivee, longitude: c.longitudeArrivee }
          : null,
    },
    updatedAt: c.updatedAt,
    deliveredAt: c.dateLivraison,
  };
}

type WebOffer = {
  notificationId: number;
  livraisonId: number;
  trackingId?: string | null;
  distanceKm: number | null;
  adresseDepart: string | null;
  adresseArrivee: string | null;
  fraisLivraison: number | null;
  expiresAt: string;
};

const mapOffer = (n: WebOffer): CourseOffer => ({
  notificationId: String(n.notificationId),
  courseId: String(n.livraisonId),
  trackingId: n.trackingId ?? null,
  distanceKm: typeof n.distanceKm === 'number' ? n.distanceKm : null,
  pickupAddress: n.adresseDepart,
  dropoffAddress: n.adresseArrivee,
  fee: toMillimes(n.fraisLivraison),
  expiresAt: n.expiresAt,
});

// ─── Endpoints ───

export const courierApi = {
  courses: async (): Promise<CourierCourses> => {
    const { data } = await api.get<WebEnvelope<{ disponibles: WebCourse[]; enCours: WebCourse[] }>>(
      '/livreur/courses',
    );
    return { available: data.data.disponibles.map(mapCourse), active: data.data.enCours.map(mapCourse) };
  },

  stats: async (): Promise<CourierStats> => {
    const { data } = await api.get<
      WebEnvelope<{
        statut: CourierStatus;
        nombreLivraisons: number;
        noteMoyenne: number;
        gainsJour: number;
        gainsSemaine: number;
      }>
    >('/livreur/stats');
    const s = data.data;
    return {
      status: s.statut,
      deliveries: s.nombreLivraisons,
      rating: Number(s.noteMoyenne || 0),
      earningsToday: toMillimes(s.gainsJour),
      earningsWeek: toMillimes(s.gainsSemaine),
    };
  },

  history: async (): Promise<CourierHistory> => {
    const { data } = await api.get<WebEnvelope<{ courses: WebCourse[]; gains: number }>>('/livreur/historique');
    return { courses: data.data.courses.map(mapCourse), earnings: toMillimes(data.data.gains) };
  },

  setStatus: (statut: CourierStatus) => api.patch('/livreur/statut', { statut }).then(() => undefined),

  sendPosition: (latitude: number, longitude: number) =>
    api.patch('/livreur/position', { latitude, longitude }).then(() => undefined),

  /** 409 si un autre livreur l'a prise entre-temps (message du serveur). */
  accept: (courseId: string) => api.patch(`/livreur/courses/${courseId}/accepter`).then(() => undefined),

  /** en_cours = colis récupéré ; livree = remis au client ; echec = remis dans le pool. */
  setCourseStatus: (courseId: string, statut: 'en_cours' | 'livree' | 'echec') =>
    api.patch(`/livreur/courses/${courseId}/statut`, { statut }).then(() => undefined),

  /** Photo de preuve (champ multipart « preuve »), à envoyer avant de marquer livré. */
  uploadProof: async (courseId: string, uri: string) => {
    const name = uri.split('/').pop() || 'preuve.jpg';
    const form = new FormData();
    form.append('preuve', { uri, name, type: name.endsWith('.png') ? 'image/png' : 'image/jpeg' } as unknown as Blob);
    await api.post(`/livreur/courses/${courseId}/preuve`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  pendingOffer: async (): Promise<CourseOffer | null> => {
    const { data } = await api.get<WebEnvelope<WebOffer | null>>('/livreur/notifications/pending');
    return data.data ? mapOffer(data.data) : null;
  },

  acceptOffer: (notificationId: string) =>
    api.patch(`/livreur/notifications/${notificationId}/accepter`).then(() => undefined),

  refuseOffer: (notificationId: string) =>
    api.patch(`/livreur/notifications/${notificationId}/refuser`).then(() => undefined),

  /** Crée un compte livreur (nouvel email) et renvoie sa session. */
  register: async (input: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    vehicle: VehicleType;
  }): Promise<AuthResponse> => {
    const { data } = await api.post<{ token: string }>('/livreur/register', {
      prenom: input.firstName.trim(),
      nom: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      telephone: input.phone.replace(/\s/g, ''),
      password: input.password,
      vehiculeType: input.vehicle,
    });
    return sessionFrom(data.token);
  },
};
