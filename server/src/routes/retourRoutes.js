import express from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { Retour, Commande, Boutique, LigneCommande, Produit, Variante, Livraison, Categorie, Utilisateur } from '../models/index.js';
import { crediterRemboursement } from '../utils/wallet.js';
import { envoyerRemboursementCredite } from '../utils/email.js';
import { uploadImage } from '../utils/upload.js';
import { marketplaceConfig } from '../config/marketplace.js';
import { resolveDelaiRetourCommande, dateLimiteRetour, fraisRetourParDefaut } from '../utils/returnPolicy.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' });

const ADMIN_ROLES = ['administrateur', 'super_admin'];

// Une demande de retour restée sans réponse vendeur passé ce délai est
// escaladée à la médiation admin — vérifié paresseusement à chaque lecture
// (même schéma que les notifications livreur : pas de tâche planifiée
// séparée à maintenir).
function escaladerSiExpire(retour) {
  if (retour.statut === 'demande' && retour.dateLimiteReponseVendeur && new Date(retour.dateLimiteReponseVendeur) < new Date()) {
    return retour.update({ statut: 'litige' });
  }
  return Promise.resolve(retour);
}

// 1. Client creates a return request (RMA) — motif catégorisé + au moins une
// photo obligatoires, dans la fenêtre de retour propre à la catégorie du
// produit le plus restrictif de la commande.
router.post('/retours', authMiddleware, upload.array('photos', 5), async (req, res) => {
  try {
    const { commandeId, motif, motifCategorie } = req.body;
    const clientId = req.user.id;

    if (!commandeId || !motif) {
      return res.status(400).json({ success: false, message: 'commandeId et motif requis.' });
    }
    if (!['defaut', 'non_conforme', 'changement_avis'].includes(motifCategorie)) {
      return res.status(400).json({ success: false, message: 'Catégorie de motif invalide.' });
    }
    if (!req.files?.length) {
      return res.status(400).json({ success: false, message: 'Au moins une photo est requise pour ouvrir une demande de retour.' });
    }

    const commande = await Commande.findOne({
      where: { id: commandeId, clientId },
      include: [
        { model: Livraison, as: 'livraison' },
        { model: LigneCommande, as: 'lignes', include: [{ model: Produit, as: 'produit', include: [{ model: Categorie, as: 'categorie' }] }] },
      ],
    });

    if (!commande) {
      return res.status(404).json({ success: false, message: 'Commande introuvable ou ne vous appartient pas.' });
    }

    if (commande.statut !== 'livree') {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez retourner que des commandes livrées.' });
    }

    const delaiJours = resolveDelaiRetourCommande(commande.lignes);
    if (delaiJours <= 0) {
      return res.status(400).json({ success: false, message: 'Cette commande contient un ou plusieurs articles non retournables.' });
    }

    const dateLivraisonRef = commande.livraison?.dateLivraison || commande.updatedAt;
    const limite = dateLimiteRetour(dateLivraisonRef, delaiJours);
    if (limite && Date.now() > limite.getTime()) {
      return res.status(400).json({
        success: false,
        message: `Le délai de retour de ${delaiJours} jour(s) après la livraison est dépassé. Le retour n'est plus possible.`,
      });
    }

    const existing = await Retour.findOne({ where: { commandeId } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Une demande de retour existe déjà pour cette commande.' });
    }

    const photos = [];
    for (const file of req.files) {
      photos.push(await uploadImage(file, 'heretn/retours'));
    }

    const dateLimiteReponseVendeur = new Date(Date.now() + marketplaceConfig.returnPolicy.vendorResponseHours * 60 * 60 * 1000);

    const retour = await Retour.create({
      commandeId,
      clientId,
      boutiqueId: commande.boutiqueId,
      motif,
      motifCategorie,
      photos,
      statut: 'demande',
      montantRemboursement: commande.total,
      dateLimiteReponseVendeur,
    });

    return res.status(201).json({ success: true, data: retour, message: 'Demande de retour enregistrée.' });
  } catch (error) {
    console.error('[RMA] Erreur création retour:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get list of return requests
router.get('/retours', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let filter = {};
    if (role === 'client') {
      filter = { clientId: userId };
    } else if (role === 'vendeur' || role === 'admin_boutique') {
      const boutique = await Boutique.findOne({ where: { vendeurId: userId } });
      if (!boutique) {
        return res.status(404).json({ success: false, message: 'Boutique non trouvée.' });
      }
      filter = { boutiqueId: boutique.id };
    } // Admin sees all

    const retours = await Retour.findAll({
      where: filter,
      include: [
        { model: Commande, attributes: ['id', 'numeroCommande', 'total', 'statut'] },
        { model: Boutique, as: 'boutique', attributes: ['id', 'nom'] },
        { model: Utilisateur, as: 'client', attributes: ['id', 'nom', 'prenom', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    await Promise.all(retours.map(escaladerSiExpire));

    return res.json({ success: true, data: retours });
  } catch (error) {
    console.error('[RMA] Erreur liste retours:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Vendor/Admin processes return request (or admin tranche un litige)
router.put('/retours/:id/statut', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, commentaireVendeur, fraisRetourALaCharge } = req.body;
    const userId = req.user.id;
    const role = req.user.role;

    if (!['approuve', 'refuse', 'rembourse'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut de retour invalide.' });
    }

    const retour = await Retour.findByPk(id, {
      include: [{ model: Commande, include: [{ model: LigneCommande, as: 'lignes' }] }],
    });

    if (!retour) {
      return res.status(404).json({ success: false, message: 'Demande de retour introuvable.' });
    }

    // Un litige escaladé (vendeur muet ou déjà en désaccord) ne peut plus
    // être tranché que par un admin — le vendeur a perdu la main.
    if (retour.statut === 'litige' && !ADMIN_ROLES.includes(role)) {
      return res.status(403).json({ success: false, message: 'Ce retour est en médiation admin — le vendeur ne peut plus le traiter directement.' });
    }

    if (role === 'vendeur' || role === 'admin_boutique') {
      const boutique = await Boutique.findOne({ where: { vendeurId: userId } });
      if (!boutique || Number(retour.boutiqueId) !== Number(boutique.id)) {
        return res.status(403).json({ success: false, message: 'Accès non autorisé pour cette boutique.' });
      }
    } else if (!ADMIN_ROLES.includes(role)) {
      return res.status(403).json({ success: false, message: 'Accès réservé aux vendeurs et administrateurs.' });
    }

    const updates = {
      statut,
      commentaireVendeur: commentaireVendeur || retour.commentaireVendeur,
      dateTraitement: new Date(),
      fraisRetourALaCharge: fraisRetourALaCharge || retour.fraisRetourALaCharge || fraisRetourParDefaut(retour.motifCategorie),
    };

    await retour.update(updates);

    if (statut === 'rembourse') {
      await Commande.update({ statut: 'retournee' }, { where: { id: retour.commandeId } });

      for (const ligne of retour.Commande?.lignes || []) {
        if (ligne.varianteId) {
          const varItem = await Variante.findByPk(ligne.varianteId);
          if (varItem) await varItem.update({ stock: varItem.stock + ligne.quantite });
        } else {
          const prodItem = await Produit.findByPk(ligne.produitId);
          if (prodItem) await prodItem.update({ stock: prodItem.stock + ligne.quantite });
        }
      }

      // Remboursement versé en solde site (jamais vers le moyen de paiement
      // d'origine) — conformément au contrat de retour envoyé au client.
      await crediterRemboursement(retour);
      envoyerRemboursementCredite(retour).catch((error) => {
        console.error('[EMAIL] Échec envoi confirmation remboursement:', error.message);
      });
    }

    return res.json({ success: true, data: retour, message: `Demande de retour mise à jour : ${statut}` });
  } catch (error) {
    console.error('[RMA] Erreur traitement retour:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
