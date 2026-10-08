import { Op, literal } from 'sequelize';
import { Produit, Variante, MouvementStock } from '../models/index.js';
import { marketplaceConfig } from '../config/marketplace.js';
import { notifierVendeur, apresCommit } from './notifications.js';

export class StockInsuffisantError extends Error {
  constructor(nomProduit) {
    super(`Stock insuffisant pour ${nomProduit || 'ce produit'}.`);
    this.name = 'StockInsuffisantError';
    this.status = 409;
  }
}

// Le stock d'un produit à variantes est la somme de ses variantes (même règle
// que l'ajustement manuel vendeur, voir vendorRoutes.js) — recalculé après
// chaque mouvement plutôt que décrémenté en parallèle, pour ne jamais diverger.
async function resynchroniserStockProduit(produitId, transaction) {
  const total = await Variante.sum('stock', { where: { produitId }, transaction });
  await Produit.update({ stock: total || 0 }, { where: { id: produitId }, transaction });
}

async function lireStock({ produitId, varianteId, transaction }) {
  const ligne = varianteId
    ? await Variante.findByPk(varianteId, { attributes: ['stock'], transaction })
    : await Produit.findByPk(produitId, { attributes: ['stock'], transaction });
  return Number(ligne?.stock ?? 0);
}

/**
 * Décrémente le stock de façon ATOMIQUE : un seul UPDATE conditionnel
 * `SET stock = stock - q WHERE id = ? AND stock >= q`. Si deux clients
 * achètent le dernier article au même instant, la base n'applique la
 * condition qu'à une seule des deux requêtes ; l'autre touche 0 ligne et
 * reçoit StockInsuffisantError. Le stock ne peut donc jamais devenir négatif.
 *
 * Écrit un MouvementStock (motif 'vente') et, si le stock restant passe sous
 * le seuil d'alerte, notifie le vendeur après le commit.
 */
export async function reserverStock({ produitId, varianteId = null, quantite, nomProduit, commandeId = null, utilisateurId = null, transaction }) {
  const q = Number(quantite);
  if (!Number.isInteger(q) || q <= 0) throw Object.assign(new Error('Quantité invalide.'), { status: 400 });

  const Modele = varianteId ? Variante : Produit;
  const id = varianteId || produitId;
  const [affected] = await Modele.update(
    { stock: literal(`"stock" - ${q}`) },
    { where: { id, stock: { [Op.gte]: q } }, transaction },
  );
  if (affected === 0) throw new StockInsuffisantError(nomProduit);

  if (varianteId) await resynchroniserStockProduit(produitId, transaction);

  const stockApres = await lireStock({ produitId, varianteId, transaction });
  await MouvementStock.create({
    produitId,
    varianteId,
    variation: -q,
    stockAvant: stockApres + q,
    stockApres,
    motif: 'vente',
    note: commandeId ? `Commande #${commandeId}` : null,
    utilisateurId,
  }, { transaction });

  const seuil = marketplaceConfig.lowStockThreshold;
  // Alerte uniquement au franchissement du seuil (pas à chaque vente sous le
  // seuil), et une alerte distincte pour la rupture.
  if ((stockApres <= seuil && stockApres + q > seuil) || stockApres === 0) {
    apresCommit(transaction, () => alerterStockFaible({ produitId, varianteId, stockApres }));
  }
  return stockApres;
}

/**
 * Restitue le stock d'une ligne (annulation, refus de confirmation COD,
 * virement rejeté, retour remboursé). Incrément atomique, jamais une lecture
 * puis une écriture.
 */
export async function restaurerStock({ produitId, varianteId = null, quantite, motif, commandeId = null, utilisateurId = null, transaction }) {
  const q = Number(quantite);
  if (!Number.isInteger(q) || q <= 0) return;

  // Variante supprimée depuis la commande (le vendeur a refait ses
  // variantes) : le stock revient au produit lui-même plutôt que d'être perdu.
  if (varianteId && !(await Variante.count({ where: { id: varianteId }, transaction }))) {
    varianteId = null;
  }
  if (varianteId) {
    await Variante.increment('stock', { by: q, where: { id: varianteId }, transaction });
    await resynchroniserStockProduit(produitId, transaction);
  } else {
    await Produit.increment('stock', { by: q, where: { id: produitId }, transaction });
  }

  const produitExiste = await Produit.count({ where: { id: produitId }, transaction });
  if (!produitExiste) return; // produit supprimé : rien à journaliser

  const stockApres = await lireStock({ produitId, varianteId, transaction });
  await MouvementStock.create({
    produitId,
    varianteId,
    variation: q,
    stockAvant: stockApres - q,
    stockApres,
    motif,
    note: commandeId ? `Commande #${commandeId}` : null,
    utilisateurId,
  }, { transaction });
}

/** Restitue le stock de toutes les lignes d'une commande. */
export async function restaurerStockCommande(lignes, { motif, commandeId, utilisateurId = null, transaction }) {
  for (const ligne of lignes || []) {
    await restaurerStock({
      produitId: ligne.produitId,
      varianteId: ligne.varianteId || null,
      quantite: ligne.quantite,
      motif,
      commandeId,
      utilisateurId,
      transaction,
    });
  }
}

async function alerterStockFaible({ produitId, varianteId, stockApres }) {
  const produit = await Produit.findByPk(produitId, {
    attributes: ['id', 'nom', 'boutiqueId'],
    include: varianteId ? [{ model: Variante, as: 'variantes', where: { id: varianteId }, required: false }] : [],
  });
  if (!produit?.boutiqueId) return;
  const variante = produit.variantes?.[0];
  const libelleVariante = variante ? ` (${[variante.taille, variante.couleur, variante.pointure].filter(Boolean).join(' / ')})` : '';
  const rupture = stockApres === 0;
  await notifierVendeur(produit.boutiqueId, {
    type: rupture ? 'rupture_stock' : 'stock_faible',
    titre: rupture ? 'Rupture de stock' : 'Stock faible',
    message: rupture
      ? `${produit.nom}${libelleVariante} est en rupture de stock.`
      : `Plus que ${stockApres} unité(s) de ${produit.nom}${libelleVariante}.`,
    lien: `vendeur/produits/${produit.id}`,
    data: { produitId: produit.id, varianteId, stock: stockApres },
  });
}

/** Condition Sequelize « stock faible » (rupture comprise). */
export function whereStockFaible() {
  return { stock: { [Op.lte]: marketplaceConfig.lowStockThreshold } };
}

export async function compterProduitsStockFaible(boutiqueId) {
  const where = { ...whereStockFaible(), status: { [Op.ne]: 'inactif' } };
  if (boutiqueId) where.boutiqueId = boutiqueId;
  return Produit.count({ where });
}

