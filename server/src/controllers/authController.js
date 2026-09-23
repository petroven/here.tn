import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Utilisateur, PasswordResetToken, Gouvernorat, Delegation } from '../models/index.js';
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
