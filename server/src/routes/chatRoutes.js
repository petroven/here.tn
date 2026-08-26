import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { Conversation, Message, Utilisateur, Boutique } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// 1. Create or retrieve a conversation
router.post('/chat/conversations', authMiddleware, async (req, res) => {
  try {
    const { vendeurId, sujet } = req.body;
    const clientId = req.user.id;

    if (!vendeurId) {
      return res.status(400).json({ success: false, message: 'ID du vendeur requis.' });
    }

    if (Number(vendeurId) === Number(clientId)) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas démarrer une discussion avec vous-même.' });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      where: { clientId, vendeurId },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        clientId,
        vendeurId,
        sujet: sujet || 'Demande d\'informations',
        dernierMessage: 'Discussion démarrée',
        dateDernierMessage: new Date(),
      });
    }

    // Load with associations
    const detailedConvo = await Conversation.findByPk(conversation.id, {
      include: [
        { model: Utilisateur, as: 'client', attributes: ['id', 'nom', 'prenom', 'email'] },
        { model: Utilisateur, as: 'vendeur', attributes: ['id', 'nom', 'prenom', 'email'], include: [{ model: Boutique, as: 'boutique', attributes: ['id', 'nom', 'logo'] }] },
      ],
    });

    return res.status(200).json({ success: true, data: detailedConvo });
  } catch (error) {
    console.error('[CHAT] Erreur création conversation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get list of conversations for current user
router.get('/chat/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [{ clientId: userId }, { vendeurId: userId }],
      },
      include: [
        { model: Utilisateur, as: 'client', attributes: ['id', 'nom', 'prenom', 'email'] },
        { model: Utilisateur, as: 'vendeur', attributes: ['id', 'nom', 'prenom', 'email'], include: [{ model: Boutique, as: 'boutique', attributes: ['id', 'nom', 'logo'] }] },
      ],
      order: [['dateDernierMessage', 'DESC']],
    });

    return res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('[CHAT] Erreur list convos:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get messages for a conversation
router.get('/chat/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const convoId = req.params.id;
    const userId = req.user.id;

    const conversation = await Conversation.findByPk(convoId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    }

    // Verify access
    if (Number(conversation.clientId) !== Number(userId) && Number(conversation.vendeurId) !== Number(userId)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
    }

    const messages = await Message.findAll({
      where: { conversationId: convoId },
      order: [['dateEnvoi', 'ASC']],
      include: [{ model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'prenom'] }],
    });

    // Mark other user's messages as read
    await Message.update(
      { lu: true },
      {
        where: {
          conversationId: convoId,
          expediteurId: { [Op.ne]: userId },
          lu: false,
        },
      }
    );

    return res.json({ success: true, data: messages });
  } catch (error) {
    console.error('[CHAT] Erreur messages:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Send a message
router.post('/chat/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId, contenu } = req.body;
    const expediteurId = req.user.id;

    if (!conversationId || !contenu) {
      return res.status(400).json({ success: false, message: 'conversationId et contenu requis.' });
    }

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    }

    // Verify sender is part of conversation
    if (Number(conversation.clientId) !== Number(expediteurId) && Number(conversation.vendeurId) !== Number(expediteurId)) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
    }

    const message = await Message.create({
      conversationId,
      expediteurId,
      contenu,
      lu: false,
    });

    // Update conversation summary
    await conversation.update({
      dernierMessage: contenu,
      dateDernierMessage: new Date(),
    });

    const detailedMessage = await Message.findByPk(message.id, {
      include: [{ model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'prenom'] }],
    });

    return res.status(201).json({ success: true, data: detailedMessage });
  } catch (error) {
    console.error('[CHAT] Erreur envoi message:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
