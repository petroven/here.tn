import { Op } from 'sequelize';
import { PrixHistorique } from '../models/index.js';

const DUREE_MINIMALE_JOURS = 7;

export async function enregistrerChangementPrix(produitId, nouveauPrix, transaction) {
  await PrixHistorique.update(
    { dateFin: new Date() },
    { where: { produitId, dateFin: null }, transaction },
  );
  await PrixHistorique.create(
    { produitId, prix: nouveauPrix, dateDebut: new Date(), dateFin: null },
    { transaction },
  );
}

// Empêche les "fausses promotions": le prix barré doit correspondre à un prix
// réellement pratiqué pendant au moins DUREE_MINIMALE_JOURS jours, pas un prix
// gonflé artificiellement juste avant la remise.
export async function validerPrixAvant(produitId, prixActuel, prixAvant) {
  if (prixAvant === undefined || prixAvant === null || prixAvant === '') return null;

  const prixAvantNum = Number(prixAvant);
  if (!Number.isFinite(prixAvantNum) || prixAvantNum <= Number(prixActuel)) {
    throw new Error('Le prix barré doit être strictement supérieur au prix actuel.');
  }

  const seuilDate = new Date(Date.now() - DUREE_MINIMALE_JOURS * 24 * 60 * 60 * 1000);
  const referenceReelle = await PrixHistorique.findOne({
    where: {
      produitId,
      prix: prixAvantNum,
      dateDebut: { [Op.lte]: seuilDate },
    },
  });

  if (!referenceReelle) {
    throw new Error(
      `Le prix barré doit correspondre à un prix réellement appliqué à ce produit pendant au moins ${DUREE_MINIMALE_JOURS} jours (politique anti-fausses promotions). Modifiez d'abord le prix, attendez, puis proposez une remise.`,
    );
  }

  return prixAvantNum;
}
