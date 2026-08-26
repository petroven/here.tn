import express from 'express';
import {
  Boutique, Avis, Commande, Commission, Retrait, Utilisateur, Produit, Categorie,
  Paiement, LigneCommande, Variante,
} from '../models/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { crediterCashback } from '../utils/wallet.js';
import { envoyerRecuPaiement } from '../utils/email.js';
import { calculerFinancesBoutique } from '../utils/finance.js';

const router = express.Router();

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
      include: [{ model: Utilisateur, as: 'vendeur' }],
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
      include: [{ model: Boutique, include: [{ model: Utilisateur, as: 'vendeur' }] }],
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

    if (!['approuve', 'rejete'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }

    const retrait = await Retrait.findByPk(retraitId);
    if (!retrait) {
      return res.status(404).json({ success: false, message: 'Retrait non trouvé.' });
    }

    await retrait.update({
      statut,
      motifRejection: statut === 'rejete' ? motifRejection : null,
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
    await Commande.update({ statut: 'payee' }, { where: { id: paiement.commandeId } });
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

    const lignes = await LigneCommande.findAll({ where: { commandeId: paiement.commandeId }, transaction });
    for (const ligne of lignes) {
      if (ligne.varianteId) {
        await Variante.increment('stock', { by: ligne.quantite, where: { id: ligne.varianteId }, transaction });
      } else {
        await Produit.increment('stock', { by: ligne.quantite, where: { id: ligne.produitId }, transaction });
      }
    }

    await paiement.update({ statut: 'echec' }, { transaction });
    await Commande.update({ statut: 'annulee' }, { where: { id: paiement.commandeId }, transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Virement rejeté, commande annulée et stock restauré.' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get commission analytics
router.get('/admin/commissions', adminMiddleware, async (req, res) => {
  try {
    const commissions = await Commission.findAll({
      include: [
        { model: Commande },
        { model: Boutique, include: [{ model: Utilisateur, as: 'vendeur' }] },
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

  boutique.statut = statut;
  await boutique.save();

  return res.json({ success: true, data: boutique });
});

router.patch('/admin/avis/:id', adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { valide } = req.body;

  const avis = await Avis.findByPk(id);
  if (!avis) {
    return res.status(404).json({ success: false, message: 'Avis introuvable.' });
  }

  avis.valide = Boolean(valide);
  await avis.save();

  return res.json({ success: true, data: avis });
});

// Admin dashboard stats
router.get('/admin/stats', adminMiddleware, async (req, res) => {
  try {
    const totalVendors = await Boutique.count();
    const verifiedVendors = await Boutique.count({ where: { statut: 'validee' } });
    const pendingVendors = await Boutique.count({ where: { statut: 'en_attente' } });
    
    const totalOrders = await Commande.count();
    const totalProducts = await Produit.count();
    const totalRevenue = await Commande.sum('montantCommission', { where: { statut: 'payee' } }) || 0;
    const pendingCommissions = await Commission.sum('montant', { where: { statut: 'collectee' } }) || 0;
    
    const totalUsers = await Utilisateur.count();
    const vendorUsers = await Utilisateur.count({ where: { role: 'vendeur' } });
    const customerUsers = await Utilisateur.count({ where: { role: 'client' } });

    res.json({
      success: true,
      data: {
        vendors: { total: totalVendors, verified: verifiedVendors, pending: pendingVendors },
        orders: { total: totalOrders },
        products: { total: totalProducts },
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

    await boutique.update({ statut });
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
        { model: Utilisateur, as: 'client' },
        { model: Boutique, as: 'boutique', include: [{ model: Utilisateur, as: 'vendeur' }] },
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
    const produits = await Produit.findAll({
      include: [
        { model: Boutique, as: 'boutique', attributes: ['id', 'nom', 'statut'] },
        { model: Categorie, as: 'categorie', attributes: ['id', 'nom'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ success: true, data: produits, count: produits.length });
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
    await produit.update({ status });
    return res.json({ success: true, data: produit });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/admin/products/:id', adminMiddleware, async (req, res) => {
  try {
    const produit = await Produit.findByPk(req.params.id);
    if (!produit) return res.status(404).json({ success: false, message: 'Produit introuvable.' });
    await produit.update({ status: 'inactif' });
    return res.json({ success: true, message: 'Produit désactivé du catalogue.', data: produit });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Settlement report
router.get('/admin/settlement-report', adminMiddleware, async (req, res) => {
  try {
    const boutiques = await Boutique.findAll({
      include: [{ model: Utilisateur, as: 'vendeur' }],
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

export default router;

