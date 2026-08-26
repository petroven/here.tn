import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { Livraison, Commande, Boutique, Utilisateur } from '../models/index.js';
import { generateAwbPDF } from '../utils/pdf.js';

const router = express.Router();

// Get printable AWB (Air Waybill) PDF for vendor
router.get('/livraisons/:commandeId/awb', authMiddleware, async (req, res) => {
  try {
    const { commandeId } = req.params;

    // Load order and associated delivery info
    const commande = await Commande.findByPk(commandeId, {
      include: [
        { model: Livraison, as: 'livraison' },
        { model: Boutique, as: 'boutique' },
        { model: Utilisateur, as: 'client' },
      ],
    });

    if (!commande) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }

    // Verify ownership (only the seller boutique owner or an admin can access)
    const boutique = commande.boutique;
    if (!boutique) {
      return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
    }

    if (req.user.role !== 'administrateur' && Number(boutique.vendeurId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
    }

    const livraison = commande.livraison;
    if (!livraison) {
      return res.status(404).json({ success: false, message: 'Aucune information de livraison pour cette commande.' });
    }

    // Generate the PDF and send it as a download
    const pdfBuffer = await generateAwbPDF(
      livraison,
      commande,
      commande.adresseLivraison
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=awb-${livraison.trackingId}.pdf`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[AWB] Erreur de génération:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
