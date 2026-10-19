import { Commande, Retrait, Livraison, LigneCommande, Produit, Categorie, Retour, Paiement } from '../models/index.js';
import { resolveDelaiRetourCommande, dateLimiteRetour } from './returnPolicy.js';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

// Statuts « après paiement » d'une commande (voir utils/orderStatus.js).
// Être dans l'un d'eux ne suffit pas à dire que l'argent est acquis : une
// commande COD passe en préparation/expédition AVANT d'être encaissée (à la
// livraison). L'encaissement se lit donc sur le Paiement — voir
// estCommandeEncaissee. 'retour'/'litige' restent comptés : la vente n'est
// annulée qu'au remboursement ('retournee'), et le séquestre bloque déjà le
// retrait tant qu'un retour est ouvert.
export const REVENUE_STATUTS = ['payee', 'preparation', 'expediee', 'en_cours_livraison', 'livree', 'retour', 'litige'];
const PAIEMENT_ENCAISSE = ['valide', 'paye_livraison'];

export function estCommandeEncaissee(commande) {
  if (!REVENUE_STATUTS.includes(commande.statut)) return false;
  // Commandes antérieures sans Paiement chargé : on retombe sur le statut,
  // comme avant (livrée = encaissée, y compris en COD).
  if (!commande.paiement) return true;
  return PAIEMENT_ENCAISSE.includes(commande.paiement.statut)
    || ['livree', 'retour', 'litige'].includes(commande.statut);
}

// Une commande est "séquestrée" tant que sa fenêtre de retour n'est pas
// terminée, ou qu'un retour est encore ouvert/en médiation dessus — son
// montant net n'entre pas dans le solde retirable par le vendeur avant ça.
function estCommandeLibereeEscrow(commande) {
  const retourActif = (commande.retours || []).some((r) => ['demande', 'litige', 'approuve'].includes(r.statut));
  if (retourActif) return false;

  const dateLivraison = commande.livraison?.dateLivraison;
  if (!dateLivraison) return false; // pas encore livrée = pas encore acquis

  const delaiJours = resolveDelaiRetourCommande(commande.lignes || []);
  const limite = dateLimiteRetour(dateLivraison, delaiJours);
  if (!limite) return false;
  return Date.now() > limite.getTime();
}

/**
 * Source unique de vérité pour les finances d'une boutique — ventes brutes,
 * commission plateforme, gains nets, et solde disponible au retrait. Utilisée
 * par le tableau de bord vendeur, la création de demande de retrait et le
 * rapport de règlement admin, pour que les trois affichent toujours le même
 * chiffre.
 *
 * Le solde retirable applique en plus un séquestre (escrow) : le montant net
 * d'une commande ne devient disponible qu'une fois sa fenêtre de retour
 * terminée sans retour actif — voir estCommandeLibereeEscrow.
 */
export async function calculerFinancesBoutique(boutiqueId) {
  const commandes = await Commande.findAll({
    where: { boutiqueId },
    include: [
      { model: Livraison, as: 'livraison', attributes: ['dateLivraison'] },
      { model: LigneCommande, as: 'lignes', include: [{ model: Produit, as: 'produit', include: [{ model: Categorie, as: 'categorie', attributes: ['delaiRetourJours'] }], attributes: ['id', 'delaiRetourJoursOverride'] }] },
      { model: Retour, as: 'retours', attributes: ['statut'] },
      { model: Paiement, as: 'paiement', attributes: ['statut', 'methode'] },
    ],
  });
  const commandesRevenu = commandes.filter(estCommandeEncaissee);

  // Le timbre fiscal est collecté pour l'État : il ne fait pas partie des ventes de la boutique.
  const totalVentesBrutes = roundMoney(
    commandesRevenu.reduce((sum, c) => sum + Number(c.total || 0) - Number(c.timbreFiscal || 0), 0),
  );
  const totalVentesNettes = roundMoney(commandesRevenu.reduce((sum, c) => sum + Number(c.montantVendeur || 0), 0));
  const totalCommissions = roundMoney(commandesRevenu.reduce((sum, c) => sum + Number(c.montantCommission || 0), 0));
  const nombreCommandes = commandes.filter((c) => c.statut !== 'annulee').length;

  const totalVentesLiberees = roundMoney(
    commandesRevenu.filter(estCommandeLibereeEscrow).reduce((sum, c) => sum + Number(c.montantVendeur || 0), 0),
  );
  const soldeEnAttenteEscrow = roundMoney(Math.max(0, totalVentesNettes - totalVentesLiberees));

  const retraits = await Retrait.findAll({ where: { boutiqueId }, order: [['createdAt', 'DESC']] });
  const retraitsEngages = retraits.filter((r) => ['demande', 'approuve', 'verse'].includes(r.statut));
  const totalRetraitsEngages = roundMoney(retraitsEngages.reduce((sum, r) => sum + Number(r.montant || 0), 0));
  const totalVerse = roundMoney(retraits.filter((r) => r.statut === 'verse').reduce((sum, r) => sum + Number(r.montant || 0), 0));

  const soldeDisponible = roundMoney(Math.max(0, totalVentesLiberees - totalRetraitsEngages));

  return {
    totalVentesBrutes,
    totalVentesNettes,
    totalCommissions,
    nombreCommandes,
    totalVerse,
    totalRetraitsEngages,
    soldeEnAttenteEscrow,
    soldeDisponible,
    commandes,
    retraits,
  };
}
