import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { getLang, pick } from '../utils/lang.js';

const router = Router();

// GET /categories — toutes les catégories avec le nombre de produits actifs.
router.get('/', async (req, res) => {
  const lang = getLang(req);
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });

  res.json(
    categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: pick(c, 'name', lang),
      imageUrl: c.imageUrl,
      icon: c.icon,
      productCount: c._count.products,
    })),
  );
});

export default router;
