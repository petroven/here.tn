import express from 'express';
import { Commande, Paiement, Transaction, PaymentLog, Utilisateur } from '../models/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { verifyPaymentSignature } from '../middleware/verifyPaymentSignature.js';
import { getProvider } from '../services/payments/index.js';
import { crediterCashback } from '../utils/wallet.js';
import { envoyerRecuPaiement } from '../utils/email.js';

const router = express.Router();

const AMOUNT_TOLERANCE = 0.001; // TND — floating point rounding slack only

// Crée (ou rejoue de façon idempotente) une intention de paiement.
router.post('/payments/initiate', authMiddleware, async (req, res) => {
  try {
    const { commandeId, provider: providerName } = req.body;
    if (!commandeId || !providerName) {
      return res.status(400).json({ success: false, message: 'commandeId et provider requis.' });
    }

    const commande = await Commande.findByPk(commandeId);
    if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    if (Number(commande.clientId) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Accès à cette commande refusé.' });
    }
    if (commande.statut === 'payee') {
      return res.status(409).json({ success: false, message: 'Cette commande est déjà payée.' });
    }

    const provider = getProvider(providerName);

    // Idempotency: replay the same intent instead of double-charging on retry.
    const idempotencyKey = req.headers['idempotency-key'] || `${commandeId}:${providerName}:${req.user.id}`;
    const existing = await Transaction.findOne({ where: { idempotencyKey } });
    if (existing) {
      return res.json({
        success: true,
        data: { transactionId: existing.id, providerReference: existing.providerReference, statut: existing.statut, replay: true },
      });
    }

    // Montant recalculé exclusivement depuis la commande stockée en base —
    // jamais depuis une valeur envoyée par le frontend.
    const montant = Number(commande.total);

    const client = await Utilisateur.findByPk(req.user.id);
    const transaction = await Transaction.create({
      commandeId,
      utilisateurId: req.user.id,
      montant,
      provider: providerName,
      idempotencyKey,
      statut: 'initiee',
    });

    let result;
    try {
      result = await provider.initiate({ amount: montant, orderId: commandeId, email: client.email, phone: client.telephone });
    } catch (error) {
      await transaction.update({ statut: 'echec' });
      await PaymentLog.create({ transactionId: transaction.id, evenement: 'initiate_echec', statut: 'echec', montant, provider: providerName, message: error.message, ip: req.ip });
      return res.status(502).json({ success: false, message: 'Le prestataire de paiement est indisponible.' });
    }

    await transaction.update({ statut: 'en_attente', providerReference: result.providerReference });
    await PaymentLog.create({ transactionId: transaction.id, evenement: 'initiate', statut: 'en_attente', montant, provider: providerName, ip: req.ip });

    return res.status(201).json({
      success: true,
      data: { transactionId: transaction.id, paymentUrl: result.paymentUrl, providerReference: result.providerReference },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Webhook signé du prestataire — confirme (ou rejette) le paiement.
router.post('/payments/webhook/:provider', verifyPaymentSignature, async (req, res) => {
  try {
    const parsed = req.paymentProvider.parseWebhookPayload(req.body);
    if (!parsed.providerReference) {
      return res.status(400).json({ success: false, message: 'Référence de paiement manquante dans le webhook.' });
    }

    const transaction = await Transaction.findOne({ where: { providerReference: parsed.providerReference } });
    if (!transaction) {
      await PaymentLog.create({ evenement: 'webhook_recu', statut: 'transaction_introuvable', provider: req.params.provider, ip: req.ip });
      return res.status(404).json({ success: false, message: 'Transaction introuvable pour cette référence.' });
    }

    if (transaction.statut === 'validee') {
      // Déjà traité (retry du prestataire) — répondre 200 sans rejouer les effets de bord.
      return res.json({ success: true, data: { statut: transaction.statut, alreadyProcessed: true } });
    }

    if (parsed.montant !== undefined && Math.abs(parsed.montant - Number(transaction.montant)) > AMOUNT_TOLERANCE) {
      await PaymentLog.create({ transactionId: transaction.id, evenement: 'webhook_recu', statut: 'montant_invalide', montant: parsed.montant, provider: req.params.provider, ip: req.ip });
      return res.status(400).json({ success: false, message: 'Montant du webhook incohérent avec la transaction.' });
    }

    await transaction.update({
      statut: parsed.statut,
      dateConfirmation: parsed.statut === 'validee' ? new Date() : null,
    });

    if (parsed.statut === 'validee') {
      const paiement = await Paiement.findOne({ where: { commandeId: transaction.commandeId } });
      if (paiement) await paiement.update({ statut: 'valide', reference: transaction.providerReference });
      await Commande.update({ statut: 'payee' }, { where: { id: transaction.commandeId } });
      await crediterCashback(transaction.commandeId);
      envoyerRecuPaiement(transaction.commandeId).catch((error) => {
        console.error('[EMAIL] Échec envoi reçu de paiement:', error.message);
      });
    }

    await PaymentLog.create({
      transactionId: transaction.id,
      evenement: 'webhook_recu',
      statut: parsed.statut,
      montant: transaction.montant,
      provider: req.params.provider,
      ip: req.ip,
    });

    return res.json({ success: true, data: { statut: parsed.statut } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Statut de paiement d'une commande (pour le polling frontend post-redirection).
router.get('/payments/:orderId/status', authMiddleware, async (req, res) => {
  try {
    const commande = await Commande.findByPk(req.params.orderId);
    if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    if (Number(commande.clientId) !== Number(req.user.id) && !['administrateur', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Accès à cette commande refusé.' });
    }

    const transaction = await Transaction.findOne({
      where: { commandeId: req.params.orderId },
      order: [['createdAt', 'DESC']],
    });

    return res.json({
      success: true,
      data: {
        commandeStatut: commande.statut,
        transaction: transaction
          ? { id: transaction.id, statut: transaction.statut, provider: transaction.provider, dateConfirmation: transaction.dateConfirmation }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
