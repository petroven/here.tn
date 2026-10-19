import { Livraison, Livreur, Commande, Utilisateur } from '../models/index.js';
import { ajouterEvenementCommande } from './orderStatus.js';
import { notifier } from './notifications.js';

export async function assignCourseToLivreur(livraisonId, livreurId) {
  const [affected] = await Livraison.update(
    { livreurId, statutAssignation: 'assignee', dateAssignation: new Date() },
    { where: { id: livraisonId, statutAssignation: 'en_attente', livreurId: null } },
  );
  if (affected === 0) return { success: false };

  await Livreur.update({ statut: 'occupe' }, { where: { id: livreurId } });

  // Chronologie + notification « Livreur trouvé » côté client. Hors du
  // chemin critique : un échec ici n'annule pas l'assignation.
  try {
    const livraison = await Livraison.findByPk(livraisonId, { include: [{ model: Commande }] });
    const livreur = await Livreur.findByPk(livreurId, { include: [{ model: Utilisateur, as: 'utilisateur', attributes: ['prenom'] }] });
    const commande = livraison?.Commande;
    if (commande) {
      const prenom = livreur?.utilisateur?.prenom || 'Un livreur';
      await ajouterEvenementCommande(commande, { commentaire: `Livreur assigné : ${prenom}` });
      notifier(commande.clientId, {
        type: 'livreur_trouve',
        titre: 'Livreur trouvé',
        message: `${prenom} va livrer votre commande ${commande.numeroCommande}.`,
        lien: `commande/${commande.id}`,
        data: { commandeId: commande.id },
      });
    }
  } catch (error) {
    console.error('[COURSE] Échec notification assignation:', error.message);
  }

  return { success: true };
}
