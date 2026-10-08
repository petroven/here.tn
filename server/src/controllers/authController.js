import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Op } from 'sequelize';
import {
  Utilisateur, PasswordResetToken, Gouvernorat, Delegation, Commande, Retour, Wishlist, Notification, PushToken, Panier,
} from '../models/index.js';
import { marquerCompteSupprime } from '../utils/comptesSupprimes.js';
import { generateToken } from '../middleware/auth.js';
import { sendEmail, emailResetPassword } from '../utils/email.js';

export async function register(req, res) {
  try {
    const { nom, prenom, email, password, role, telephone, gouvernoratId, delegationId, adresse } = req.body;

    const existing = await Utilisateur.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Un compte existe déjà pour cet email.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await Utilisateur.create({
      nom, prenom, email, password: hash, role, telephone, gouvernoratId, delegationId, adresse,
    });

    return res.status(201).json({
      success: true,
      token: generateToken(user),
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription.' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await Utilisateur.findOne({ where: { email } });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    if (user.provider && user.provider !== 'local') {
      return res.status(409).json({
        success: false,
        message: `Ce compte est lié à ${user.provider === 'google' ? 'Google' : 'Facebook'}. Connectez-vous avec ce moyen.`,
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });

    return res.json({
      success: true,
      token: generateToken(user),
      user: { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur lors de la connexion.' });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const user = await Utilisateur.findOne({ where: { email } });
    if (!user) {
      return res.json({ success: true, message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    await PasswordResetToken.create({ token, expiresAt, utilisateurId: user.id });

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await emailResetPassword(user, resetUrl);

    return res.json({ success: true, message: 'Si cet email existe, un lien de réinitialisation a été envoyé.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    const resetToken = await PasswordResetToken.findOne({
      where: { token, used: false },
      include: [{ model: Utilisateur }],
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Token invalide ou expiré.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await resetToken.Utilisateur.update({ password: hash });
    await resetToken.update({ used: true });

    return res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Espace client (/compte) — profil de l'utilisateur connecté. Le client-side
// ne garde en mémoire que {id, role} après connexion (voir App.jsx), donc la
// page de compte doit recharger le détail elle-même à chaque visite.
export async function getMe(req, res) {
  try {
    const user = await Utilisateur.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Gouvernorat, attributes: ['id', 'nom', 'nomAr'] },
        { model: Delegation, attributes: ['id', 'nom'] },
      ],
    });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateMe(req, res) {
  try {
    const { nom, prenom, telephone, adresse, gouvernoratId, delegationId } = req.body;
    const user = await Utilisateur.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    await user.update({
      ...(nom !== undefined && { nom }),
      ...(prenom !== undefined && { prenom }),
      ...(telephone !== undefined && { telephone: telephone || null }),
      ...(adresse !== undefined && { adresse: adresse || null }),
      ...(gouvernoratId !== undefined && { gouvernoratId: gouvernoratId || null }),
      ...(delegationId !== undefined && { delegationId: delegationId || null }),
    });

    const refreshed = await Utilisateur.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Gouvernorat, attributes: ['id', 'nom', 'nomAr'] },
        { model: Delegation, attributes: ['id', 'nom'] },
      ],
    });
    return res.json({ success: true, data: refreshed, message: 'Profil mis à jour avec succès.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await Utilisateur.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    if (user.provider && user.provider !== 'local') {
      return res.status(409).json({
        success: false,
        message: `Ce compte est lié à ${user.provider === 'google' ? 'Google' : 'Facebook'} : le mot de passe se gère depuis ce fournisseur.`,
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });

    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash });

    return res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// Statuts d'une commande encore « vivante » : on ne peut pas effacer le
// client tant qu'il faut le livrer, l'encaisser ou traiter son retour.
const COMMANDES_EN_COURS = ['en_attente', 'payee', 'preparation', 'expediee', 'en_cours_livraison', 'retour', 'litige'];

/**
 * Suppression du compte par son titulaire (exigée par Google Play et l'App
 * Store). Les commandes et factures sont conservées (obligations
 * comptables) mais anonymisées : nom, email, téléphone, adresse et photo
 * sont effacés ; favoris, panier, notifications et appareils aussi. Les
 * sessions ouvertes sont immédiatement refusées. Comptes vendeur, livreur et
 * admin : fermeture via le support (boutique, soldes et courses à solder).
 */
export async function deleteMe(req, res) {
  try {
    const user = await Utilisateur.findByPk(req.user.id);
    if (!user || user.compteSupprime) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });

    if (user.role !== 'client') {
      return res.status(409).json({
        success: false,
        message: 'Les comptes vendeur, livreur et administrateur se ferment via le support (boutique, soldes ou courses à solder).',
      });
    }

    // Compte classique : le mot de passe confirme que c'est bien son titulaire.
    if (!user.provider || user.provider === 'local') {
      const valid = req.body.password && await bcrypt.compare(req.body.password, user.password);
      if (!valid) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
    } else if (req.body.confirmation !== 'SUPPRIMER') {
      return res.status(400).json({ success: false, message: 'Tapez SUPPRIMER pour confirmer la suppression.' });
    }

    const enCours = await Commande.count({ where: { clientId: user.id, statut: { [Op.in]: COMMANDES_EN_COURS } } });
    const retoursOuverts = await Retour.count({ where: { clientId: user.id, statut: { [Op.in]: ['demande', 'approuve', 'litige'] } } });
    if (enCours > 0 || retoursOuverts > 0) {
      return res.status(409).json({
        success: false,
        message: 'Vous avez des commandes ou des retours en cours : attendez leur fin (ou annulez-les) avant de supprimer votre compte.',
      });
    }
    if (Number(user.soldeWallet || 0) > 0.0005) {
      return res.status(409).json({
        success: false,
        message: `Il reste ${Number(user.soldeWallet).toFixed(3)} DT sur votre solde : utilisez-le avant de supprimer votre compte, ou contactez le support.`,
      });
    }

    const transaction = await Utilisateur.sequelize.transaction();
    try {
      const where = { utilisateurId: user.id };
      await Promise.all([
        Wishlist.destroy({ where, transaction }),
        Notification.destroy({ where, transaction }),
        PushToken.destroy({ where, transaction }),
        Panier.destroy({ where, transaction }),
        PasswordResetToken.destroy({ where, transaction }).catch(() => undefined),
      ]);
      await user.update({
        nom: 'supprimé',
        prenom: 'Compte',
        email: `supprime-${user.id}-${Date.now()}@comptes-supprimes.invalid`,
        telephone: null,
        adresse: null,
        photo: null,
        gouvernoratId: null,
        delegationId: null,
        provider: 'local',
        providerId: null,
        // Hash d'un secret aléatoire jamais conservé : plus aucune connexion possible.
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        compteSupprime: true,
      }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    marquerCompteSupprime(user.id);
    return res.json({ success: true, message: 'Votre compte a été supprimé.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
