import express from 'express';
import { Notification, PushToken } from '../models/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Notifications de l'utilisateur connecté, les plus récentes d'abord.
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const where = { utilisateurId: req.user.id };
    if (req.query.nonLues === 'true') where.lu = false;

    const { rows, count } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    const nonLues = await Notification.count({ where: { utilisateurId: req.user.id, lu: false } });
    return res.json({ success: true, data: rows, nonLues, pagination: { page, limit, total: count } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/notifications/non-lues', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.count({ where: { utilisateurId: req.user.id, lu: false } });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/notifications/tout-lu', authMiddleware, async (req, res) => {
  try {
    await Notification.update({ lu: true }, { where: { utilisateurId: req.user.id, lu: false } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/notifications/:id/lu', authMiddleware, async (req, res) => {
  try {
    const [affected] = await Notification.update(
      { lu: true },
      { where: { id: req.params.id, utilisateurId: req.user.id } },
    );
    if (!affected) return res.status(404).json({ success: false, message: 'Notification introuvable.' });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Jeton Expo Push de l'appareil courant — enregistré à la connexion par
// l'app mobile (hooks/usePushNotifications.ts), supprimé à la déconnexion.
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

router.put('/users/me/push-token', authMiddleware, async (req, res) => {
  try {
    const { token, plateforme } = req.body;
    if (typeof token !== 'string' || !EXPO_TOKEN_RE.test(token)) {
      return res.status(400).json({ success: false, message: 'Jeton push Expo invalide.' });
    }
    const existant = await PushToken.findOne({ where: { token } });
    if (existant) {
      await existant.update({ utilisateurId: req.user.id, plateforme: plateforme || existant.plateforme });
    } else {
      await PushToken.create({ token, plateforme: plateforme || null, utilisateurId: req.user.id });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/users/me/push-token', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body || {};
    const where = { utilisateurId: req.user.id };
    if (token) where.token = token;
    await PushToken.destroy({ where });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
