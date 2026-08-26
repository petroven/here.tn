import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Utilisateur, PasswordResetToken } from '../models/index.js';
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
