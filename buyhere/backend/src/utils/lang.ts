import type { Request } from 'express';

export type Lang = 'fr' | 'ar';

/**
 * Langue de la réponse : `?lang=ar` prioritaire, sinon en-tête Accept-Language,
 * sinon français (langue par défaut de l'app).
 */
export function getLang(req: Request): Lang {
  const q = typeof req.query.lang === 'string' ? req.query.lang : undefined;
  if (q === 'ar' || q === 'fr') return q;
  return req.headers['accept-language']?.toLowerCase().startsWith('ar') ? 'ar' : 'fr';
}

/** Choisit le champ localisé : pick(product, 'name', 'ar') => product.nameAr */
export function pick<T extends Record<string, unknown>>(obj: T, base: string, lang: Lang): string {
  const key = `${base}${lang === 'ar' ? 'Ar' : 'Fr'}`;
  return String(obj[key] ?? obj[`${base}Fr`] ?? '');
}
