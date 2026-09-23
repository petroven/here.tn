import express from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { Op } from 'sequelize';
import { Boutique, Commande, Commission, Retrait, LigneCommande, Produit, Variante, Utilisateur, MouvementStock, Categorie } from '../models/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validerPrixAvant, enregistrerChangementPrix } from '../utils/promoGuard.js';
import { emailBienvenueVendeur } from '../utils/email.js';
import { calculerFinancesBoutique } from '../utils/finance.js';
import { clampDelaiRetourOverride } from '../utils/returnPolicy.js';
import { uploadImage } from '../utils/upload.js';
import {
  buildImportTemplateWorkbook,
  parseSpreadsheetBuffer,
  readZipArchive,
  materializeImages,
  buildImportPreview,
} from '../utils/productImport.js';
import { createImport, getImport, discardImport } from '../utils/importStore.js';

const router = express.Router();
const uploadKyc = multer({ dest: 'uploads/temp/' });
// Fichier d'import gardé en mémoire (jamais écrit tel quel sur disque) — voir
// utils/productImport.js pour l'extraction ZIP sans risque de traversée de
// chemin. 150 Mo couvre un catalogue de ~100 produits avec plusieurs photos.
const uploadImportFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });
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

// Soumission KYC — CIN + RIB, chacun avec un justificatif scanné. Stocké en
// disque local (server/uploads), jamais chez un prestataire tiers. Repasse
// systématiquement à 'en_attente', y compris après un rejet, pour qu'un
// admin revoie une nouvelle soumission corrigée.
router.post(
  '/vendor/kyc/:vendeurId',
  authMiddleware,
  boutiqueAdminMiddleware,
  uploadKyc.fields([{ name: 'documentCin', maxCount: 1 }, { name: 'documentRib', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { vendeurId } = req.params;
      if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });
      const { kycCin, kycRib } = req.body;

      const boutique = await Boutique.findOne({ where: { vendeurId } });
      if (!boutique) return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });

      if (!kycCin || !kycRib) {
        return res.status(400).json({ success: false, message: 'Numéro CIN et RIB requis.' });
      }
      const fichierCin = req.files?.documentCin?.[0];
      const fichierRib = req.files?.documentRib?.[0];
      if (!fichierCin && !boutique.kycDocumentCin) {
        return res.status(400).json({ success: false, message: 'Justificatif CIN requis.' });
      }
      if (!fichierRib && !boutique.kycDocumentRib) {
        return res.status(400).json({ success: false, message: 'Justificatif RIB (RIB bancaire scanné) requis.' });
      }

      await boutique.update({
        kycCin,
        kycRib,
        kycDocumentCin: fichierCin ? await uploadImage(fichierCin, 'heretn/kyc') : boutique.kycDocumentCin,
        kycDocumentRib: fichierRib ? await uploadImage(fichierRib, 'heretn/kyc') : boutique.kycDocumentRib,
        kycStatut: 'en_attente',
        kycCommentaireAdmin: null,
        kycDateSoumission: new Date(),
        kycDateTraitement: null,
      });

      res.json({ success: true, data: boutique, message: 'Documents envoyés — en attente de vérification par un administrateur.' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

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

// Import en masse — modèle Excel à télécharger, colonnes voir
// utils/productImport.js#buildImportTemplateWorkbook.
router.get('/vendor/products/import/template', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const workbook = buildImportTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modele-import-produits.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Étape 1 de l'import en masse : le vendeur dépose un .xlsx/.csv (sans
// photos) ou un .zip (produits.xlsx + images/<reference>/*.jpg) — on parse,
// on valide chaque ligne et on renvoie une prévisualisation sans rien créer
// en base. Les photos du ZIP sont déjà matérialisées en fichiers temporaires
// (voir importStore) pour que l'étape de confirmation n'ait plus qu'à les
// envoyer vers Cloudinary/stockage local.
router.post(
  '/vendor/products/:vendeurId/import/preview',
  authMiddleware,
  boutiqueAdminMiddleware,
  uploadImportFile.single('fichier'),
  async (req, res) => {
    try {
      const { vendeurId } = req.params;
      if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });
      const boutique = await Boutique.findOne({ where: { vendeurId } });
      if (!boutique) return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
      if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier fourni.' });

      const ext = path.extname(req.file.originalname || '').toLowerCase();
      let spreadsheetBuffer;
      let spreadsheetExt;
      let imagesByReference = new Map();

      // Erreurs de contenu (ZIP corrompu, ZIP-bombe, fichier illisible) —
      // problème d'entrée utilisateur, pas une panne serveur : 400, pas 500.
      let parsed;
      try {
        if (ext === '.zip') {
          const archive = readZipArchive(req.file.buffer);
          if (!archive.spreadsheet) {
            return res.status(400).json({ success: false, message: 'Le ZIP ne contient aucun fichier produits.xlsx ou produits.csv à la racine.' });
          }
          spreadsheetBuffer = archive.spreadsheet.buffer;
          spreadsheetExt = archive.spreadsheet.ext;
          imagesByReference = materializeImages(archive.imagesByReference);
        } else if (ext === '.xlsx' || ext === '.csv') {
          spreadsheetBuffer = req.file.buffer;
          spreadsheetExt = ext.slice(1);
        } else {
          return res.status(400).json({ success: false, message: 'Format non supporté — utilisez un fichier .xlsx, .csv ou .zip.' });
        }

        parsed = await parseSpreadsheetBuffer(spreadsheetBuffer, spreadsheetExt);
      } catch (parseError) {
        return res.status(400).json({ success: false, message: `Fichier illisible : ${parseError.message}` });
      }
      const categories = await Categorie.findAll();
      const existingProduits = await Produit.findAll({ attributes: ['reference'], where: { reference: { [Op.not]: null } } });
      const existingReferences = new Set(existingProduits.map((p) => p.reference));

      const { rows, summary } = buildImportPreview(parsed, { categories, existingReferences, imagesByReference });

      const importId = randomUUID();
      createImport(importId, { vendeurId: Number(vendeurId), rows, imagesByReference });

      // On ne renvoie jamais les chemins disque au client — seulement ce qui
      // sert à l'affichage de la prévisualisation.
      const rowsForClient = rows.map(({ imagePaths, ...rest }) => rest);

      res.json({ success: true, data: { importId, rows: rowsForClient, summary } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// Étape 2 : le vendeur confirme — crée un Produit par ligne valide (hors
// erreurs), envoie ses photos éventuelles vers Cloudinary/stockage local via
// le même uploadImage() que le formulaire de création manuelle.
router.post('/vendor/products/:vendeurId/import/commit', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { vendeurId } = req.params;
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });
    const boutique = await Boutique.findOne({ where: { vendeurId } });
    if (!boutique) return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });

    const { importId } = req.body;
    const pending = getImport(importId);
    if (!pending || pending.vendeurId !== Number(vendeurId)) {
      return res.status(410).json({ success: false, message: "Session d'import expirée ou introuvable — veuillez réimporter votre fichier." });
    }

    const skippedRows = pending.rows.filter((row) => row.status === 'error');
    const importableRows = pending.rows.filter((row) => row.status !== 'error');
    const produits = [];
    const commitErrors = [];

    for (const row of importableRows) {
      try {
        const uploadedUrls = [];
        for (const imagePath of row.imagePaths) {
          const url = await uploadImage({ path: imagePath, originalname: path.basename(imagePath) }, 'heretn/products');
          uploadedUrls.push(url);
        }

        const produit = await Produit.create({
          nom: row.nom,
          description: row.description,
          prix: row.prix,
          prixAvant: null,
          stock: row.stock,
          reference: row.reference,
          marque: row.marque,
          image: uploadedUrls[0] || null,
          images: uploadedUrls,
          categorieId: row.categorieId,
          boutiqueId: boutique.id,
          status: 'actif',
          hasVariantes: false,
        });
        await enregistrerChangementPrix(produit.id, row.prix);
        produits.push(produit);
      } catch (error) {
        commitErrors.push({ rowIndex: row.rowIndex, reference: row.reference, nom: row.nom, message: error.message });
      }
    }

    discardImport(importId);

    res.status(201).json({
      success: true,
      data: {
        createdCount: produits.length,
        skippedRows: skippedRows.map((r) => ({ rowIndex: r.rowIndex, reference: r.reference, nom: r.nom, errors: r.errors })),
        commitErrors,
        produits,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Annulation depuis l'écran de prévisualisation — libère les photos
// temporaires sans attendre l'expiration du TTL.
router.delete('/vendor/products/import/:importId', authMiddleware, boutiqueAdminMiddleware, (req, res) => {
  const { importId } = req.params;
  const pending = getImport(importId);
  if (pending && !canManageVendor(req, pending.vendeurId)) {
    return res.status(403).json({ success: false, message: 'Accès à cet import refusé.' });
  }
  discardImport(importId);
  res.json({ success: true });
});

// Create product with optional variants
router.post('/vendor/products/:vendeurId', authMiddleware, boutiqueAdminMiddleware, async (req, res) => {
  try {
    const { vendeurId } = req.params;
    if (!canManageVendor(req, vendeurId)) return res.status(403).json({ success: false, message: 'Accès à cette boutique refusé.' });
    const { nom, description, prix, stock, image, images, categorieId, status = 'actif', variantes, delaiRetourJoursOverride } = req.body;

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
      images: Array.isArray(images) ? images.filter(Boolean) : [],
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
    const { nom, description, prix, prixAvant, stock, image, images, categorieId, status, variantes, delaiRetourJoursOverride } = req.body;

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
      images: Array.isArray(images) ? images.filter(Boolean) : produit.images,
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
