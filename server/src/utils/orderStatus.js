import { Commande, HistoriqueCommande } from '../models/index.js';
import { notifier, apresCommit } from './notifications.js';

/**
 * Machine d'états des commandes — SEUL endroit autorisé à modifier
 * Commande.statut après sa création. Chaque transition est validée puis
 * historisée (HistoriqueCommande) et notifiée au client.
 *
 * Parcours principal (on peut avancer de plusieurs crans d'un coup, ex: une
 * commande COD passe d'en_attente à preparation sans jamais être 'payee' —
 * elle est encaissée à la livraison) :
 *
 *   en_attente → payee → preparation → expediee → en_cours_livraison → livree
 *
 * Branches :
 *   en_attente | payee | preparation   → annulee      (avant remise au transporteur)
 *   en_cours_livraison                 → expediee     (échec de livraison, nouvelle tentative)
 *   livree                             → retour       (demande de retour ouverte)
 *   retour                             → litige | livree (retour refusé) | retournee (remboursée)
 *   litige                             → livree | retournee
 *
 * annulee et retournee sont terminaux. Toute marche arrière hors de ces
 * branches (livree → payee, annulee → expediee, retournee → livree…) est
 * refusée.
 */
export const PARCOURS_PRINCIPAL = ['en_attente', 'payee', 'preparation', 'expediee', 'en_cours_livraison', 'livree'];

const BRANCHES = {
  en_attente: ['annulee'],
  payee: ['annulee'],
  preparation: ['annulee'],
  en_cours_livraison: ['expediee'],
  livree: ['retour'],
  retour: ['litige', 'livree', 'retournee'],
  litige: ['livree', 'retournee'],
  annulee: [],
  retournee: [],
};

export const STATUTS_COMMANDE = [...PARCOURS_PRINCIPAL, 'annulee', 'retour', 'litige', 'retournee'];

export const LIBELLES_STATUT = {
  en_attente: { fr: 'Commande passée', ar: 'تم تقديم الطلب' },
  payee: { fr: 'Paiement confirmé', ar: 'تم تأكيد الدفع' },
  preparation: { fr: 'En préparation', ar: 'قيد التحضير' },
  expediee: { fr: 'Expédiée', ar: 'تم الشحن' },
  en_cours_livraison: { fr: 'En cours de livraison', ar: 'في الطريق إليك' },
  livree: { fr: 'Livrée', ar: 'تم التسليم' },
  annulee: { fr: 'Annulée', ar: 'ملغاة' },
  retour: { fr: 'Retour demandé', ar: 'طلب إرجاع' },
  litige: { fr: 'Retour en médiation', ar: 'إرجاع قيد الوساطة' },
  retournee: { fr: 'Remboursée', ar: 'تم الاسترداد' },
};

// Livraison.statut (transporteur) → Commande.statut correspondant.
export const STATUT_COMMANDE_PAR_LIVRAISON = {
  en_preparation: 'preparation',
  expedie: 'expediee',
  en_cours_livraison: 'en_cours_livraison',
  livre: 'livree',
};

export class TransitionInvalideError extends Error {
  constructor(depuis, vers) {
    super(`Transition de commande impossible : « ${LIBELLES_STATUT[depuis]?.fr || depuis} » → « ${LIBELLES_STATUT[vers]?.fr || vers} ».`);
    this.name = 'TransitionInvalideError';
    this.status = 409;
  }
}

export function peutTransitionner(depuis, vers) {
  if (!STATUTS_COMMANDE.includes(vers) || depuis === vers) return false;
  if ((BRANCHES[depuis] || []).includes(vers)) return true;
  const i = PARCOURS_PRINCIPAL.indexOf(depuis);
  const j = PARCOURS_PRINCIPAL.indexOf(vers);
  return i !== -1 && j !== -1 && j > i;
}

// Notification client par statut atteint — lien = deep link mobile
// (buyhere://commande/<id>) et route du site (/commandes).
const NOTIFICATIONS_CLIENT = {
  payee: { type: 'paiement_confirme', titre: 'Paiement confirmé', message: (c) => `Le paiement de votre commande ${c.numeroCommande} a été confirmé.` },
  preparation: { type: 'commande_preparation', titre: 'Commande en préparation', message: (c) => `La boutique prépare votre commande ${c.numeroCommande}.` },
  expediee: { type: 'commande_expediee', titre: 'Commande expédiée', message: (c) => `Votre commande ${c.numeroCommande} a été expédiée.` },
  en_cours_livraison: { type: 'livreur_en_route', titre: 'Livreur en route', message: (c) => `Votre commande ${c.numeroCommande} est en cours de livraison.` },
  livree: { type: 'commande_livree', titre: 'Commande livrée', message: (c) => `Votre commande ${c.numeroCommande} a été livrée. Bonne réception !` },
  annulee: { type: 'commande_annulee', titre: 'Commande annulée', message: (c) => `Votre commande ${c.numeroCommande} a été annulée.` },
  retournee: { type: 'remboursement', titre: 'Remboursement effectué', message: (c) => `Le remboursement de votre commande ${c.numeroCommande} a été crédité sur votre solde.` },
};

