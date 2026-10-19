import { AuditLog } from '../models/index.js';

const ADMIN_ROLES = ['administrateur', 'super_admin'];

// Ne garde que les champs utiles d'une instance Sequelize (ou d'un objet) —
// jamais de mot de passe ni de document KYC complet dans le journal.
const CHAMPS_EXCLUS = new Set(['password', 'kycDocumentCin', 'kycDocumentRib', 'createdAt', 'updatedAt']);
function instantane(valeur, champs) {
  if (!valeur) return null;
  const brut = typeof valeur.toJSON === 'function' ? valeur.toJSON() : valeur;
  const cles = champs || Object.keys(brut);
  const estScalaire = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);
  return Object.fromEntries(
    cles
      .filter((cle) => !CHAMPS_EXCLUS.has(cle) && estScalaire(brut[cle]))
      .map((cle) => [cle, brut[cle]]),
  );
}

/**
 * Enregistre une action sensible. N'échoue jamais : une écriture de journal
 * ratée est signalée dans les logs mais ne bloque pas l'action métier.
 *
 * @param {import('express').Request} req   requête de l'acteur (req.user, req.ip)
 * @param {{ action: string, entite: string, entiteId?: number, avant?: object, apres?: object, champs?: string[], commentaire?: string, transaction?: any }} entree
 */
export async function journaliser(req, { action, entite, entiteId = null, avant = null, apres = null, champs, commentaire = null, transaction }) {
  try {
    return await AuditLog.create({
      acteurId: req?.user?.id || null,
      acteurRole: req?.user?.role || null,
      action,
      entite,
      entiteId,
      avant: instantane(avant, champs),
      apres: instantane(apres, champs),
      commentaire,
      ip: req?.ip || null,
    }, { transaction });
  } catch (error) {
    console.error('[AUDIT] Échec écriture journal:', error.message);
    return null;
  }
}

/** Journalise uniquement si l'acteur est un administrateur. */
export function journaliserSiAdmin(req, entree) {
  if (!ADMIN_ROLES.includes(req?.user?.role)) return Promise.resolve(null);
  return journaliser(req, entree);
}
