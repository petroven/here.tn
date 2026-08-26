import express from 'express';
import { Utilisateur, WalletTransaction, Commande } from '../models/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/wallet/me', authMiddleware, async (req, res) => {
  try {
    const utilisateur = await Utilisateur.findByPk(req.user.id, { attributes: ['id', 'soldeWallet'] });
    if (!utilisateur) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    const transactions = await WalletTransaction.findAll({
      where: { utilisateurId: req.user.id },
      include: [{ model: Commande, attributes: ['id', 'numeroCommande'] }],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    return res.json({ success: true, data: { solde: utilisateur.soldeWallet, transactions } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
