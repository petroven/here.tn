import { Commande, Retrait, Livraison, LigneCommande, Produit, Categorie, Retour } from '../models/index.js';
import { resolveDelaiRetourCommande, dateLimiteRetour } from './returnPolicy.js';

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

// Un Commande.statut ne redevient jamais 'payee' une fois la commande
// expédiée/livrée (Commande.statut='livree' reste tel quel — nécessaire pour
// que les retours RMA restent ouvrables, voir retourRoutes.js). Toute requête
// financière qui filtrait strictement sur statut === 'payee' perdait donc le
// chiffre d'affaires des commandes payées en ligne dès qu'elles étaient
// livrées (les commandes COD, elles, repassent à 'payee' à la livraison —
// d'où l'incohérence). Ces trois statuts sont les seuls où l'argent du
// vendeur est réellement acquis.
export const REVENUE_STATUTS = ['payee', 'expediee', 'livree'];

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
    ],
  });
  const commandesRevenu = commandes.filter((c) => REVENUE_STATUTS.includes(c.statut));

  const totalVentesBrutes = roundMoney(commandesRevenu.reduce((sum, c) => sum + Number(c.total || 0), 0));
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
