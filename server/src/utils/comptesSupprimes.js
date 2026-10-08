import { Utilisateur } from '../models/index.js';

// Comptes supprimés (anonymisés) : leurs jetons de session, encore valides
// jusqu'à 7 jours, doivent être refusés. Gardé en mémoire pour ne pas
// interroger la base à chaque requête ; rechargé au démarrage du serveur.
const supprimes = new Set();

export function estCompteSupprime(utilisateurId) {
  return supprimes.has(Number(utilisateurId));
}

export function marquerCompteSupprime(utilisateurId) {
  supprimes.add(Number(utilisateurId));
}

export async function chargerComptesSupprimes() {
  const comptes = await Utilisateur.findAll({ where: { compteSupprime: true }, attributes: ['id'] });
  supprimes.clear();
  for (const c of comptes) supprimes.add(c.id);
}
