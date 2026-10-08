import express from 'express';
import { Op } from 'sequelize';
import { Commande, Paiement, Transaction, PaymentLog, Utilisateur } from '../models/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { verifyPaymentSignature } from '../middleware/verifyPaymentSignature.js';
import { getProvider } from '../services/payments/index.js';
import { SANDBOX_SCENARIOS, isSandbox } from '../services/payments/SandboxMockProvider.js';
import { crediterCashback } from '../utils/wallet.js';
import { envoyerRecuPaiement } from '../utils/email.js';
import { synchroniserStatutCommande } from '../utils/orderStatus.js';
import { notifier } from '../utils/notifications.js';

const router = express.Router();

const AMOUNT_TOLERANCE = 0.001; // TND — floating point rounding slack only

// Délai au-delà duquel une transaction restée sans webhook est considérée
// comme expirée (le client a fermé la page du prestataire, réseau coupé…).
// Vérifié paresseusement à la lecture du statut, comme les retours/livreurs.
function delaiExpirationMs() {
  const minutes = Number(process.env.PAYMENT_TIMEOUT_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;
}

async function expirerSiTropAncienne(transaction, ip) {
  if (!['initiee', 'en_attente'].includes(transaction.statut)) return transaction;
  if (Date.now() - new Date(transaction.createdAt).getTime() < delaiExpirationMs()) return transaction;
  const [affected] = await Transaction.update(
    { statut: 'echec' },
    { where: { id: transaction.id, statut: { [Op.in]: ['initiee', 'en_attente'] } } },
  );
  if (affected) {
    await PaymentLog.create({ transactionId: transaction.id, evenement: 'timeout', statut: 'echec', montant: transaction.montant, provider: transaction.provider, message: 'Aucun webhook reçu dans le délai', ip });
    transaction.statut = 'echec';
  }
  return transaction;
}

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
    if (commande.statut !== 'en_attente') {
      return res.status(409).json({
        success: false,
        message: commande.statut === 'payee' ? 'Cette commande est déjà payée.' : 'Cette commande ne peut plus être payée.',
      });
    }

    const provider = getProvider(providerName);

    // Idempotence : la même intention est rejouée au lieu d'être recréée
    // (double clic, réseau instable) — on ne débite jamais deux fois. Une
    // tentative échouée/annulée/expirée, elle, ne bloque pas un nouvel essai
    // quand le client n'a pas fourni sa propre clé.
    const rejouer = (t) => res.json({
      success: true,
      data: { transactionId: t.id, providerReference: t.providerReference, statut: t.statut, replay: true },
    });

    const cleClient = req.headers['idempotency-key'];
    let idempotencyKey = cleClient;
    if (cleClient) {
      // Clé fournie par le client : rejeu strict, quel que soit le statut.
      const existing = await Transaction.findOne({ where: { idempotencyKey: cleClient } });
      if (existing) return rejouer(existing);
    } else {
      // Sans clé : la dernière tentative encore vivante est rejouée ; une
      // tentative échouée, annulée ou expirée permet d'en ouvrir une nouvelle.
      const derniere = await Transaction.findOne({
        where: { commandeId, provider: providerName, utilisateurId: req.user.id },
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
      });
      if (derniere) {
        await expirerSiTropAncienne(derniere, req.ip);
        if (!['echec', 'annulee'].includes(derniere.statut)) return rejouer(derniere);
      }
      const tentatives = await Transaction.count({ where: { commandeId, provider: providerName, utilisateurId: req.user.id } });
      idempotencyKey = `${commandeId}:${providerName}:${req.user.id}${tentatives ? `:tentative-${tentatives + 1}` : ''}`;
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
      await PaymentLog.create({ transactionId: transaction.id, evenement: 'webhook_doublon', statut: 'ignore', montant: parsed.montant, provider: req.params.provider, ip: req.ip });
      return res.json({ success: true, data: { statut: transaction.statut, alreadyProcessed: true } });
    }

    if (parsed.montant !== undefined && Math.abs(parsed.montant - Number(transaction.montant)) > AMOUNT_TOLERANCE) {
      await PaymentLog.create({ transactionId: transaction.id, evenement: 'webhook_recu', statut: 'montant_invalide', montant: parsed.montant, provider: req.params.provider, ip: req.ip });
      return res.status(400).json({ success: false, message: 'Montant du webhook incohérent avec la transaction.' });
    }

    if (parsed.statut === 'validee') {
      // Validation atomique : si deux webhooks identiques arrivent en même
      // temps, un seul passe cette condition et applique les effets de bord.
      // Un webhook « validée » arrivant après expiration (TIMEOUT) est
      // accepté : l'argent a bien été prélevé chez le prestataire.
      const [affected] = await Transaction.update(
        { statut: 'validee', dateConfirmation: new Date() },
        { where: { id: transaction.id, statut: { [Op.ne]: 'validee' } } },
      );
      if (!affected) {
        return res.json({ success: true, data: { statut: 'validee', alreadyProcessed: true } });
      }

      const paiement = await Paiement.findOne({ where: { commandeId: transaction.commandeId } });
      if (paiement) await paiement.update({ statut: 'valide', reference: transaction.providerReference });
      const commande = await synchroniserStatutCommande(transaction.commandeId, 'payee', {
        commentaire: `Paiement confirmé par ${req.params.provider}`,
      });
      if (!commande) {
        // Commande déjà annulée entre-temps : paiement encaissé sur une
        // commande morte — à rembourser manuellement, on le trace.
        await PaymentLog.create({ transactionId: transaction.id, evenement: 'paiement_sur_commande_close', statut: 'a_rembourser', montant: transaction.montant, provider: req.params.provider, ip: req.ip });
      }
      await crediterCashback(transaction.commandeId);
      envoyerRecuPaiement(transaction.commandeId).catch((error) => {
        console.error('[EMAIL] Échec envoi reçu de paiement:', error.message);
      });
    } else {
      await transaction.update({ statut: parsed.statut, dateConfirmation: null });
      const paiement = await Paiement.findOne({ where: { commandeId: transaction.commandeId } });
      if (paiement && paiement.statut !== 'valide') await paiement.update({ statut: 'echec' });
      notifier(transaction.utilisateurId, {
        type: parsed.statut === 'annulee' ? 'paiement_annule' : 'paiement_echoue',
        titre: parsed.statut === 'annulee' ? 'Paiement annulé' : 'Paiement refusé',
        message: 'Votre paiement n\'a pas abouti. Vous pouvez réessayer depuis vos commandes.',
        lien: `commande/${transaction.commandeId}`,
        data: { commandeId: transaction.commandeId },
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

// Simulateur de prestataire (sandbox uniquement, jamais en production) :
// joue un scénario complet sur la dernière transaction de la commande en
// envoyant au webhook de CE serveur ce qu'enverrait Konnect/Flouci.
router.post('/payments/sandbox/simulate', authMiddleware, async (req, res) => {
  try {
    if (!isSandbox()) return res.status(404).json({ success: false, message: 'Introuvable.' });
    const { commandeId, scenario = 'SUCCESS', delayMs } = req.body;
    if (!SANDBOX_SCENARIOS.includes(scenario)) {
      return res.status(400).json({ success: false, message: `Scénario inconnu. Valeurs : ${SANDBOX_SCENARIOS.join(', ')}.` });
    }

    const transaction = await Transaction.findOne({
      where: { commandeId, provider: 'sandbox' },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    if (!transaction) return res.status(404).json({ success: false, message: 'Aucune transaction sandbox pour cette commande.' });
    if (Number(transaction.utilisateurId) !== Number(req.user.id) && !['administrateur', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Accès à cette transaction refusé.' });
    }

    const provider = getProvider('sandbox');
    const webhooks = provider.construireWebhooks(scenario, {
      providerReference: transaction.providerReference,
      montant: transaction.montant,
      delayMs: Math.min(Math.max(Number(delayMs) || 1500, 0), 60000),
    });

    const url = `${req.protocol}://${req.get('host')}/api/payments/webhook/sandbox`;
    const envoyer = (webhook) => fetch(url, { method: 'POST', headers: webhook.headers, body: webhook.rawBody })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

    const reponses = [];
    for (const webhook of webhooks) {
      if (webhook.delayMs > 0) {
        setTimeout(() => envoyer(webhook).catch((e) => console.error('[SANDBOX] Webhook différé en échec:', e.message)), webhook.delayMs);
        reponses.push({ differeMs: webhook.delayMs });
      } else {
        reponses.push(await envoyer(webhook));
      }
    }
    return res.status(webhooks.some((w) => w.delayMs > 0) ? 202 : 200).json({
      success: true,
      data: { scenario, transactionId: transaction.id, webhooks: reponses },
    });
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
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    if (transaction) await expirerSiTropAncienne(transaction, req.ip);

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
