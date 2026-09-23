import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { getLang } from '../utils/lang.js';
import { productCardInclude, toProductCard } from '../services/productView.js';

const router = Router();
router.use(requireAuth);

// GET /favorites — produits favoris (les plus récents d'abord).
router.get('/', async (req, res) => {
  const lang = getLang(req);
  const favorites = await prisma.favorite.findMany({
    where: { userId: currentUser(req).id, product: { isActive: true } },
    include: { product: { include: productCardInclude } },
    orderBy: { createdAt: 'desc' },
  });
  const ids = new Set(favorites.map((f) => f.productId));
  res.json(favorites.map((f) => toProductCard(f.product, lang, ids)));
});

// GET /favorites/ids — liste légère pour synchroniser les cœurs côté app.
router.get('/ids', async (req, res) => {
  const rows = await prisma.favorite.findMany({
    where: { userId: currentUser(req).id },
    select: { productId: true },
  });
  res.json(rows.map((r) => r.productId));
});

// PUT /favorites/:productId — ajout idempotent.
router.put('/:productId', async (req, res) => {
  const userId = currentUser(req).id;
  const productId = req.params.productId as string;
  const exists = await prisma.product.count({ where: { id: productId, isActive: true } });
  if (!exists) throw AppError.notFound('Produit introuvable');

  await prisma.favorite.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId },
    update: {},
  });
  res.status(204).end();
});

// DELETE /favorites/:productId — retrait idempotent.
router.delete('/:productId', async (req, res) => {
  await prisma.favorite.deleteMany({
    where: { userId: currentUser(req).id, productId: req.params.productId as string },
  });
  res.status(204).end();
});

export default router;
