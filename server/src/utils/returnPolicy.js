import { marketplaceConfig } from '../config/marketplace.js';

/**
 * Fenêtre de retour effective (en jours) pour un produit — 0 signifie
 * explicitement non retournable. Le vendeur ne peut que resserrer le délai
 * de sa catégorie via delaiRetourJoursOverride, jamais l'élargir : on prend
 * toujours le plus court des deux quand les deux sont définis.
 */
export function resolveDelaiRetourProduit(produit) {
  const categorieJours = produit?.categorie?.delaiRetourJours;
  const baseJours = Number.isFinite(categorieJours) ? categorieJours : marketplaceConfig.returnPolicy.defaultWindowDays;
  const override = produit?.delaiRetourJoursOverride;
  if (!Number.isFinite(override)) return baseJours;
  return Math.max(0, Math.min(baseJours, override));
}

/**
 * Fenêtre de retour effective pour une commande entière — la plus courte
 * parmi ses lignes, pour ne jamais laisser un article normalement non
 * retournable devenir retournable simplement parce qu'il partage un panier
 * avec un article à fenêtre plus longue.
 */
export function resolveDelaiRetourCommande(lignes) {
  if (!lignes?.length) return marketplaceConfig.returnPolicy.defaultWindowDays;
  return lignes.reduce((min, ligne) => {
    const produit = ligne.produit || ligne.Produit;
    const jours = resolveDelaiRetourProduit(produit);
    return Math.min(min, jours);
  }, Infinity);
}

// Utilisé côté écriture (création/édition produit) pour empêcher un vendeur
// d'élargir la fenêtre de retour de sa catégorie via son override — même
// règle que resolveDelaiRetourProduit, appliquée avant la sauvegarde plutôt
// qu'à la lecture.
export function clampDelaiRetourOverride(categorieDelaiJours, requestedOverride) {
  if (requestedOverride === null || requestedOverride === undefined || Number.isNaN(requestedOverride)) return null;
  const base = Number.isFinite(categorieDelaiJours) ? categorieDelaiJours : marketplaceConfig.returnPolicy.defaultWindowDays;
  return Math.max(0, Math.min(base, requestedOverride));
}

export function dateLimiteRetour(dateLivraison, delaiJours) {
  if (!dateLivraison) return null;
  const limite = new Date(dateLivraison);
  limite.setDate(limite.getDate() + delaiJours);
  return limite;
}

// Qui paie les frais de retour, par défaut selon le motif — le vendeur ne
// peut être tenu responsable des frais que pour un vrai défaut/non-
// conformité ; un simple changement d'avis reste à la charge du client.
export function fraisRetourParDefaut(motifCategorie) {
  return motifCategorie === 'changement_avis' ? 'client' : 'vendeur';
}
