import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { optionalAuth } from '../middleware/auth.js';
import { getLang, pick } from '../utils/lang.js';
import { productCardInclude, toProductCard } from '../services/productView.js';
import { favoriteIdsFor } from './products.routes.js';

const router = Router();

/**
 * GET /home — toutes les sections de l'accueil en un seul appel
 * (bannières, catégories, offres flash, populaires, nouveautés).
 * Un seul aller-retour réseau = accueil plus rapide sur mobile.
 */
router.get('/', optionalAuth, async (req, res) => {
  const lang = getLang(req);
  const active = { isActive: true };

  const [banners, categories, flash, popular, newest] = await Promise.all([
    prisma.banner.findMany({ where: active, orderBy: { sortOrder: 'asc' } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({
      where: { ...active, flashEndsAt: { gt: new Date() } },
      include: productCardInclude,
      orderBy: { flashEndsAt: 'asc' },
      take: 10,
    }),
    prisma.product.findMany({
      where: { ...active, isFeatured: true },
      include: productCardInclude,
      orderBy: { soldCount: 'desc' },
      take: 10,
    }),
    prisma.product.findMany({
      where: active,
      include: productCardInclude,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const favs = await favoriteIdsFor(req, [...flash, ...popular, ...newest].map((p) => p.id));
  const card = (p: (typeof flash)[number]) => toProductCard(p, lang, favs);

  res.json({
    banners: banners.map((b) => ({
      id: b.id,
      title: pick(b, 'title', lang),
      subtitle: pick(b, 'subtitle', lang) || null,
      imageUrl: b.imageUrl,
      target: b.target,
    })),
    categories: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: pick(c, 'name', lang),
      imageUrl: c.imageUrl,
      icon: c.icon,
    })),
    // Fin de la vente flash la plus proche : alimente le compte à rebours.
    flashEndsAt: flash[0]?.flashEndsAt ?? null,
    flash: flash.map(card),
    popular: popular.map(card),
    newest: newest.map(card),
  });
});

export default router;
