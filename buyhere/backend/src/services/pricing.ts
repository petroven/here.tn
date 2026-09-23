import type { Coupon, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { pick, type Lang } from '../utils/lang.js';

export const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
      variant: true,
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** Frais de livraison : gratuits au-delà du seuil configuré. */
export const shippingFeeFor = (subtotal: number) =>
  subtotal === 0 || subtotal >= env.FREE_SHIPPING_THRESHOLD ? 0 : env.SHIPPING_FEE;

/**
 * Vérifie qu'un coupon est utilisable pour un sous-total donné et renvoie la
 * remise en millimes. Lève une AppError explicite sinon.
 */
export function computeCouponDiscount(coupon: Coupon | null, subtotal: number): number {
  const now = new Date();
  if (!coupon || !coupon.isActive) throw AppError.badRequest('Code promo invalide', 'COUPON_INVALID');
  if (coupon.startsAt && coupon.startsAt > now)
    throw AppError.badRequest("Ce code promo n'est pas encore actif", 'COUPON_NOT_STARTED');
  if (coupon.expiresAt && coupon.expiresAt < now)
    throw AppError.badRequest('Ce code promo a expiré', 'COUPON_EXPIRED');
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    throw AppError.badRequest('Ce code promo a atteint sa limite', 'COUPON_EXHAUSTED');
  if (subtotal < coupon.minSubtotal)
    throw AppError.badRequest('Montant minimum non atteint pour ce code', 'COUPON_MIN_SUBTOTAL', {
      minSubtotal: coupon.minSubtotal,
    });

  let discount =
    coupon.type === 'PERCENT' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
  return Math.min(discount, subtotal);
}

/** Récupère (ou crée) le panier de l'utilisateur avec ses lignes. */
export async function getOrCreateCart(userId: string): Promise<CartWithItems> {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: cartInclude,
  });
}

/**
 * Calcule le panier affiché : prix courants, disponibilité, totaux et coupon.
 * Un coupon devenu invalide (expiré, minimum non atteint) est signalé sans
 * bloquer l'affichage du panier.
 */
export async function buildCartSummary(cart: CartWithItems, lang: Lang) {
  const lines = cart.items.map((item) => {
    const unitPrice = item.product.price + (item.variant?.priceDelta ?? 0);
    const available = item.variant ? item.variant.stock : item.product.stock;
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      slug: item.product.slug,
      name: pick(item.product, 'name', lang),
      imageUrl: item.product.images[0]?.url ?? null,
      size: item.variant?.size ?? null,
      color: item.variant?.color ?? null,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      available,
      isAvailable: item.product.isActive && available >= item.quantity,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  let discount = 0;
  let couponError: string | null = null;
  if (cart.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: cart.couponCode } });
    try {
      discount = computeCouponDiscount(coupon, subtotal);
    } catch (err) {
      couponError = err instanceof AppError ? err.message : 'Code promo invalide';
    }
  }

  const shippingFee = shippingFeeFor(subtotal - discount);
  return {
    items: lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    couponCode: cart.couponCode,
    couponError,
    subtotal,
    discount,
    shippingFee,
    freeShippingThreshold: env.FREE_SHIPPING_THRESHOLD,
    total: subtotal - discount + shippingFee,
  };
}
