import { Livraison, Livreur } from '../models/index.js';

export async function assignCourseToLivreur(livraisonId, livreurId) {
  const [affected] = await Livraison.update(
    { livreurId, statutAssignation: 'assignee', dateAssignation: new Date() },
    { where: { id: livraisonId, statutAssignation: 'en_attente', livreurId: null } },
  );
  if (affected === 0) return { success: false };

  await Livreur.update({ statut: 'occupe' }, { where: { id: livreurId } });
  return { success: true };
}
