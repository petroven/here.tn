import jwt from 'jsonwebtoken';
import { estCompteSupprime } from '../utils/comptesSupprimes.js';

// En production, un secret manquant, trop court ou recopié depuis
// .env.example rendrait les jetons falsifiables (ces valeurs sont publiques
// dans ce dépôt) : on refuse de démarrer.
const PUBLIC_SECRET_PATTERN = /^change[_-]?me|^dev_marketplace_secret$|^test_secret_ci_only$/i;
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET doit être défini (32 caractères minimum) en production.');
  }
  if (PUBLIC_SECRET_PATTERN.test(secret)) {
    throw new Error('JWT_SECRET est une valeur d\'exemple publique : générez un secret aléatoire pour la production.');
  }
}
export const JWT_SECRET = process.env.JWT_SECRET || 'dev_marketplace_secret';

export const generateToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

/**
 * Vérifie le jeton ET l'état actuel du compte en base : un jeton dont la
 * version (`tv`) est dépassée est révoqué (mot de passe changé, « déconnecter
 * tous les appareils »), et le rôle utilisé est celui de la base, pas celui
 * figé dans le jeton (un rôle retiré ne survit pas 7 jours). Les jetons émis
 * avant l'ajout de `tv` valent version 0 : personne n'est déconnecté au
 * déploiement. Renvoie l'utilisateur de la requête, ou null.
 */
export async function verifierJeton(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (estCompteSupprime(decoded.id)) return null;
  // Import différé : models/index.js charge la base, que ce module ne doit pas
  // imposer à ses autres importeurs (ex. contrôle de JWT_SECRET au démarrage).
  const { Utilisateur } = await import('../models/index.js');
  const user = await Utilisateur.findByPk(decoded.id, { attributes: ['id', 'role', 'tokenVersion'] });
  if (!user || (decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) return null;
  return { ...decoded, role: user.role };
}

export const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token manquant ou invalide.' });
  }

  try {
    const user = await verifierJeton(header.split(' ')[1]);
    if (!user) return res.status(401).json({ success: false, message: 'Session expirée.' });
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

// Comme authMiddleware, mais ne bloque jamais la requête — utilisé sur les
// routes accessibles aux invités (ex: passer commande sans compte) qui ont
// simplement besoin de savoir SI un client est connecté, sans l'exiger. Un
// jeton absent ou invalide laisse req.user undefined plutôt que de renvoyer
// une 401 ; c'est au contrôleur de traiter ce cas comme un invité.
export const optionalAuthMiddleware = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      // Jeton expiré, révoqué ou invalide : on continue en tant qu'invité
      // plutôt que de bloquer une commande pour une session périmée.
      const user = await verifierJeton(header.split(' ')[1]);
      if (user) req.user = user;
    } catch (error) {
      return next(error);
    }
  }
  return next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Accès réservé à ce rôle.' });
  }
  return next();
};

export const requireSuperAdmin = (req, res, next) => requireRole('administrateur', 'super_admin')(req, res, next);
