import { gouvernoratsData, fraisLivraisonParGouvernorat } from '../data/tunisia-geo.js';
import { Gouvernorat, Delegation } from '../models/index.js';

export async function seedGeographie() {
  const transaction = await Gouvernorat.sequelize.transaction();
  try {
    const gouvernoratsExistants = await Gouvernorat.findAll({ transaction });
    const delegationsExistantes = await Delegation.findAll({ transaction });
    const gouvernoratsParCode = new Map(gouvernoratsExistants.map((item) => [item.code, item]));
    const delegationsConnues = new Set(delegationsExistantes.map((item) => `${item.gouvernoratId}:${item.nom}`));

    for (const gov of gouvernoratsData) {
      let gouvernorat = gouvernoratsParCode.get(gov.code);
      if (!gouvernorat) {
        gouvernorat = await Gouvernorat.create({
          nom: gov.nom,
          nomAr: gov.nomAr,
          code: gov.code,
          fraisLivraison: fraisLivraisonParGouvernorat[gov.nom] ?? 8,
        }, { transaction });
        gouvernoratsParCode.set(gov.code, gouvernorat);
      }

      for (const del of gov.delegations) {
        const key = `${gouvernorat.id}:${del}`;
        if (delegationsConnues.has(key)) continue;
        await Delegation.create({ nom: del, gouvernoratId: gouvernorat.id }, { transaction });
        delegationsConnues.add(key);
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  console.log('[SEED] Géographie tunisienne vérifiée (24 gouvernorats).');
}

export function calculerFraisLivraison(gouvernoratNom) {
  return fraisLivraisonParGouvernorat[gouvernoratNom] ?? 8;
}

export function genererTrackingId() {
  const prefix = 'MPTN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function genererAwbNumber() {
  return `AWB-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

export function genererNumeroCommande() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const seq = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `CMD-${y}${m}-${seq}`;
}
