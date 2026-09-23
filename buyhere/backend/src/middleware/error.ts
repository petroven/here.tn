import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { isProd } from '../config/env.js';

/** 404 pour toute route non déclarée. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route introuvable : ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
};

/**
 * Gestion centralisée des erreurs. Format de réponse unique :
 *   { error: { code, message, details? } }
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 : violation de contrainte d'unicité
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'DUPLICATE', message: 'Cette valeur existe déjà', details: err.meta },
      });
      return;
    }
    // P2025 : enregistrement introuvable (update/delete)
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable' } });
      return;
    }
  }

  // JSON mal formé envoyé par le client
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Corps JSON invalide' } });
    return;
  }

  console.error('[ERROR]', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue',
      ...(isProd ? {} : { details: String(err?.stack ?? err) }),
    },
  });
};
