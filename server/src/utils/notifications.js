import { Op } from 'sequelize';
import { Notification, PushToken, Boutique, Utilisateur } from '../models/index.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo refuse plus de 100 messages par requête.
const EXPO_LOT_MAX = 100;

// Pas d'envoi réseau pendant les tests automatisés, ni quand l'opérateur le
// coupe explicitement (PUSH_NOTIFICATIONS=off) — la notification in-app est
// toujours enregistrée, seule la livraison push est sautée.
function pushActif() {
  return process.env.NODE_ENV !== 'test' && process.env.PUSH_NOTIFICATIONS !== 'off';
}

// Le service Expo Push ne demande aucune clé : un jeton ExponentPushToken[…]
// suffit. Les jetons signalés DeviceNotRegistered (app désinstallée,
// permission retirée) sont supprimés pour ne plus être réessayés.
// Renvoie le nombre de messages acceptés par Expo ; tout refus (HTTP ou
// ticket en erreur) est journalisé, jamais compté comme un succès.
export async function envoyerPushExpo(tokens, contenu) {
  if (!tokens.length || !pushActif()) return 0;
  let acceptes = 0;
  for (let debut = 0; debut < tokens.length; debut += EXPO_LOT_MAX) {
    acceptes += await envoyerLotExpo(tokens.slice(debut, debut + EXPO_LOT_MAX), contenu);
  }
  return acceptes;
}

async function envoyerLotExpo(tokens, { titre, message, lien, data }) {
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
    if (!response.ok) {
      console.error(`[PUSH] Échec envoi Expo : HTTP ${response.status}`, json?.errors || '');
      return 0;
    }
    const tickets = Array.isArray(json?.data) ? json.data : [];
    const erreurs = tickets.filter((ticket) => ticket?.status === 'error');
    for (const ticket of erreurs) {
      if (ticket?.details?.error !== 'DeviceNotRegistered') {
        console.error('[PUSH] Message refusé par Expo :', ticket.details?.error || ticket.message);
      }
    }
    const invalides = tickets
      .map((ticket, index) => (ticket?.details?.error === 'DeviceNotRegistered' ? tokens[index]?.token : null))
      .filter(Boolean);
    if (invalides.length) await PushToken.destroy({ where: { token: invalides } });
    return tickets.filter((ticket) => ticket?.status === 'ok').length;
  } catch (error) {
    console.error('[PUSH] Échec envoi Expo:', error.message);
    return 0;
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

// Comptes clients joignables : les comptes supprimés (anonymisés) sont exclus.
async function idsClients() {
  const clients = await Utilisateur.findAll({
    where: { role: 'client', compteSupprime: { [Op.not]: true } },
    attributes: ['id'],
    raw: true,
  });
  return clients.map((client) => client.id);
}

/**
 * Annonce à tous les clients (promotion, nouveauté…) envoyée depuis le
 * tableau de bord admin : une Notification par client (cloche du site,
 * écran Notifications de l'app) et un push Expo sur chacun de leurs
 * appareils. Les comptes supprimés sont exclus.
 *
 * Renvoie { clients, appareils, envoyes } : envoyes compte les messages
 * acceptés par Expo (0 si le push est coupé, voir pushActif).
 */
export async function diffuserAuxClients({ titre, message, lien = null }) {
  const ids = await idsClients();
  if (!ids.length) return { clients: 0, appareils: 0, envoyes: 0 };

  const LOT_SQL = 500;
  for (let debut = 0; debut < ids.length; debut += LOT_SQL) {
    await Notification.bulkCreate(ids.slice(debut, debut + LOT_SQL).map((utilisateurId) => ({
      utilisateurId, type: 'annonce', titre, message, lien,
    })));
  }

  const tokens = await PushToken.findAll({ where: { utilisateurId: ids }, attributes: ['token'] });
  const envoyes = await envoyerPushExpo(tokens, { titre, message, lien, data: { type: 'annonce' } });
  return { clients: ids.length, appareils: tokens.length, envoyes };
}

/** Nombre de clients et d'appareils qu'atteindrait une annonce. */
export async function audienceClients() {
  const ids = await idsClients();
  const appareils = ids.length ? await PushToken.count({ where: { utilisateurId: ids } }) : 0;
  return { clients: ids.length, appareils };
}
