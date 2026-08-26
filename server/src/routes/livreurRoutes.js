import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { Utilisateur, Livreur, Livraison, Commande, Boutique, Paiement, NotificationLivreur } from '../models/index.js';
import { authMiddleware, requireRole, generateToken } from '../middleware/auth.js';
import { uploadImage } from '../utils/upload.js';
import { smsStatutLivraison } from '../utils/sms.js';
import { calculateDistanceKm } from '../utils/geo.js';
import { assignCourseToLivreur } from '../utils/courseAssignment.js';
import { isEffectivelyExpired, refuseNotification, cancelPendingNotificationsForLivraison } from '../utils/courierMatching.js';
import { crediterCashback } from '../utils/wallet.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' });
const livreurOnly = requireRole('livreur');

async function getLivreurProfile(req) {
  const [profil] = await Livreur.findOrCreate({
    where: { utilisateurId: req.user.id },
    defaults: { utilisateurId: req.user.id },
  });
  return profil;
}

const commandeIncludes = [
  { model: Utilisateur, as: 'client', attributes: ['id', 'nom', 'prenom', 'telephone'] },
  { model: Boutique, as: 'boutique', attributes: ['id', 'nom', 'adresse'] },
];

// Inscription publique pour devenir livreur
router.post('/livreur/register', async (req, res) => {
  try {
    const { nom, prenom, email, password, telephone, vehiculeType } = req.body;

    if (!nom || !prenom || !email || !password || !telephone) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants.' });
    }

    const existing = await Utilisateur.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Un compte existe déjà pour cet email.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await Utilisateur.create({ nom, prenom, email, password: hash, telephone, role: 'livreur' });

    const profil = await Livreur.create({
      utilisateurId: user.id,
      vehiculeType: vehiculeType || 'moto',
      statut: 'hors_ligne',
    });

    return res.status(201).json({
      success: true,
      token: generateToken(user),
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role },
      profil,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Connexion dédiée aux comptes livreur
router.post('/livreur/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Utilisateur.findOne({ where: { email } });
    if (!user || user.role !== 'livreur') {
      return res.status(404).json({ success: false, message: 'Aucun compte livreur ne correspond à ces identifiants.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });

    const profil = await Livreur.findOrCreate({
      where: { utilisateurId: user.id },
      defaults: { utilisateurId: user.id },
    });

    return res.json({
      success: true,
      token: generateToken(user),
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role },
      profil: profil[0],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Changer sa disponibilité
router.patch('/livreur/statut', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const { statut } = req.body;
    if (!['disponible', 'occupe', 'hors_ligne'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    const profil = await getLivreurProfile(req);
    await profil.update({ statut });
    return res.json({ success: true, data: profil });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Mise à jour de la position GPS (appelée périodiquement par l'app livreur)
router.patch('/livreur/position', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ success: false, message: 'Coordonnées invalides.' });
    }
    const profil = await getLivreurProfile(req);
    await profil.update({ latitude, longitude, dernierePositionMaj: new Date() });
    return res.json({ success: true, data: profil });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Courses disponibles + courses en cours pour le livreur connecté
router.get('/livreur/courses', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);

    const disponibles = await Livraison.findAll({
      where: { statutAssignation: 'en_attente', livreurId: null },
      include: [{
        model: Commande,
        where: { confirmationStatut: { [Op.ne]: 'en_attente' } },
        include: commandeIncludes,
      }],
      order: [['createdAt', 'ASC']],
      limit: 50,
    });

    const enCours = await Livraison.findAll({
      where: { livreurId: profil.id, statutAssignation: { [Op.in]: ['assignee', 'en_cours'] } },
      include: [{ model: Commande, include: commandeIncludes }],
      order: [['dateAssignation', 'ASC']],
    });

    const withDistance = (list) => list.map((livraison) => {
      const json = livraison.toJSON();
      json.distanceEstimeeKm = calculateDistanceKm(profil.latitude, profil.longitude, json.latitudeArrivee, json.longitudeArrivee);
      return json;
    });

    return res.json({ success: true, data: { disponibles: withDistance(disponibles), enCours: withDistance(enCours) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Accepter une course disponible
router.patch('/livreur/courses/:id/accepter', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);

    const { success } = await assignCourseToLivreur(req.params.id, profil.id);
    if (!success) {
      return res.status(409).json({ success: false, message: 'Cette course vient d\'être prise par un autre livreur.' });
    }

    const livraison = await Livraison.findByPk(req.params.id, {
      include: [{ model: Commande, include: commandeIncludes }],
    });
    return res.json({ success: true, data: livraison });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Mettre à jour le statut d'une course assignée (récupéré / livré / échec)
router.patch('/livreur/courses/:id/statut', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const { statut } = req.body;
    if (!['en_cours', 'livree', 'echec'].includes(statut)) {
      return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }

    const profil = await getLivreurProfile(req);
    const livraison = await Livraison.findOne({
      where: { id: req.params.id, livreurId: profil.id },
      include: [{ model: Commande, include: [{ model: Utilisateur, as: 'client' }, { model: Paiement, as: 'paiement' }] }],
    });
    if (!livraison) return res.status(404).json({ success: false, message: 'Course introuvable ou non assignée à ce livreur.' });

    const updates = { statutAssignation: statut };

    if (statut === 'en_cours' && ['en_preparation', 'expedie'].includes(livraison.statut)) {
      updates.statut = 'en_cours_livraison';
      updates.historiqueStatuts = [...(livraison.historiqueStatuts || []), { statut: 'en_cours_livraison', date: new Date().toISOString() }];
    }

    if (statut === 'livree') {
      updates.statut = 'livre';
      updates.dateLivraison = new Date();
      updates.historiqueStatuts = [...(livraison.historiqueStatuts || []), { statut: 'livre', date: new Date().toISOString() }];

      await Commande.update({ statut: 'livree' }, { where: { id: livraison.commandeId } });
      const paiement = livraison.Commande?.paiement;
      if (paiement?.methode === 'cod' && paiement.statut === 'en_attente_livraison') {
        await paiement.update({ statut: 'paye_livraison' });
        await Commande.update({ statut: 'payee' }, { where: { id: livraison.commandeId } });
        await crediterCashback(livraison.commandeId);
      }

      await profil.update({ statut: 'disponible', nombreLivraisons: profil.nombreLivraisons + 1 });

      const client = livraison.Commande?.client;
      if (client?.telephone) await smsStatutLivraison(client.telephone, livraison.trackingId, 'livre');
    }

    if (statut === 'echec') {
      // Remet la course dans le pool pour une nouvelle tentative par un autre livreur
      updates.livreurId = null;
      updates.statutAssignation = 'en_attente';
      await profil.update({ statut: 'disponible' });
    }

    await livraison.update(updates);
    return res.json({ success: true, data: livraison });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Preuve de livraison (photo ou signature)
router.post('/livreur/courses/:id/preuve', authMiddleware, livreurOnly, upload.single('preuve'), async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);
    const livraison = await Livraison.findOne({ where: { id: req.params.id, livreurId: profil.id } });
    if (!livraison) return res.status(404).json({ success: false, message: 'Course introuvable ou non assignée à ce livreur.' });

    let preuveUrl = null;
    if (req.file) {
      preuveUrl = await uploadImage(req.file);
    } else if (req.body.signature) {
      preuveUrl = req.body.signature;
    } else {
      return res.status(400).json({ success: false, message: 'Aucune preuve fournie (photo ou signature).' });
    }

    await livraison.update({ preuveLivraison: preuveUrl });
    return res.status(201).json({ success: true, data: livraison });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Historique des courses + gains
router.get('/livreur/historique', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);
    const courses = await Livraison.findAll({
      where: { livreurId: profil.id, statutAssignation: { [Op.in]: ['livree', 'echec'] } },
      include: [{ model: Commande, include: commandeIncludes }],
      order: [['updatedAt', 'DESC']],
      limit: 100,
    });

    const gains = courses
      .filter((c) => c.statutAssignation === 'livree')
      .reduce((sum, c) => sum + Number(c.fraisLivraison || 0), 0);

    return res.json({ success: true, data: { courses, gains } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Statistiques du livreur connecté
router.get('/livreur/stats', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);
    const now = new Date();
    const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const debutSemaine = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const livrees = await Livraison.findAll({
      where: { livreurId: profil.id, statutAssignation: 'livree' },
      attributes: ['fraisLivraison', 'dateLivraison'],
    });

    const gainsJour = livrees
      .filter((c) => c.dateLivraison && new Date(c.dateLivraison) >= debutJour)
      .reduce((sum, c) => sum + Number(c.fraisLivraison || 0), 0);
    const gainsSemaine = livrees
      .filter((c) => c.dateLivraison && new Date(c.dateLivraison) >= debutSemaine)
      .reduce((sum, c) => sum + Number(c.fraisLivraison || 0), 0);

    return res.json({
      success: true,
      data: {
        statut: profil.statut,
        nombreLivraisons: profil.nombreLivraisons,
        noteMoyenne: profil.noteMoyenne,
        gainsJour,
        gainsSemaine,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Accepter une notification de course poussée en temps réel
router.patch('/livreur/notifications/:id/accepter', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);
    const notification = await NotificationLivreur.findOne({ where: { id: req.params.id, livreurId: profil.id } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification introuvable.' });

    if (isEffectivelyExpired(notification)) {
      await notification.update({ statut: 'expiree' });
      return res.status(409).json({ success: false, message: 'Cette notification a expiré.' });
    }
    if (notification.statut !== 'envoyee') {
      return res.status(409).json({ success: false, message: 'Cette notification a déjà été traitée.' });
    }

    const { success } = await assignCourseToLivreur(notification.livraisonId, profil.id);
    if (!success) {
      await notification.update({ statut: 'expiree' });
      return res.status(409).json({ success: false, message: 'Cette course vient d\'être prise par un autre livreur.' });
    }

    await notification.update({ statut: 'acceptee', dateReponse: new Date() });
    await cancelPendingNotificationsForLivraison(notification.livraisonId, notification.id);

    const livraison = await Livraison.findByPk(notification.livraisonId, {
      include: [{ model: Commande, include: commandeIncludes }],
    });
    return res.json({ success: true, data: livraison });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Refuser une notification de course (avance immédiatement le cascade vers le livreur suivant)
router.patch('/livreur/notifications/:id/refuser', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);
    const result = await refuseNotification(req.params.id, profil.id);
    if (!result.success) return res.status(409).json({ success: false, message: result.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Notification en attente pour ce livreur (réconciliation à la reconnexion socket)
router.get('/livreur/notifications/pending', authMiddleware, livreurOnly, async (req, res) => {
  try {
    const profil = await getLivreurProfile(req);
    const notification = await NotificationLivreur.findOne({
      where: { livreurId: profil.id, statut: 'envoyee' },
      order: [['dateEnvoi', 'DESC']],
      include: [{ model: Livraison, include: [{ model: Commande, include: [{ model: Boutique, as: 'boutique' }] }] }],
    });

    if (!notification) return res.json({ success: true, data: null });

    if (isEffectivelyExpired(notification)) {
      await notification.update({ statut: 'expiree' });
      return res.json({ success: true, data: null });
    }

    return res.json({
      success: true,
      data: {
        notificationId: notification.id,
        livraisonId: notification.livraisonId,
        trackingId: notification.Livraison?.trackingId,
        distanceKm: notification.distanceKm,
        adresseDepart: notification.Livraison?.Commande?.boutique?.adresse || null,
        adresseArrivee: notification.Livraison?.Commande?.adresseLivraison || null,
        fraisLivraison: notification.Livraison?.fraisLivraison,
        expiresAt: notification.dateExpiration,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
