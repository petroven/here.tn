import express from 'express';
import { Boutique, Commande, Commission, Retrait, LigneCommande, Produit, Variante, Utilisateur, MouvementStock, Categorie } from '../models/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validerPrixAvant, enregistrerChangementPrix } from '../utils/promoGuard.js';
import { emailBienvenueVendeur } from '../utils/email.js';
import { calculerFinancesBoutique } from '../utils/finance.js';
import { clampDelaiRetourOverride } from '../utils/returnPolicy.js';

const router = express.Router();
const boutiqueAdminMiddleware = requireRole('vendeur', 'admin_boutique', 'administrateur', 'super_admin');
const canManageVendor = (req, vendeurId) => ['administrateur', 'super_admin'].includes(req.user.role) || Number(req.user.id) === Number(vendeurId);

// Get vendor dashboard data
router.get('/vendor/dashboard/:vendeurId', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { vendeurId } = req.params;
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });

    // Get vendor's shop with products and variants
    const boutique = await Boutique.findOne({
      where: { vendeurId },
      include: [{ model: Produit, include: [{ model: Variante, as: 'variantes' }] }],
    });

    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
    }

    // Get vendor's orders
    const commandes = await Commande.findAll({
      where: { boutiqueId: boutique.id },
      include: [
        { model: LigneCommande, as: 'lignes', include: [{ model: Produit, as: 'produit' }] },
        { model: Commission },
      ],
    });

    // Source unique de vérité pour les finances de la boutique — évite que
    // les commandes livrées (statut='livree', jamais repassé à 'payee' pour
    // les paiements en ligne) disparaissent des gains affichés au vendeur.
    const finances = await calculerFinancesBoutique(boutique.id);

    res.json({
      success: true,
      data: {
        boutique,
        stats: {
          totalVentes: finances.totalVentesNettes,
          totalVentesBrutes: finances.totalVentesBrutes,
          totalCommissions: finances.totalCommissions,
          nombreCommandes: finances.nombreCommandes,
          totalVerse: finances.totalVerse,
          soldeEnAttenteEscrow: finances.soldeEnAttenteEscrow,
          soldeDisponible: finances.soldeDisponible,
        },
        commandes,
        retraits: finances.retraits,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Adjust stock independently from product editing and keep an audit trail.
router.patch('/vendor/products/:produitId/stock', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { produitId } = req.params;
    const { stock, variation, varianteId = null, motif = 'ajustement_manuel', note = '' } = req.body;
    const produit = await Produit.findByPk(produitId);
    if (!produit) return res.status(404).json({ success: false, message: 'Produit non trouvé.' });

    const boutique = await Boutique.findByPk(produit.boutiqueId);
    if (!boutique || !canManageVendor(req, boutique.vendeurId)) {
      return res.status(403).json({ success: false, message: 'Accès à ce stock refusé.' });
    }

    const variante = varianteId ? await Variante.findOne({ where: { id: varianteId, produitId } }) : null;
    if (varianteId && !variante) return res.status(404).json({ success: false, message: 'Variante introuvable.' });

    const currentStock = variante ? variante.stock : produit.stock;
    const nextStock = stock !== undefined ? Number(stock) : currentStock + Number(variation || 0);
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      return res.status(400).json({ success: false, message: 'Le stock doit être un entier positif ou nul.' });
    }

    if (variante) {
      await variante.update({ stock: nextStock });
      const totalStock = await Variante.sum('stock', { where: { produitId } });
      await produit.update({ stock: totalStock || 0 });
    } else {
      await produit.update({ stock: nextStock });
    }

    await MouvementStock.create({
      produitId,
      varianteId: variante?.id || null,
      variation: nextStock - currentStock,
      stockAvant: currentStock,
      stockApres: nextStock,
      motif,
      note: note || null,
      utilisateurId: req.user.id,
    });

    const updated = await Produit.findByPk(produitId, { include: [{ model: Variante, as: 'variantes' }] });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/vendor/products/:produitId/stock-history', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const produit = await Produit.findByPk(req.params.produitId);
    if (!produit) return res.status(404).json({ success: false, message: 'Produit non trouvé.' });
    const boutique = await Boutique.findByPk(produit.boutiqueId);
    if (!boutique || !canManageVendor(req, boutique.vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cet historique refusé.' });
    const mouvements = await MouvementStock.findAll({
      where: { produitId: produit.id },
      include: [{ model: Variante, as: 'variante' }, { model: Utilisateur, as: 'utilisateur', attributes: ['id', 'nom', 'prenom'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });
    return res.json({ success: true, data: mouvements });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Request withdrawal
router.post('/vendor/withdrawal', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { vendeurId: requestedVendorId, montant, iban } = req.body;
    const vendeurId = requestedVendorId || req.user.id;
    const amount = Number(montant);
    const minimumWithdrawal = Number(process.env.MIN_WITHDRAWAL_AMOUNT || 50);
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });

    if (!Number.isFinite(amount) || amount < minimumWithdrawal) {
      return res.status(400).json({ success: false, message: `Le retrait minimum est de ${minimumWithdrawal.toFixed(3)} TND.` });
    }

    const boutique = await Boutique.findOne({ where: { vendeurId } });
    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
    }

    const { soldeDisponible } = await calculerFinancesBoutique(boutique.id);
    if (amount > soldeDisponible) {
      return res.status(400).json({ success: false, message: `Solde disponible insuffisant (${soldeDisponible.toFixed(3)} TND).` });
    }

    const retrait = await Retrait.create({
      boutiqueId: boutique.id,
      montant: amount,
      iban,
      statut: 'demande',
    });

    res.status(201).json({ success: true, data: retrait });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update vendor shop info
router.put('/vendor/boutique/:vendeurId', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { vendeurId } = req.params;
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });
    const { nom, description, logo, banniere, modePaiement, iban, flouciNumero } = req.body;

    const boutique = await Boutique.findOne({ where: { vendeurId } });
    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
    }

    if (modePaiement === 'flouci' && !flouciNumero) {
      return res.status(400).json({ success: false, message: 'Numéro Flouci requis pour ce mode de paiement.' });
    }
    if (modePaiement === 'iban' && iban !== undefined && !iban) {
      return res.status(400).json({ success: false, message: 'IBAN requis pour ce mode de paiement.' });
    }

    await boutique.update({
      nom, description, logo, banniere,
      modePaiement: modePaiement || boutique.modePaiement,
      iban: iban !== undefined ? iban : boutique.iban,
      flouciNumero: flouciNumero !== undefined ? flouciNumero : boutique.flouciNumero,
    });
    res.json({ success: true, data: boutique });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all products for vendor
router.get('/vendor/products/:vendeurId', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { vendeurId } = req.params;
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });

    const boutique = await Boutique.findOne({ where: { vendeurId } });
    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
    }

    const produits = await Produit.findAll({
      where: { boutiqueId: boutique.id },
      include: [{ model: Variante, as: 'variantes' }],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: produits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create product with optional variants
router.post('/vendor/products/:vendeurId', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { vendeurId } = req.params;
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });
    const { nom, description, prix, stock, image, categorieId, status = 'actif', variantes, delaiRetourJoursOverride } = req.body;

    if (!nom || !description || !prix) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants.' });
    }

    const boutique = await Boutique.findOne({ where: { vendeurId } });
    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
    }

    const finalStock = variantes && variantes.length > 0
      ? variantes.reduce((sum, v) => sum + Number(v.stock || 0), 0)
      : (stock !== undefined ? stock : 0);

    const categorie = categorieId ? await Categorie.findByPk(categorieId) : null;

    const produit = await Produit.create({
      nom,
      description,
      prix,
      // Un produit neuf n'a pas d'historique de prix: le prix barré ne peut
      // être fixé qu'après modification du prix (politique anti-fausses promotions).
      prixAvant: null,
      stock: finalStock,
      image,
      categorieId: categorieId || null,
      boutiqueId: boutique.id,
      status,
      hasVariantes: variantes && variantes.length > 0,
      delaiRetourJoursOverride: clampDelaiRetourOverride(categorie?.delaiRetourJours, delaiRetourJoursOverride),
    });
    await enregistrerChangementPrix(produit.id, prix);

    // Create variants if supplied
    if (variantes && variantes.length > 0) {
      for (const v of variantes) {
        await Variante.create({
          produitId: produit.id,
          taille: v.taille || null,
          couleur: v.couleur || null,
          pointure: v.pointure || null,
          sku: v.sku || null,
          stock: Number(v.stock || 0),
          prixSupplement: Number(v.prixSupplement || 0),
          image: v.image || null,
        });
      }
    }

    // Reload product with variants
    const detailedProduct = await Produit.findByPk(produit.id, {
      include: [{ model: Variante, as: 'variantes' }],
    });

    res.status(201).json({ success: true, data: detailedProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update product
router.put('/vendor/products/:produitId', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { produitId } = req.params;
    const { nom, description, prix, prixAvant, stock, image, categorieId, status, variantes, delaiRetourJoursOverride } = req.body;

    const produit = await Produit.findByPk(produitId);
    if (!produit) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé.' });
    }
    const boutique = await Boutique.findByPk(produit.boutiqueId);
    if (!boutique || !canManageVendor(req, boutique.vendeurId)) return res.status(403).json({ success: false, message: 'Accès à ce produit refusé.' });

    const nouveauPrix = prix !== undefined && prix !== '' ? Number(prix) : produit.prix;
    let prixAvantValide = produit.prixAvant;
    if (prixAvant !== undefined) {
      // Le vendeur fournit explicitement un prixAvant (ou le vide pour l'effacer).
      try {
        prixAvantValide = await validerPrixAvant(produit.id, nouveauPrix, prixAvant);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    } else if (prixAvantValide !== null && prixAvantValide !== undefined && Number(prixAvantValide) <= nouveauPrix) {
      // Le prix a changé et le prix barré existant n'est plus une remise valide.
      prixAvantValide = null;
    }

    // Delete existing variants and re-create if updated variants list is supplied
    if (variantes !== undefined) {
      await Variante.destroy({ where: { produitId } });
      if (Array.isArray(variantes) && variantes.length > 0) {
        for (const v of variantes) {
          await Variante.create({
            produitId,
            taille: v.taille || null,
            couleur: v.couleur || null,
            pointure: v.pointure || null,
            sku: v.sku || null,
            stock: Number(v.stock || 0),
            prixSupplement: Number(v.prixSupplement || 0),
            image: v.image || null,
          });
        }
        await produit.update({ hasVariantes: true });
      } else {
        await produit.update({ hasVariantes: false });
      }
    }

    const finalStock = (variantes && variantes.length > 0)
      ? variantes.reduce((sum, v) => sum + Number(v.stock || 0), 0)
      : (stock !== undefined ? stock : produit.stock);

    const prixAChange = Number(nouveauPrix) !== Number(produit.prix);
    const categorieCible = categorieId
      ? await Categorie.findByPk(categorieId)
      : (produit.categorieId ? await Categorie.findByPk(produit.categorieId) : null);

    await produit.update({
      nom: nom || produit.nom,
      description: description || produit.description,
      prix: nouveauPrix,
      prixAvant: prixAvantValide,
      stock: finalStock,
      image: image || produit.image,
      categorieId: categorieId || produit.categorieId,
      status: status || produit.status,
      delaiRetourJoursOverride: delaiRetourJoursOverride !== undefined
        ? clampDelaiRetourOverride(categorieCible?.delaiRetourJours, delaiRetourJoursOverride)
        : produit.delaiRetourJoursOverride,
    });

    if (prixAChange) {
      await enregistrerChangementPrix(produit.id, nouveauPrix);
    }

    const detailedProduct = await Produit.findByPk(produitId, {
      include: [{ model: Variante, as: 'variantes' }],
    });

    res.json({ success: true, data: detailedProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete product
router.delete('/vendor/products/:produitId', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { produitId } = req.params;

    const produit = await Produit.findByPk(produitId);
    if (!produit) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé.' });
    }
    const boutique = await Boutique.findByPk(produit.boutiqueId);
    if (!boutique || !canManageVendor(req, boutique.vendeurId)) return res.status(403).json({ success: false, message: 'Accès à ce produit refusé.' });

    await produit.destroy();
    res.json({ success: true, message: 'Produit supprimé avec succès.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Register as vendor
router.post('/vendor/register', authMiddleware, async (req, res) => {
  try {
    const { vendeurId: requestedVendorId, nom, description, logo, iban, modePaiement = 'iban', flouciNumero, gouvernoratId, delegationId, adresse, accepteConditionsRetour } = req.body;
    const vendeurId = requestedVendorId || req.user.id;
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });

    if (!nom) {
      return res.status(400).json({ success: false, message: 'Nom de boutique requis.' });
    }
    if (accepteConditionsRetour !== true) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez accepter les conditions de vente et de retour pour créer votre boutique.',
      });
    }
    if (modePaiement === 'flouci' && !flouciNumero) {
      return res.status(400).json({ success: false, message: 'Numéro Flouci requis pour ce mode de paiement.' });
    }
    if (modePaiement === 'iban' && !iban) {
      return res.status(400).json({ success: false, message: 'IBAN requis pour ce mode de paiement.' });
    }

    // Check if shop already exists
    const existing = await Boutique.findOne({ where: { vendeurId } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà une boutique.' });
    }

    const boutique = await Boutique.create({
      vendeurId,
      nom,
      description: description || '',
      logo: logo || '',
      iban: modePaiement === 'iban' ? iban : null,
      modePaiement,
      flouciNumero: modePaiement === 'flouci' ? flouciNumero : null,
      gouvernoratId: gouvernoratId || null,
      delegationId: delegationId || null,
      adresse: adresse || '',
      statut: 'en_attente',
      accepteConditionsRetour: true,
    });

    // Update user's fields as well
    await Utilisateur.update(
      { role: 'vendeur', gouvernoratId: gouvernoratId || null, delegationId: delegationId || null, adresse: adresse || '' },
      { where: { id: vendeurId } }
    );

    const vendeur = await Utilisateur.findByPk(vendeurId);
    if (vendeur) await emailBienvenueVendeur(vendeur, boutique);

    res.status(201).json({ success: true, data: boutique, message: 'Boutique créée et en attente d\'approbation.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get vendor's shop info
router.get('/vendor/shop/:vendeurId', async (req, res) => {
  try {
    const { vendeurId } = req.params;

    const boutique = await Boutique.findOne({
      where: { vendeurId },
      include: [
        { model: Produit, order: [['createdAt', 'DESC']] },
      ],
    });

    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
    }

    res.json({ success: true, data: boutique });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
