import type { Request, RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../lib/tokens.js';
import { AppError } from '../utils/AppError.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Exige un access token valide ; renseigne `req.user`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readBearer(req);
  if (!token) return next(AppError.unauthorized());
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    const expired = err instanceof Error && err.name === 'TokenExpiredError';
    // Le code TOKEN_EXPIRED déclenche le refresh automatique côté app.
    next(
      AppError.unauthorized(
        expired ? 'Session expirée' : 'Jeton invalide',
        expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      ),
    );
  }
};

/** Authentification facultative : `req.user` renseigné si un jeton valide est fourni. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readBearer(req);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // jeton invalide ignoré : la route reste publique
    }
  }
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden());
    next();
  };

/** Raccourci typé : l'utilisateur authentifié (à utiliser après requireAuth). */
export function currentUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
