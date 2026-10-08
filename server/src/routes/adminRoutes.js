import express from 'express';
import {
  Boutique, Avis, Commande, Commission, Retrait, Utilisateur, Produit, Categorie,
  Paiement, LigneCommande, Variante,
} from '../models/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { crediterCashback } from '../utils/wallet.js';
import { envoyerRecuPaiement } from '../utils/email.js';
import { calculerFinancesBoutique, REVENUE_STATUTS } from '../utils/finance.js';
import { changerStatutCommande, synchroniserStatutCommande } from '../utils/orderStatus.js';
import { restaurerStockCommande, whereStockFaible } from '../utils/stock.js';
import { journaliser } from '../utils/audit.js';
import { notifierVendeur } from '../utils/notifications.js';
import { STATUTS_COMMANDE } from '../utils/orderStatus.js';
import { estCommandeEncaissee } from '../utils/finance.js';
import { marketplaceConfig } from '../config/marketplace.js';
import { AuditLog, HistoriqueCommande } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// Comptes joints aux listes admin : jamais le hash du mot de passe.
const SANS_MOT_DE_PASSE = { exclude: ['password'] };

// Admin access requires a real logged-in JWT with an admin role — no
// shared-secret bypass. A static header token would be visible in any
// client-side bundle and never rotates per-user, so it's not used here.
const adminMiddleware = (req, res, next) => authMiddleware(req, res, () => {
  if (!['administrateur', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Accès refusé.' });
  }
  return next();
});

// Get all vendors
router.get('/admin/vendors', adminMiddleware, async (req, res) => {
  try {
    const boutiques = await Boutique.findAll({
      include: [{ model: Utilisateur, as: 'vendeur', attributes: SANS_MOT_DE_PASSE }],
      order: [['createdAt', 'DESC']],
    });

    const vendorsWithStats = await Promise.all(
      boutiques.map(async (boutique) => {
        const finances = await calculerFinancesBoutique(boutique.id);

        return {
          ...boutique.toJSON(),
          stats: {
            totalVentes: finances.totalVentesNettes,
            totalVentesBrutes: finances.totalVentesBrutes,
            totalCommissions: finances.totalCommissions,
            nombreCommandes: finances.nombreCommandes,
            soldeDisponible: finances.soldeDisponible,
          },
        };
      }),
    );

    res.json({ success: true, data: vendorsWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get withdrawal requests
router.get('/admin/withdrawals', adminMiddleware, async (req, res) => {
  try {
    const retraits = await Retrait.findAll({
      include: [{ model: Boutique, include: [{ model: Utilisateur, as: 'vendeur', attributes: SANS_MOT_DE_PASSE }] }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: retraits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve/Reject withdrawal
router.put('/admin/withdrawals/:retraitId', adminMiddleware, async (req, res) => {
  try {
    const { retraitId } = req.params;
    const { statut, motifRejection } = req.body;

    if (!['approuve', 'verse', 'rejete'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }

    const retrait = await Retrait.findByPk(retraitId);
    if (!retrait) {
      return res.status(404).json({ success: false, message: 'Retrait non trouvé.' });
    }

    // demande → approuve → verse, ou demande/approuve → rejete. Un retrait
    // versé ou rejeté est définitif.
    const TRANSITIONS_RETRAIT = { demande: ['approuve', 'rejete'], approuve: ['verse', 'rejete'] };
    if (!(TRANSITIONS_RETRAIT[retrait.statut] || []).includes(statut)) {
      return res.status(409).json({ success: false, message: `Un retrait « ${retrait.statut} » ne peut pas passer à « ${statut} ».` });
    }

    const avant = retrait.toJSON();
    await retrait.update({
      statut,
      motifRejection: statut === 'rejete' ? motifRejection : null,
      dateRetrait: statut === 'verse' ? new Date() : retrait.dateRetrait,
    });
    await journaliser(req, {
      action: `retrait.${statut}`, entite: 'Retrait', entiteId: retrait.id, avant, apres: retrait,
      champs: ['statut', 'montant', 'iban', 'motifRejection'], commentaire: motifRejection || null,
    });

    const MESSAGES_RETRAIT = {
      approuve: ['Retrait accepté', `Votre demande de retrait de ${Number(retrait.montant).toFixed(3)} DT a été acceptée.`],
      verse: ['Retrait versé', `Le virement de ${Number(retrait.montant).toFixed(3)} DT a été effectué.`],
      rejete: ['Retrait refusé', `Votre demande de retrait a été refusée${motifRejection ? ` : ${motifRejection}` : '.'}`],
    };
    notifierVendeur(retrait.boutiqueId, {
      type: `retrait_${statut}`,
      titre: MESSAGES_RETRAIT[statut][0],
      message: MESSAGES_RETRAIT[statut][1],
      lien: 'vendeur/retraits',
      data: { retraitId: retrait.id },
    });

    res.json({ success: true, data: retrait });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Virements bancaires en attente de rapprochement manuel — un virement n'a
// pas de webhook comme Konnect/Flouci, donc chaque paiement 'virement' passe
// par une revue admin (voir server/src/models/index.js, Paiement.statut).
router.get('/admin/virements', adminMiddleware, async (req, res) => {
  try {
    const paiements = await Paiement.findAll({
      where: { methode: 'virement' },
      include: [{
        model: Commande,
        include: [
          { model: Utilisateur, as: 'client', attributes: ['id', 'nom', 'prenom', 'email', 'telephone'] },
          { model: Boutique, as: 'boutique', attributes: ['id', 'nom'] },
        ],
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: paiements });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Valider un virement reçu — déclenche les mêmes effets de bord qu'un
// paiement en ligne confirmé (commande payée, cashback crédité).
router.patch('/admin/virements/:paiementId/valider', adminMiddleware, async (req, res) => {
  try {
    const paiement = await Paiement.findByPk(req.params.paiementId, { include: [{ model: Commande }] });
    if (!paiement || paiement.methode !== 'virement') {
      return res.status(404).json({ success: false, message: 'Paiement par virement introuvable.' });
    }
    if (paiement.statut === 'valide') {
      return res.json({ success: true, data: paiement, message: 'Déjà validé.' });
    }

    await paiement.update({ statut: 'valide' });
    await journaliser(req, {
      action: 'virement.valider', entite: 'Paiement', entiteId: paiement.id,
      avant: { statut: 'en_attente_validation' }, apres: { statut: 'valide', montant: paiement.montant, commandeId: paiement.commandeId },
    });
    await synchroniserStatutCommande(paiement.commandeId, 'payee', {
      utilisateurId: req.user.id,
      commentaire: 'Virement bancaire validé par un administrateur',
    });
    await crediterCashback(paiement.commandeId);
    envoyerRecuPaiement(paiement.commandeId).catch((error) => {
      console.error('[EMAIL] Échec envoi reçu de paiement:', error.message);
    });

    res.json({ success: true, data: paiement, message: 'Virement validé, commande marquée payée.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rejeter un virement (jamais reçu / montant incorrect) — restaure le stock
// et annule la commande, comme un refus de confirmation COD.
router.patch('/admin/virements/:paiementId/rejeter', adminMiddleware, async (req, res) => {
  const transaction = await Paiement.sequelize.transaction();
  try {
    const paiement = await Paiement.findByPk(req.params.paiementId, { include: [{ model: Commande }], transaction });
    if (!paiement || paiement.methode !== 'virement') {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Paiement par virement introuvable.' });
    }
    if (paiement.statut === 'valide') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Ce virement est déjà validé, impossible de le rejeter.' });
    }

    await changerStatutCommande(paiement.commandeId, 'annulee', {
      utilisateurId: req.user.id,
      commentaire: 'Virement non reçu — rejeté par un administrateur',
      transaction,
    });
    const lignes = await LigneCommande.findAll({ where: { commandeId: paiement.commandeId }, transaction });
    await restaurerStockCommande(lignes, {
      motif: 'annulation',
      commandeId: paiement.commandeId,
      utilisateurId: req.user.id,
      transaction,
    });

    await paiement.update({ statut: 'echec' }, { transaction });
    await journaliser(req, {
      action: 'virement.rejeter', entite: 'Paiement', entiteId: paiement.id,
      avant: { statut: 'en_attente_validation' }, apres: { statut: 'echec', montant: paiement.montant, commandeId: paiement.commandeId },
      transaction,
    });

    await transaction.commit();
    res.json({ success: true, message: 'Virement rejeté, commande annulée et stock restauré.' });
  } catch (error) {
    await transaction.rollback();
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

// Get commission analytics
router.get('/admin/commissions', adminMiddleware, async (req, res) => {
  try {
    const commissions = await Commission.findAll({
      include: [
        { model: Commande },
        { model: Boutique, include: [{ model: Utilisateur, as: 'vendeur', attributes: SANS_MOT_DE_PASSE }] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const totalCollected = commissions.reduce((sum, c) => sum + c.montant, 0);

    res.json({
      success: true,
      data: {
        commissions,
        totalCollected,
        count: commissions.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/admin/boutiques/:id/statut', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { statut } = req.body;

  if (!['en_attente', 'validee', 'suspendue'].includes(statut)) {
    return res.status(400).json({ success: false, message: 'Statut invalide.' });
  }

  const boutique = await Boutique.findByPk(id);
  if (!boutique) {
    return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
  }

  if (statut === 'validee' && !boutique.accepteConditionsRetour) {
    return res.status(400).json({
      success: false,
      message: 'Impossible de valider : le vendeur n\'a pas accepté les conditions de vente et de retour.',
    });
  }

  const avant = boutique.toJSON();
  boutique.statut = statut;
  await boutique.save();
  await journaliser(req, {
    action: `boutique.${statut}`, entite: 'Boutique', entiteId: boutique.id, avant, apres: boutique, champs: ['statut', 'nom'],
  });
  notifierVendeur(boutique.id, notificationStatutBoutique(statut));

  return res.json({ success: true, data: boutique });
});

// Vérification KYC — distincte de l'activation ci-dessus. Un rejet renvoie
// systématiquement le vendeur à 'en_attente' de sa prochaine soumission (pas
// de statut "rejeté" bloquant définitivement : il peut renvoyer des documents
// corrigés via /vendor/kyc, qui repasse lui-même à 'en_attente').
router.patch('/admin/boutiques/:id/kyc', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { kycStatut, kycCommentaireAdmin } = req.body;

  if (!['valide', 'rejete'].includes(kycStatut)) {
    return res.status(400).json({ success: false, message: 'Statut KYC invalide.' });
  }

  const boutique = await Boutique.findByPk(id);
  if (!boutique) {
    return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
  }
  if (boutique.kycStatut === 'non_soumis') {
    return res.status(400).json({ success: false, message: 'Aucun document KYC soumis par ce vendeur.' });
  }

  const avant = boutique.toJSON();
  await boutique.update({
    kycStatut,
    kycCommentaireAdmin: kycCommentaireAdmin || null,
    kycDateTraitement: new Date(),
  });
  await journaliser(req, {
    action: kycStatut === 'valide' ? 'kyc.valider' : 'kyc.rejeter', entite: 'Boutique', entiteId: boutique.id,
    avant, apres: boutique, champs: ['kycStatut', 'kycCommentaireAdmin', 'nom'], commentaire: kycCommentaireAdmin || null,
  });
  notifierVendeur(boutique.id, kycStatut === 'valide'
    ? { type: 'kyc_valide', titre: 'KYC validé', message: 'Votre identité et votre RIB ont été vérifiés : votre boutique affiche le badge « vérifiée ».', lien: 'vendeur/kyc' }
    : { type: 'kyc_rejete', titre: 'KYC refusé', message: `Vos documents KYC ont été refusés${kycCommentaireAdmin ? ` : ${kycCommentaireAdmin}` : '.'} Vous pouvez les renvoyer.`, lien: 'vendeur/kyc' });

  return res.json({ success: true, data: boutique });
});

router.patch('/admin/avis/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { valide } = req.body;

  const avis = await Avis.findByPk(id);
  if (!avis) {
    return res.status(404).json({ success: false, message: 'Avis introuvable.' });
  }

  const avant = avis.toJSON();
  avis.valide = Boolean(valide);
  await avis.save();
  await journaliser(req, {
    action: avis.valide ? 'avis.publier' : 'avis.masquer', entite: 'Avis', entiteId: avis.id, avant, apres: avis, champs: ['valide', 'note'],
  });

  return res.json({ success: true, data: avis });
});

// Liste complète des avis pour modération — la seule vue existante
// jusqu'ici était embarquée dans la fiche produit (déjà filtrée sur
// valide=true), donc rien ne permettait à un admin de voir/traiter les avis
// invalidés ou tout juste créés.
router.get('/admin/avis', adminMiddleware, async (req, res) => {
  try {
    const avis = await Avis.findAll({
      include: [
        { model: Utilisateur, as: 'auteur', attributes: ['id', 'nom', 'prenom', 'email'] },
        { model: Produit, as: 'produit', attributes: ['id', 'nom'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, data: avis });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Admin dashboard stats
router.get('/admin/stats', adminMiddleware, async (req, res) => {
  try {
    const totalVendors = await Boutique.count();
    const verifiedVendors = await Boutique.count({ where: { statut: 'validee' } });
    const pendingVendors = await Boutique.count({ where: { statut: 'en_attente' } });
    
    const totalOrders = await Commande.count();
    const totalProducts = await Produit.count();
    const commandesRevenu = await Commande.findAll({
      where: { statut: REVENUE_STATUTS },
      attributes: ['id', 'statut', 'montantCommission'],
      include: [{ model: Paiement, as: 'paiement', attributes: ['statut'] }],
    });
    const totalRevenue = commandesRevenu.filter(estCommandeEncaissee)
      .reduce((sum, c) => sum + Number(c.montantCommission || 0), 0);
    const lowStockProducts = await Produit.count({ where: { ...whereStockFaible(), status: { [Op.ne]: 'inactif' } } });
    const pendingCommissions = await Commission.sum('montant', { where: { statut: 'collectee' } }) || 0;
    
    const totalUsers = await Utilisateur.count();
    const vendorUsers = await Utilisateur.count({ where: { role: 'vendeur' } });
    const customerUsers = await Utilisateur.count({ where: { role: 'client' } });

    res.json({
      success: true,
      data: {
        vendors: { total: totalVendors, verified: verifiedVendors, pending: pendingVendors },
        orders: { total: totalOrders },
        products: { total: totalProducts, lowStock: lowStockProducts, lowStockThreshold: marketplaceConfig.lowStockThreshold },
        revenue: { commission: totalRevenue, pending: pendingCommissions },
        users: { total: totalUsers, vendors: vendorUsers, customers: customerUsers },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve/Suspend vendor
router.put('/admin/vendors/:boutiqueId/status', adminMiddleware, async (req, res) => {
  try {
    const { boutiqueId } = req.params;
    const { statut } = req.body;

    if (!['en_attente', 'validee', 'suspendue'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }

    const boutique = await Boutique.findByPk(boutiqueId);
    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
    }

    if (statut === 'validee' && !boutique.accepteConditionsRetour) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de valider : le vendeur n\'a pas accepté les conditions de vente et de retour.',
      });
    }

    const avant = boutique.toJSON();
    await boutique.update({ statut });
    await journaliser(req, {
      action: `boutique.${statut}`, entite: 'Boutique', entiteId: boutique.id, avant, apres: boutique, champs: ['statut', 'nom'],
    });
    notifierVendeur(boutique.id, notificationStatutBoutique(statut));
    res.json({ success: true, data: boutique, message: `Statut de la boutique mis à jour: ${statut}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all orders for admin
router.get('/admin/orders', adminMiddleware, async (req, res) => {
  try {
    const commandes = await Commande.findAll({
      include: [
        { model: Utilisateur, as: 'client', attributes: SANS_MOT_DE_PASSE },
        { model: Boutique, as: 'boutique', include: [{ model: Utilisateur, as: 'vendeur', attributes: SANS_MOT_DE_PASSE }] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: commandes, count: commandes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all users for admin
router.get('/admin/users', adminMiddleware, async (req, res) => {
  try {
    const users = await Utilisateur.findAll({
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] },
    });

    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Super-admin catalogue moderation
router.get('/admin/products', adminMiddleware, async (req, res) => {
  try {
    // ?stock=faible → produits actifs/en attente au seuil d'alerte ou en
    // rupture, les plus bas d'abord.
    const stockFaible = req.query.stock === 'faible';
    const produits = await Produit.findAll({
      where: stockFaible ? { ...whereStockFaible(), status: { [Op.ne]: 'inactif' } } : undefined,
      order: stockFaible ? [['stock', 'ASC'], ['nom', 'ASC']] : [['createdAt', 'DESC']],
      include: [
        { model: Boutique, as: 'boutique', attributes: ['id', 'nom', 'statut'] },
        { model: Categorie, as: 'categorie', attributes: ['id', 'nom'] },
      ],
    });
    return res.json({ success: true, data: produits, count: produits.length, lowStockThreshold: marketplaceConfig.lowStockThreshold });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/admin/products/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['actif', 'inactif', 'en_attente'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Statut produit invalide.' });
    }
    const produit = await Produit.findByPk(req.params.id);
    if (!produit) return res.status(404).json({ success: false, message: 'Produit introuvable.' });
    const avant = produit.toJSON();
    await produit.update({ status });
    await journaliser(req, {
      action: 'produit.statut', entite: 'Produit', entiteId: produit.id, avant, apres: produit, champs: ['status', 'nom', 'boutiqueId'],
    });
    return res.json({ success: true, data: produit });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/admin/products/:id', adminMiddleware, async (req, res) => {
  try {
    const produit = await Produit.findByPk(req.params.id);
    if (!produit) return res.status(404).json({ success: false, message: 'Produit introuvable.' });
    const avant = produit.toJSON();
    await produit.update({ status: 'inactif' });
    await journaliser(req, {
      action: 'produit.supprimer', entite: 'Produit', entiteId: produit.id, avant, apres: produit, champs: ['status', 'nom', 'boutiqueId'],
    });
    return res.json({ success: true, message: 'Produit désactivé du catalogue.', data: produit });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Changement manuel du statut d'une commande par un admin — même machine
// d'états que partout ailleurs (aucun passe-droit : une transition
// incohérente est refusée), avec commentaire obligatoire et journal d'audit.
router.patch('/admin/orders/:id/statut', adminMiddleware, async (req, res) => {
  try {
    const { statut, commentaire } = req.body;
    if (!STATUTS_COMMANDE.includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut de commande invalide.' });
    }
    if (!commentaire || !String(commentaire).trim()) {
      return res.status(400).json({ success: false, message: 'Un commentaire est requis pour modifier une commande manuellement.' });
    }
    const commande = await Commande.findByPk(req.params.id, { include: [{ model: LigneCommande, as: 'lignes' }] });
    if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable.' });

    const ancienStatut = commande.statut;
    const transaction = await Commande.sequelize.transaction();
    try {
      await changerStatutCommande(commande, statut, { utilisateurId: req.user.id, commentaire, transaction });
      // Une annulation admin restitue le stock, comme toutes les autres.
      if (statut === 'annulee') {
        await restaurerStockCommande(commande.lignes, {
          motif: 'annulation', commandeId: commande.id, utilisateurId: req.user.id, transaction,
        });
      }
      await journaliser(req, {
        action: 'commande.statut', entite: 'Commande', entiteId: commande.id,
        avant: { statut: ancienStatut }, apres: { statut }, commentaire, transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return res.json({ success: true, data: commande });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.get('/admin/orders/:id/historique', adminMiddleware, async (req, res) => {
  try {
    const historique = await HistoriqueCommande.findAll({
      where: { commandeId: req.params.id },
      include: [{ model: Utilisateur, as: 'utilisateur', attributes: ['id', 'nom', 'prenom', 'role'] }],
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
    });
    return res.json({ success: true, data: historique });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Journal d'audit — filtres optionnels : entite, entiteId, action (préfixe,
// ex: 'kyc'), acteurId. Paginé, le plus récent d'abord.
router.get('/admin/audit-logs', adminMiddleware, async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const where = {};
    if (req.query.entite) where.entite = req.query.entite;
    if (req.query.entiteId) where.entiteId = Number(req.query.entiteId);
    if (req.query.acteurId) where.acteurId = Number(req.query.acteurId);
    if (req.query.action) where.action = { [Op.like]: `${req.query.action}%` };

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: Utilisateur, as: 'acteur', attributes: ['id', 'nom', 'prenom', 'email'] }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({ success: true, data: rows, pagination: { page, limit, total: count } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Settlement report
router.get('/admin/settlement-report', adminMiddleware, async (req, res) => {
  try {
    const boutiques = await Boutique.findAll({
      include: [{ model: Utilisateur, as: 'vendeur', attributes: SANS_MOT_DE_PASSE }],
    });

    const report = await Promise.all(
      boutiques.map(async (boutique) => {
        const finances = await calculerFinancesBoutique(boutique.id);

        return {
          boutique: boutique.nom,
          vendeur: boutique.vendeur?.email,
          totalVentesBrutes: finances.totalVentesBrutes,
          totalVentes: finances.totalVentesNettes,
          totalCommissions: finances.totalCommissions,
          totalPaid: finances.totalVerse,
          balance: finances.soldeDisponible,
        };
      }),
    );

    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Photo d'une catégorie (pastilles de l'accueil du site et de l'app). L'image
// est d'abord envoyée via POST /upload ; ici on enregistre son URL.
// image: null → retour à la photo automatique (premier produit de la catégorie).
router.patch('/admin/categories/:id', adminMiddleware, async (req, res) => {
  try {
    const categorie = await Categorie.findByPk(req.params.id);
    if (!categorie) return res.status(404).json({ success: false, message: 'Catégorie introuvable.' });

    const { image } = req.body;
    if (image !== null && (typeof image !== 'string' || !/^(https?:\/\/|\/uploads\/)/.test(image))) {
      return res.status(400).json({ success: false, message: 'Image invalide.' });
    }
    const avant = { image: categorie.image };
    await categorie.update({ image });
    await journaliser(req, {
      action: 'categorie.image', entite: 'Categorie', entiteId: categorie.id, avant, apres: { image }, champs: ['image'],
    });
    return res.json({ success: true, data: categorie });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;


function notificationStatutBoutique(statut) {
  const messages = {
    validee: ['Boutique validée', 'Votre boutique est validée : vos produits sont visibles sur la marketplace.'],
    suspendue: ['Boutique suspendue', 'Votre boutique a été suspendue. Contactez le support pour plus d\'informations.'],
    en_attente: ['Boutique en attente', 'Votre boutique est repassée en attente de validation.'],
  };
  const [titre, message] = messages[statut];
  return { type: `boutique_${statut}`, titre, message, lien: 'vendeur' };
}
