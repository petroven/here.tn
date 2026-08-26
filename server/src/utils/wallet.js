import { Commande, Utilisateur, WalletTransaction } from '../models/index.js';
import { marketplaceConfig } from '../config/marketplace.js';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

/**
 * Credits the client's wallet with cashback once a payment is truly
 * finalized (webhook confirmation, sandbox confirmation, or COD collected
 * at delivery). Idempotent — safe to call again on webhook retries.
 */
export async function crediterCashback(commandeId) {
  const commande = await Commande.findByPk(commandeId);
  if (!commande) return;

  const existing = await WalletTransaction.findOne({ where: { commandeId, motif: 'cashback' } });
  if (existing) return;

  const montant = roundMoney(Number(commande.sousTotal) * marketplaceConfig.wallet.cashbackRate);
  if (montant <= 0) return;

  const utilisateur = await Utilisateur.findByPk(commande.clientId);
  if (!utilisateur) return;

  await utilisateur.update({ soldeWallet: roundMoney(Number(utilisateur.soldeWallet) + montant) });
  await WalletTransaction.create({
    utilisateurId: commande.clientId,
    commandeId,
    montant,
    type: 'credit',
    motif: 'cashback',
  });
}

/**
 * Credits a refund to the client's wallet balance once a return has been
 * approved for reimbursement — the site's return policy pays refunds out
 * as wallet credit only, never back to the original payment method.
 * Idempotent — safe to call again on retry.
 */
export async function crediterRemboursement(retour) {
  const existing = await WalletTransaction.findOne({
    where: { retourId: retour.id, motif: 'remboursement' },
  });
  if (existing) return;

  const montant = roundMoney(Number(retour.montantRemboursement) || 0);
  if (montant <= 0) return;

  const utilisateur = await Utilisateur.findByPk(retour.clientId);
  if (!utilisateur) return;

  await utilisateur.update({ soldeWallet: roundMoney(Number(utilisateur.soldeWallet) + montant) });
  await WalletTransaction.create({
    utilisateurId: retour.clientId,
    commandeId: retour.commandeId,
    retourId: retour.id,
    montant,
    type: 'credit',
    motif: 'remboursement',
  });
}

/**
 * Rembourse un client qui a annulé sa commande lui-même avant expédition —
 * toujours le solde wallet déjà déduit à la création (indépendamment du
 * paiement), plus le montant payé via l'autre moyen de paiement s'il avait
 * réellement été collecté (statut paiement 'valide' — jamais pour du COD non
 * encore encaissé ou un virement pas encore confirmé, puisque rien n'a
 * changé de main dans ces cas). Idempotent.
 */
export async function crediterAnnulationCommande(commande) {
  const existing = await WalletTransaction.findOne({ where: { commandeId: commande.id, motif: 'annulation' } });
  if (existing) return;

  const walletUtilise = Number(commande.walletUtilise || 0);
  const paiementCollecte = commande.paiement?.statut === 'valide' ? Number(commande.total || 0) : 0;
  const montant = roundMoney(walletUtilise + paiementCollecte);
  if (montant <= 0) return;

  const utilisateur = await Utilisateur.findByPk(commande.clientId);
  if (!utilisateur) return;

  await utilisateur.update({ soldeWallet: roundMoney(Number(utilisateur.soldeWallet) + montant) });
  await WalletTransaction.create({
    utilisateurId: commande.clientId,
    commandeId: commande.id,
    montant,
    type: 'credit',
    motif: 'annulation',
  });
}

/**
 * Caps a client's requested wallet spend against their real balance and
 * the amount actually owed on this order — never trust the frontend's
 * number beyond what it's allowed to be.
 */
export function plafonnerUtilisationWallet(soldeDisponible, montantDemande, plafondCommande) {
  const demande = Math.max(0, Number(montantDemande) || 0);
  return roundMoney(Math.min(demande, Number(soldeDisponible) || 0, Math.max(0, plafondCommande)));
}
