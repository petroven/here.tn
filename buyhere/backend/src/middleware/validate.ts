import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type Schemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

/**
 * Valide body / query / params avec Zod. Les valeurs parsées (coercées,
 * nettoyées) remplacent les originales ; une erreur Zod part vers errorHandler.
 *
 * Express 5 expose `req.query` en lecture seule : la version parsée est
 * stockée dans `res.locals.query` (voir `getQuery`).
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, res, next) => {
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    if (schemas.query) res.locals.query = schemas.query.parse(req.query);
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  };

/** Récupère la query validée par `validate({ query })`. */
export function getQuery<T>(res: { locals: Record<string, unknown> }): T {
  return res.locals.query as T;
}
