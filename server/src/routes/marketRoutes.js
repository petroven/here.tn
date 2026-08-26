import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  getProduits,
  getProduitById,
  getBoutiques,
  getBoutiqueById,
  createCommande,
  confirmPayment,
  getCommandeFacture,
  getMesCommandes,
  annulerCommandeParClient,
  updateLivraisonStatut,
  assignDeliveryManually,
  getTracking,
  validerCouponEndpoint,
  getCouponsActifs,
  getConfirmationCommande,
  repondreConfirmationCommande,
} from '../controllers/orderController.js';
import {
  getGouvernorats,
  getDelegations,
  getFraisLivraison,
} from '../controllers/geoController.js';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
} from '../controllers/wishlistController.js';
import {
  getAvisByProduit,
  createAvis,
  createAvisClient,
  getReputationClient,
} from '../controllers/avisController.js';
import { Categorie } from '../models/index.js';
import { marketplaceConfig } from '../config/marketplace.js';

const router = express.Router();

// --- PUBLIC CONFIG ---
// Le virement bancaire n'est proposé au client que si un RIB plateforme est
// configuré côté serveur — sinon l'option resterait affichée sans compte où
// virer les fonds.
router.get('/config/payment-methods', (_req, res) => {
  const { platformBank } = marketplaceConfig;
  const virementDisponible = Boolean(platformBank.titulaire && platformBank.rib);
  res.json({
    success: true,
    data: {
      virementDisponible,
      platformBank: virementDisponible ? platformBank : null,
    },
  });
});

// --- PUBLIC GEOGRAPHY ROUTES ---
router.get('/gouvernorats', getGouvernorats);
router.get('/gouvernorats/:gouvernoratId/delegations', getDelegations);
router.get('/gouvernorats/:gouvernoratId/frais', getFraisLivraison);

// --- PUBLIC CATALOG ROUTES ---
router.get('/produits', getProduits);
router.get('/produits/:id', getProduitById);
router.get('/boutiques', getBoutiques);
router.get('/boutiques/:id', getBoutiqueById);
router.get('/categories', async (_req, res) => {
  try {
    const categories = await Categorie.findAll({
      where: { parentId: null },
      include: [{ model: Categorie, as: 'sousCategories', attributes: ['id', 'nom', 'slug', 'icone', 'parentId'] }],
      order: [['nom', 'ASC']],
    });
    res.json({ success: true, data: categories, count: categories.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/produits/:produitId/avis', getAvisByProduit);
router.get('/livraisons/track/:trackingId', getTracking);
router.get('/commandes/confirmation/:token', getConfirmationCommande);
router.post('/commandes/confirmation/:token', repondreConfirmationCommande);

// --- WISHLIST ROUTES (AUTHENTICATED) ---
router.get('/wishlist', authMiddleware, getWishlist);
router.post('/wishlist', authMiddleware, addToWishlist);
router.delete('/wishlist/:produitId', authMiddleware, removeFromWishlist);
router.get('/wishlist/check', authMiddleware, checkWishlist);

// --- REVIEWS ROUTES (AUTHENTICATED) ---
router.post('/avis', authMiddleware, createAvis);
router.post('/avis/client', authMiddleware, requireRole('vendeur', 'admin_boutique', 'administrateur', 'super_admin'), createAvisClient);
router.get('/clients/:clientId/reputation', authMiddleware, requireRole('vendeur', 'admin_boutique', 'administrateur', 'super_admin'), getReputationClient);

// --- COUPON VALIDATION (AUTHENTICATED) ---
router.post('/coupons/valider', authMiddleware, validerCouponEndpoint);
router.get('/coupons/actifs', getCouponsActifs);

// --- ORDER & PAYMENT ROUTES (AUTHENTICATED) ---
router.post('/commandes', authMiddleware, requireRole('client'), createCommande);
router.post('/paiements/confirm', authMiddleware, confirmPayment);
router.get('/commandes/mes-commandes', authMiddleware, getMesCommandes);
router.put('/commandes/:id/annuler', authMiddleware, annulerCommandeParClient);
router.get('/commandes/:id/facture', authMiddleware, getCommandeFacture);
router.put('/commandes/:commandeId/livraison', authMiddleware, updateLivraisonStatut);
router.post('/orders/:id/assign-delivery', authMiddleware, requireRole('vendeur', 'admin_boutique', 'administrateur', 'super_admin'), assignDeliveryManually);

export default router;
