import { Op } from 'sequelize';
import { Livraison, Livreur, Commande, Boutique, NotificationLivreur } from '../models/index.js';
import { calculateDistanceKm } from './geo.js';
import { marketplaceConfig } from '../config/marketplace.js';
import { getIo } from '../realtime/io.js';

// Cascade state lost on server restart (documented MVP limitation — see plan).
// Map<livraisonId, { candidates: [{livreurId, distanceKm}], index: number }>
const cascadeState = new Map();
// Map<notificationId, NodeJS.Timeout>
const activeTimers = new Map();

function clearTimerFor(notificationId) {
  const timer = activeTimers.get(notificationId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(notificationId);
  }
}

export function isEffectivelyExpired(notification) {
  return notification.statut === 'envoyee' && new Date(notification.dateExpiration) < new Date();
}

async function buildCandidateList(livraison) {
  const boutique = livraison.Commande?.boutique;
  const disponibles = await Livreur.findAll({ where: { statut: 'disponible' } });

  if (!boutique?.latitude || !boutique?.longitude) {
    // Degraded mode: no pickup coordinates known — every disponible courier is a candidate,
    // notified one at a time via the same cascade (intentional MVP fallback, not a bug).
    return disponibles
      .sort((a, b) => a.id - b.id)
      .map((l) => ({ livreurId: l.id, distanceKm: null }));
  }

  return disponibles
    .filter((l) => l.latitude !== null && l.longitude !== null)
    .map((l) => ({
      livreurId: l.id,
      distanceKm: calculateDistanceKm(boutique.latitude, boutique.longitude, l.latitude, l.longitude),
    }))
    .filter((c) => c.distanceKm !== null && c.distanceKm <= marketplaceConfig.courierMatching.searchRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

async function notifyNextCandidate(livraisonId, candidates, index) {
  if (index >= candidates.length) {
    console.log(`[MATCHING] Aucun livreur n'a répondu pour livraison #${livraisonId}.`);
    cascadeState.delete(livraisonId);
    return;
  }

  const candidate = candidates[index];
  const { notificationTimeoutSeconds } = marketplaceConfig.courierMatching;
  const dateExpiration = new Date(Date.now() + notificationTimeoutSeconds * 1000);

  const notification = await NotificationLivreur.create({
    livraisonId,
    livreurId: candidate.livreurId,
    distanceKm: candidate.distanceKm,
    ordre: index,
    statut: 'envoyee',
    dateEnvoi: new Date(),
    dateExpiration,
  });

  cascadeState.set(livraisonId, { candidates, index });

  const livraison = await Livraison.findByPk(livraisonId, {
    include: [{ model: Commande, include: [{ model: Boutique, as: 'boutique' }] }],
  });

  try {
    getIo().to(`livreur:${candidate.livreurId}`).emit('notification:nouvelle', {
      notificationId: notification.id,
      livraisonId,
      trackingId: livraison?.trackingId,
      distanceKm: candidate.distanceKm,
      adresseDepart: livraison?.Commande?.boutique?.adresse || null,
      adresseArrivee: livraison?.Commande?.adresseLivraison || null,
      fraisLivraison: livraison?.fraisLivraison,
      expiresAt: dateExpiration.toISOString(),
    });
  } catch (error) {
    console.error('[MATCHING] Socket.io non initialisé, notification créée sans push:', error.message);
  }

  const timer = setTimeout(() => {
    handleNotificationTimeout(notification.id).catch((err) =>
      console.error('[MATCHING] Erreur lors du cascade/timeout:', err),
    );
  }, notificationTimeoutSeconds * 1000);
  activeTimers.set(notification.id, timer);
}

async function advanceCascade(livraisonId, index) {
  const state = cascadeState.get(livraisonId);
  if (state) {
    await notifyNextCandidate(livraisonId, state.candidates, index + 1);
    return;
  }

  // In-memory cascade state was lost (e.g. server restart) — re-derive candidates from scratch.
  const livraison = await Livraison.findByPk(livraisonId);
  if (!livraison || livraison.statutAssignation !== 'en_attente' || livraison.livreurId) return;
  await matchAndNotifyCourierForLivraison(livraisonId);
}

export async function handleNotificationTimeout(notificationId) {
  const notification = await NotificationLivreur.findByPk(notificationId);
  if (!notification || notification.statut !== 'envoyee') return;

  await notification.update({ statut: 'expiree' });
  clearTimerFor(notificationId);
  await advanceCascade(notification.livraisonId, notification.ordre);
}

export async function refuseNotification(notificationId, livreurId) {
  const notification = await NotificationLivreur.findOne({ where: { id: notificationId, livreurId } });
  if (!notification) return { success: false, message: 'Notification introuvable.' };
  if (notification.statut !== 'envoyee') return { success: false, message: 'Notification déjà traitée.' };

  await notification.update({ statut: 'refusee', dateReponse: new Date() });
  clearTimerFor(notificationId);
  await advanceCascade(notification.livraisonId, notification.ordre);
  return { success: true };
}

export async function cancelPendingNotificationsForLivraison(livraisonId, exceptNotificationId) {
  const pending = await NotificationLivreur.findAll({
    where: { livraisonId, statut: 'envoyee', id: { [Op.ne]: exceptNotificationId } },
  });

  for (const notification of pending) {
    clearTimerFor(notification.id);
    await notification.update({ statut: 'expiree' });
    try {
      getIo().to(`livreur:${notification.livreurId}`).emit('notification:prise', { livraisonId });
    } catch {
      // Socket.io unavailable — courier will reconcile via GET /livreur/notifications/pending
    }
  }

  cascadeState.delete(livraisonId);
}

export async function matchAndNotifyCourierForLivraison(livraisonId) {
  const livraison = await Livraison.findByPk(livraisonId, {
    include: [{ model: Commande, include: [{ model: Boutique, as: 'boutique' }] }],
  });

  if (!livraison) return { notified: false, reason: 'livraison_introuvable' };
  if (livraison.statutAssignation !== 'en_attente' || livraison.livreurId) {
    return { notified: false, reason: 'deja_assignee' };
  }

  const candidates = await buildCandidateList(livraison);
  if (candidates.length === 0) {
    return { notified: false, reason: 'aucun_livreur_disponible' };
  }

  await notifyNextCandidate(livraisonId, candidates, 0);
  return { notified: true, reason: 'notification_envoyee' };
}
