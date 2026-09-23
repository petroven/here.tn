import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { validate, getQuery } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { PaginationQuery, paginated, type Pagination } from '../utils/pagination.js';

const router = Router();

const ReviewBody = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

/** Recalcule la note moyenne dénormalisée du produit après chaque avis. */
async function refreshProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
  });
}

// GET /reviews/product/:productId — avis paginés + répartition des notes.
router.get(
  '/product/:productId',
  validate({ query: PaginationQuery }),
  async (req, res) => {
    const pg = getQuery<Pagination>(res);
    const productId = req.params.productId as string;
    const where = { productId };

    const [rows, total, distribution] = await prisma.$transaction([
      prisma.review.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (pg.page - 1) * pg.limit,
        take: pg.limit,
      }),
      prisma.review.count({ where }),
      prisma.review.groupBy({ by: ['rating'], where, orderBy: { rating: 'desc' }, _count: { _all: true } }),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      // Nom abrégé pour la confidentialité : « Amira B. »
      author: `${r.user.firstName} ${r.user.lastName.charAt(0)}.`,
      avatarUrl: r.user.avatarUrl,
    }));

    const counts = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, 0])) as Record<number, number>;
    for (const d of distribution) {
      counts[d.rating] = typeof d._count === 'object' && d._count ? (d._count._all ?? 0) : 0;
    }

    res.json({ ...paginated(items, total, pg), distribution: counts });
  },
);

/**
 * POST /reviews — crée ou met à jour l'avis du client.
 * Réservé aux clients ayant reçu le produit (commande livrée).
 */
router.post('/', requireAuth, validate({ body: ReviewBody }), async (req, res) => {
  const userId = currentUser(req).id;
  const { productId, rating, comment } = req.body as z.infer<typeof ReviewBody>;

  const purchased = await prisma.orderItem.findFirst({
    where: { productId, order: { userId, status: 'DELIVERED' } },
    select: { id: true },
  });
  if (!purchased) {
    throw AppError.forbidden('Seuls les clients ayant reçu ce produit peuvent le noter', 'NOT_PURCHASED');
  }

  const review = await prisma.review.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, rating, comment },
    update: { rating, comment },
  });
  await refreshProductRating(productId);
  res.status(201).json(review);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const userId = currentUser(req).id;
  const review = await prisma.review.findFirst({ where: { id: req.params.id as string, userId } });
  if (!review) throw AppError.notFound('Avis introuvable');
  await prisma.review.delete({ where: { id: review.id } });
  await refreshProductRating(review.productId);
  res.status(204).end();
});

export default router;
