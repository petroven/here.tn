import { Notification, PushToken, Boutique } from '../models/index.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Pas d'envoi réseau pendant les tests automatisés, ni quand l'opérateur le
// coupe explicitement (PUSH_NOTIFICATIONS=off) — la notification in-app est
// toujours enregistrée, seule la livraison push est sautée.
function pushActif() {
  return process.env.NODE_ENV !== 'test' && process.env.PUSH_NOTIFICATIONS !== 'off';
}

// Le service Expo Push ne demande aucune clé : un jeton ExponentPushToken[…]
// suffit. Les jetons signalés DeviceNotRegistered (app désinstallée,
// permission retirée) sont supprimés pour ne plus être réessayés.
async function envoyerPushExpo(tokens, { titre, message, lien, data }) {
  if (!tokens.length || !pushActif()) return;
  const messages = tokens.map((t) => ({
    to: t.token,
    title: titre,
    body: message,
    sound: 'default',
    data: { ...(data || {}), lien: lien || null },
  }));
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await response.json().catch(() => null);
    const tickets = Array.isArray(json?.data) ? json.data : [];
    const invalides = tickets
      .map((ticket, index) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokens[index]?.token : null))
      .filter(Boolean);
    if (invalides.length) await PushToken.destroy({ where: { token: invalides } });
  } catch (error) {
    console.error('[PUSH] Échec envoi Expo:', error.message);
  }
}

/**
 * Notifie un utilisateur : ligne Notification (cloche du site, écran
 * Notifications de l'app) + push Expo sur tous ses appareils. Ne lève
 * jamais — une notification ratée ne doit pas faire échouer l'action
 * métier qui l'a déclenchée.
 *
 * À appeler APRÈS le commit d'une transaction (voir apresCommit) : SQLite
 * n'accepte qu'un écrivain à la fois, une écriture hors transaction pendant
 * qu'elle est ouverte resterait bloquée.
 */
export async function notifier(utilisateurId, { type, titre, message, lien = null, data = null }) {
  if (!utilisateurId) return null; // invité : aucun compte à notifier
  try {
    const notification = await Notification.create({ utilisateurId, type, titre, message, lien, data });
    const tokens = await PushToken.findAll({ where: { utilisateurId } });
    envoyerPushExpo(tokens, { titre, message, lien, data: { ...(data || {}), type, notificationId: notification.id } });
    return notification;
  } catch (error) {
    console.error('[NOTIF] Échec création notification:', error.message);
    return null;
  }
}

/**
 * Push seul, sans ligne Notification : pour les alertes éphémères (offre de
 * course livreur valable quelques secondes) qui n'ont rien à faire dans
 * l'historique. Ne lève jamais.
 */
export async function pousser(utilisateurId, { type, titre, message, lien = null, data = null }) {
  if (!utilisateurId) return;
  try {
    const tokens = await PushToken.findAll({ where: { utilisateurId } });
    await envoyerPushExpo(tokens, { titre, message, lien, data: { ...(data || {}), type } });
  } catch (error) {
    console.error('[PUSH] Échec push:', error.message);
  }
}

/** Notifie le vendeur propriétaire d'une boutique. */
export async function notifierVendeur(boutiqueId, payload) {
  try {
    const boutique = await Boutique.findByPk(boutiqueId, { attributes: ['id', 'vendeurId'] });
    if (boutique?.vendeurId) return notifier(boutique.vendeurId, payload);
  } catch (error) {
    console.error('[NOTIF] Échec notification vendeur:', error.message);
  }
  return null;
}

/**
 * Exécute fn après le commit de la transaction si elle existe, sinon tout
 * de suite. Sert à différer les notifications et autres effets de bord
 * jusqu'à ce que les données soient réellement en base.
 */
export function apresCommit(transaction, fn) {
  const run = () => Promise.resolve().then(fn).catch((error) => console.error('[NOTIF] Effet différé en échec:', error.message));
  if (transaction) {
    transaction.afterCommit(run);
    return Promise.resolve();
  }
  return run();
}
