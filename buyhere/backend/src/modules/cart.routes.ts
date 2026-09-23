import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { getLang } from '../utils/lang.js';
import {
  buildCartSummary,
  cartInclude,
  computeCouponDiscount,
  getOrCreateCart,
} from '../services/pricing.js';

const router = Router();
router.use(requireAuth);

const MAX_QTY = 10; // quantité maximale par ligne

const AddItemBody = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().min(1).max(MAX_QTY).default(1),
});

const UpdateItemBody = z.object({ quantity: z.number().int().min(1).max(MAX_QTY) });

const CouponBody = z.object({
  code: z.string().trim().min(2).max(30).transform((c) => c.toUpperCase()),
});

/** Renvoie le panier complet (recalculé) : toutes les routes répondent avec lui. */
async function respondWithCart(req: Parameters<typeof currentUser>[0], res: import('express').Response) {
  const cart = await getOrCreateCart(currentUser(req).id);
  res.json(await buildCartSummary(cart, getLang(req)));
}

// GET /cart
router.get('/', (req, res) => respondWithCart(req, res));

// POST /cart/items — ajoute un produit (ou incrémente la ligne existante).
router.post('/items', validate({ body: AddItemBody }), async (req, res) => {
  const { productId, variantId, quantity } = req.body as z.infer<typeof AddItemBody>;
  const cart = await getOrCreateCart(currentUser(req).id);

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    include: { variants: { select: { id: true, stock: true } } },
  });
  if (!product) throw AppError.notFound('Produit introuvable');

  // Un produit avec variantes exige le choix d'une taille/couleur.
  if (product.variants.length > 0 && !variantId) {
    throw AppError.badRequest('Veuillez choisir une variante (taille / couleur)', 'VARIANT_REQUIRED');
  }
  const variant = variantId ? product.variants.find((v) => v.id === variantId) : null;
  if (variantId && !variant) throw AppError.badRequest('Variante invalide', 'VARIANT_INVALID');

  const existing = cart.items.find(
    (i) => i.productId === productId && (i.variantId ?? null) === (variantId ?? null),
  );
  const newQty = Math.min((existing?.quantity ?? 0) + quantity, MAX_QTY);
  const stock = variant ? variant.stock : product.stock;
  if (newQty > stock) {
    throw AppError.badRequest(`Stock insuffisant (${stock} disponible(s))`, 'OUT_OF_STOCK', { stock });
  }

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId, variantId: variantId ?? null, quantity: newQty },
    });
  }
  res.status(201);
  await respondWithCart(req, res);
});

// PATCH /cart/items/:id — change la quantité d'une ligne.
router.patch('/items/:id', validate({ body: UpdateItemBody }), async (req, res) => {
  const { quantity } = req.body as z.infer<typeof UpdateItemBody>;
  const item = await prisma.cartItem.findFirst({
    where: { id: req.params.id as string, cart: { userId: currentUser(req).id } },
    include: { product: true, variant: true },
  });
  if (!item) throw AppError.notFound('Article introuvable dans le panier');

  const stock = item.variant ? item.variant.stock : item.product.stock;
  if (quantity > stock) {
    throw AppError.badRequest(`Stock insuffisant (${stock} disponible(s))`, 'OUT_OF_STOCK', { stock });
  }
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  await respondWithCart(req, res);
});

// DELETE /cart/items/:id
router.delete('/items/:id', async (req, res) => {
  await prisma.cartItem.deleteMany({
    where: { id: req.params.id as string, cart: { userId: currentUser(req).id } },
  });
  await respondWithCart(req, res);
});

// DELETE /cart — vide le panier.
router.delete('/', async (req, res) => {
  const cart = await getOrCreateCart(currentUser(req).id);
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } }),
  ]);
  await respondWithCart(req, res);
});

// POST /cart/coupon — applique un code promo (vérifié immédiatement).
router.post('/coupon', validate({ body: CouponBody }), async (req, res) => {
  const { code } = req.body as z.infer<typeof CouponBody>;
  const cart = await getOrCreateCart(currentUser(req).id);
  const summary = await buildCartSummary(cart, getLang(req));

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  computeCouponDiscount(coupon, summary.subtotal); // lève une erreur explicite si invalide

  const updated = await prisma.cart.update({
    where: { id: cart.id },
    data: { couponCode: code },
    include: cartInclude,
  });
  res.json(await buildCartSummary(updated, getLang(req)));
});

// DELETE /cart/coupon
router.delete('/coupon', async (req, res) => {
  await prisma.cart.update({ where: { userId: currentUser(req).id }, data: { couponCode: null } });
  await respondWithCart(req, res);
});

export default router;
