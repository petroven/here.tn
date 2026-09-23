import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_marketplace_secret';

export const generateToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token manquant ou invalide.' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expirée.' });
  }
};

// Comme authMiddleware, mais ne bloque jamais la requête — utilisé sur les
// routes accessibles aux invités (ex: passer commande sans compte) qui ont
// simplement besoin de savoir SI un client est connecté, sans l'exiger. Un
// jeton absent ou invalide laisse req.user undefined plutôt que de renvoyer
// une 401 ; c'est au contrôleur de traiter ce cas comme un invité.
export const optionalAuthMiddleware = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    } catch {
      // jeton expiré/invalide — on continue en tant qu'invité plutôt que
      // de bloquer une commande pour une session périmée côté client.
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
