import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { optionalAuth } from '../middleware/auth.js';
import { validate, getQuery } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { getLang } from '../utils/lang.js';
import { PaginationQuery, paginated } from '../utils/pagination.js';
import {
  productCardInclude,
  productDetailInclude,
  toProductCard,
  toProductDetail,
} from '../services/productView.js';

const router = Router();
router.use(optionalAuth); // pour renseigner `isFavorite` si connecté

const SORTS = {
  newest: { createdAt: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  rating: { ratingAvg: 'desc' },
  popular: { soldCount: 'desc' },
} satisfies Record<string, Prisma.ProductOrderByWithRelationInput>;

/** Filtres de /products (tous facultatifs, prix en millimes). */
const ListQuery = PaginationQuery.extend({
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(), // slug
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  onSale: z.stringbool().optional(),
  flash: z.stringbool().optional(),
  featured: z.stringbool().optional(),
  inStock: z.stringbool().optional(),
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...(keyof typeof SORTS)[]]).default('newest'),
  lang: z.enum(['fr', 'ar']).optional(),
});
type ListQuery = z.infer<typeof ListQuery>;

/** Ids des produits favoris de l'utilisateur connecté (pour marquer les cœurs). */
export async function favoriteIdsFor(req: Request, productIds: string[]) {
  if (!req.user || productIds.length === 0) return new Set<string>();
  const favs = await prisma.favorite.findMany({
    where: { userId: req.user.id, productId: { in: productIds } },
    select: { productId: true },
  });
  return new Set(favs.map((f) => f.productId));
}

function buildWhere(q: ListQuery): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { isActive: true };
  const and: Prisma.ProductWhereInput[] = [];

  if (q.q) {
    // Recherche insensible à la casse (collation MySQL par défaut) sur FR, AR et marque.
    and.push({
      OR: [
        { nameFr: { contains: q.q } },
        { nameAr: { contains: q.q } },
        { brand: { contains: q.q } },
        { descriptionFr: { contains: q.q } },
      ],
    });
  }
  if (q.category) where.category = { slug: q.category };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    where.price = { gte: q.minPrice, lte: q.maxPrice };
  }
  if (q.minRating) where.ratingAvg = { gte: q.minRating };
  if (q.onSale) and.push({ compareAt: { not: null } });
  if (q.flash) where.flashEndsAt = { gt: new Date() };
  if (q.featured) where.isFeatured = true;
  if (q.inStock) where.stock = { gt: 0 };

  if (and.length) where.AND = and;
  return where;
}

// GET /products — liste paginée avec recherche, filtres et tri.
router.get('/', validate({ query: ListQuery }), async (req, res) => {
  const q = getQuery<ListQuery>(res);
  const lang = getLang(req);
  const where = buildWhere(q);

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: productCardInclude,
      orderBy: [SORTS[q.sort], { id: 'asc' }], // id : ordre stable pour la pagination
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.product.count({ where }),
  ]);

  const favs = await favoriteIdsFor(req, rows.map((r) => r.id));
  res.json(paginated(rows.map((r) => toProductCard(r, lang, favs)), total, q));
});

// GET /products/suggestions?q= — auto-complétion de la barre de recherche.
router.get(
  '/suggestions',
  validate({ query: z.object({ q: z.string().trim().min(1).max(100) }) }),
  async (req, res) => {
    const { q } = getQuery<{ q: string }>(res);
    const lang = getLang(req);
    const rows = await prisma.product.findMany({
      where: { isActive: true, OR: [{ nameFr: { contains: q } }, { nameAr: { contains: q } }] },
      select: { slug: true, nameFr: true, nameAr: true },
      orderBy: { soldCount: 'desc' },
      take: 8,
    });
    res.json(rows.map((r) => ({ slug: r.slug, name: lang === 'ar' ? r.nameAr : r.nameFr })));
  },
);

// GET /products/:idOrSlug — détail + produits similaires.
router.get('/:idOrSlug', async (req, res) => {
  const lang = getLang(req);
  const key = req.params.idOrSlug;
  const product = await prisma.product.findFirst({
    where: { isActive: true, OR: [{ id: key }, { slug: key }] },
    include: productDetailInclude,
  });
  if (!product) throw AppError.notFound('Produit introuvable');

  const similarRows = await prisma.product.findMany({
    where: { isActive: true, categoryId: product.categoryId, id: { not: product.id } },
    include: productCardInclude,
    orderBy: { soldCount: 'desc' },
    take: 8,
  });

  const favs = await favoriteIdsFor(req, [product.id, ...similarRows.map((r) => r.id)]);
  res.json({
    ...toProductDetail(product, lang, favs.has(product.id)),
    similar: similarRows.map((r) => toProductCard(r, lang, favs)),
  });
});

export default router;