/**
 * Ajoute une ligne à la chronologie sans changer le statut (ex: commande
 * passée, confirmation COD par le client, livreur assigné).
 */
export async function ajouterEvenementCommande(commande, { statut = commande.statut, ancienStatut = commande.statut, utilisateurId = null, commentaire = null, transaction } = {}) {
  return HistoriqueCommande.create({
    commandeId: commande.id,
    ancienStatut,
    nouveauStatut: statut,
    utilisateurId,
    commentaire,
  }, { transaction });
}

/**
 * Fait passer une commande à un nouveau statut. Lève TransitionInvalideError
 * (status 409) si la transition est interdite. Rechargement verrouillé de la
 * ligne dans la transaction : deux requêtes concurrentes ne peuvent pas
 * valider chacune une transition depuis le même état de départ.
 *
 * @param {Commande|number} commandeOuId
 * @param {string} nouveauStatut
 * @param {{ utilisateurId?: number|null, commentaire?: string|null, transaction?: any, notifierClient?: boolean }} options
 */
export async function changerStatutCommande(commandeOuId, nouveauStatut, {
  utilisateurId = null, commentaire = null, transaction, notifierClient = true,
} = {}) {
  const id = typeof commandeOuId === 'object' ? commandeOuId.id : commandeOuId;
  const commande = await Commande.findByPk(id, { transaction, lock: transaction ? true : undefined });
  if (!commande) throw Object.assign(new Error('Commande introuvable.'), { status: 404 });

  const ancienStatut = commande.statut;
  if (!peutTransitionner(ancienStatut, nouveauStatut)) {
    throw new TransitionInvalideError(ancienStatut, nouveauStatut);
  }

  // UPDATE conditionnel sur l'ancien statut : si une autre requête a changé
  // la commande entre la lecture et l'écriture (SQLite ignore le verrou de
  // ligne), aucune ligne n'est touchée et la transition est refusée.
  const [affected] = await Commande.update(
    { statut: nouveauStatut },
    { where: { id, statut: ancienStatut }, transaction },
  );
  if (affected === 0) throw new TransitionInvalideError(ancienStatut, nouveauStatut);

  await HistoriqueCommande.create({
    commandeId: id, ancienStatut, nouveauStatut, utilisateurId, commentaire,
  }, { transaction });

  commande.statut = nouveauStatut;
  if (typeof commandeOuId === 'object') commandeOuId.statut = nouveauStatut;

  const notif = NOTIFICATIONS_CLIENT[nouveauStatut];
  if (notifierClient && notif && commande.clientId) {
    apresCommit(transaction, () => notifier(commande.clientId, {
      type: notif.type,
      titre: notif.titre,
      message: notif.message(commande),
      lien: `commande/${commande.id}`,
      data: { commandeId: commande.id, statut: nouveauStatut },
    }));
  }

  return commande;
}

/**
 * Variante tolérante pour les synchronisations automatiques (ex: statut
 * transporteur → statut commande) : ne fait rien si la commande est déjà
 * dans ce statut ou si la transition n'a pas de sens, au lieu de lever.
 */
export async function synchroniserStatutCommande(commandeOuId, nouveauStatut, options = {}) {
  try {
    return await changerStatutCommande(commandeOuId, nouveauStatut, options);
  } catch (error) {
    if (error instanceof TransitionInvalideError) return null;
    throw error;
  }
}

/**
 * Une commande ne peut entrer en préparation/expédition que si elle est
 * payée, ou payable à la livraison (COD). Un virement ou un paiement en
 * ligne encore en attente bloque la préparation.
 */
export function verifierPaiementAvantExpedition(commande, paiement) {
  if (commande.statut !== 'en_attente') return null;
  if (!paiement || paiement.methode === 'cod') return null;
  if (paiement.statut === 'valide') return null;
  return 'Cette commande n\'est pas encore payée : elle ne peut pas être préparée ni expédiée.';
}

/** Chronologie d'une commande, du plus ancien au plus récent. */
export async function getHistoriqueCommande(commandeId) {
  return HistoriqueCommande.findAll({
    where: { commandeId },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
  });
}
