import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, currentUser } from '../middleware/auth.js';
import { validate, getQuery } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { getLang, pick } from '../utils/lang.js';
import { PaginationQuery, paginated } from '../utils/pagination.js';
import { computeCouponDiscount, getOrCreateCart, shippingFeeFor } from '../services/pricing.js';
import { notifyOrderStatus } from '../services/notify.js';
import { initFlouciPayment, initKonnectPayment, type PaymentInit } from '../services/payments.js';

const router = Router();
router.use(requireAuth);

const CreateOrderBody = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'KONNECT', 'FLOUCI']).default('CASH_ON_DELIVERY'),
  note: z.string().trim().max(500).optional(),
});

const ListOrdersQuery = PaginationQuery.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
});

/** Transitions de statut autorisées (côté admin). */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Numéro lisible : BH-20260923-4F7K */
function orderNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `BH-${d}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

const orderInclude = {
  items: true,
  history: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toOrderDto(o: OrderRow) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shippingFee,
    total: o.total,
    couponCode: o.couponCode,
    note: o.note,
    shippingAddress: {
      fullName: o.shippingName,
      phone: o.shippingPhone,
      governorate: o.shippingGov,
      city: o.shippingCity,
      street: o.shippingStreet,
    },
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      name: i.name,
      imageUrl: i.imageUrl,
      size: i.size,
      color: i.color,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
    })),
    itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    history: o.history.map((h) => ({ status: h.status, note: h.note, at: h.createdAt })),
    createdAt: o.createdAt,
  };
}

/**
 * POST /orders — transforme le panier en commande.
 *
 * Tout se passe dans une transaction : vérification et décrément atomique du
 * stock (UPDATE ... WHERE stock >= qty), coupon, création de la commande et
 * vidage du panier. Deux clients ne peuvent pas acheter le dernier article.
 */
router.post('/', validate({ body: CreateOrderBody }), async (req, res) => {
  const user = currentUser(req);
  const lang = getLang(req);
  const body = req.body as z.infer<typeof CreateOrderBody>;

  const address = await prisma.address.findFirst({ where: { id: body.addressId, userId: user.id } });
  if (!address) throw AppError.badRequest('Adresse de livraison invalide', 'ADDRESS_INVALID');

  const cart = await getOrCreateCart(user.id);
  if (cart.items.length === 0) throw AppError.badRequest('Votre panier est vide', 'CART_EMPTY');

  const order = await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const items: Prisma.OrderItemCreateWithoutOrderInput[] = [];

    for (const item of cart.items) {
      const { product, variant } = item;
      if (!product.isActive) {
        throw AppError.badRequest(`« ${product.nameFr} » n'est plus disponible`, 'PRODUCT_UNAVAILABLE');
      }

      // Décrément conditionnel : échoue si le stock a changé entre-temps.
      const updated = variant
        ? await tx.productVariant.updateMany({
            where: { id: variant.id, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          })
        : await tx.product.updateMany({
            where: { id: product.id, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
      if (updated.count === 0) {
        throw AppError.badRequest(`Stock insuffisant pour « ${product.nameFr} »`, 'OUT_OF_STOCK', {
          productId: product.id,
        });
      }
      // Le stock global d'un produit à variantes suit la somme de ses variantes.
      await tx.product.update({
        where: { id: product.id },
        data: {
          soldCount: { increment: item.quantity },
          ...(variant ? { stock: { decrement: item.quantity } } : {}),
        },
      });

      const unitPrice = product.price + (variant?.priceDelta ?? 0);
      subtotal += unitPrice * item.quantity;
      items.push({
        product: { connect: { id: product.id } },
        ...(variant ? { variant: { connect: { id: variant.id } } } : {}),
        name: pick(product, 'name', lang),
        imageUrl: product.images[0]?.url ?? null,
        size: variant?.size ?? null,
        color: variant?.color ?? null,
        unitPrice,
        quantity: item.quantity,
      });
    }

    // Coupon : revérifié ici, et son compteur est incrémenté atomiquement.
    let discount = 0;
    if (cart.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: cart.couponCode } });
      discount = computeCouponDiscount(coupon, subtotal);
      const used = await tx.coupon.updateMany({
        where: {
          code: cart.couponCode,
          ...(coupon!.usageLimit !== null ? { usedCount: { lt: coupon!.usageLimit } } : {}),
        },
        data: { usedCount: { increment: 1 } },
      });
      if (used.count === 0) throw AppError.badRequest('Ce code promo a atteint sa limite', 'COUPON_EXHAUSTED');
    }

    const shippingFee = shippingFeeFor(subtotal - discount);

    const created = await tx.order.create({
      data: {
        number: orderNumber(),
        userId: user.id,
        addressId: address.id,
        paymentMethod: body.paymentMethod,
        paymentStatus: body.paymentMethod === 'CASH_ON_DELIVERY' ? 'UNPAID' : 'PENDING',
        subtotal,
        discount,
        shippingFee,
        total: subtotal - discount + shippingFee,
        couponCode: cart.couponCode,
        shippingName: address.fullName,
        shippingPhone: address.phone,
        shippingGov: address.governorate,
        shippingCity: address.city,
        shippingStreet: address.street,
        note: body.note,
        items: { create: items },
        history: { create: { status: 'PENDING' } },
      },
      include: orderInclude,
    });

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
    return created;
  });

  // Paiement en ligne : initié après la transaction (appel réseau externe).
  let payment: PaymentInit | null = null;
  if (order.paymentMethod !== 'CASH_ON_DELIVERY') {
    const customer = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    try {
      payment =
        order.paymentMethod === 'KONNECT'
          ? await initKonnectPayment(order, customer)
          : await initFlouciPayment(order);
      await prisma.order.update({ where: { id: order.id }, data: { paymentRef: payment.paymentRef } });
    } catch (err) {
      // La commande existe : le client pourra relancer le paiement depuis « Mes commandes ».
      console.warn('[PAYMENT] initialisation échouée', err);
    }
  }

  notifyOrderStatus(order, lang).catch((e) => console.warn('[NOTIFY]', e));
  res.status(201).json({ order: toOrderDto(order), payUrl: payment?.payUrl ?? null });
});

// GET /orders — historique paginé (filtre de statut facultatif).
router.get('/', validate({ query: ListOrdersQuery }), async (req, res) => {
  const q = getQuery<z.infer<typeof ListOrdersQuery>>(res);
  const where: Prisma.OrderWhereInput = { userId: currentUser(req).id, status: q.status };
  const [rows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.order.count({ where }),
  ]);
  res.json(paginated(rows.map(toOrderDto), total, q));
});

// GET /orders/:id
router.get('/:id', async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id as string, userId: currentUser(req).id },
    include: orderInclude,
  });
  if (!order) throw AppError.notFound('Commande introuvable');
  res.json(toOrderDto(order));
});

// POST /orders/:id/pay — relance un paiement en ligne non abouti.
router.post('/:id/pay', async (req, res) => {
  const user = currentUser(req);
  const order = await prisma.order.findFirst({ where: { id: req.params.id as string, userId: user.id } });
  if (!order) throw AppError.notFound('Commande introuvable');
  if (order.paymentMethod === 'CASH_ON_DELIVERY' || order.paymentStatus === 'PAID' || order.status === 'CANCELLED') {
    throw AppError.badRequest('Aucun paiement en ligne à effectuer', 'NOTHING_TO_PAY');
  }
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const payment =
    order.paymentMethod === 'KONNECT' ? await initKonnectPayment(order, customer) : await initFlouciPayment(order);
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentRef: payment.paymentRef, paymentStatus: 'PENDING' },
  });
  res.json({ payUrl: payment.payUrl });
});

/** Remet en stock les articles d'une commande annulée. */
async function restock(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const i of items) {
    if (i.variantId) {
      await tx.productVariant.update({ where: { id: i.variantId }, data: { stock: { increment: i.quantity } } });
    }
    if (i.productId) {
      await tx.product.update({
        where: { id: i.productId },
        data: { stock: { increment: i.quantity }, soldCount: { decrement: i.quantity } },
      });
    }
  }
}

// POST /orders/:id/cancel — le client peut annuler tant que la commande n'est pas expédiée.
router.post('/:id/cancel', async (req, res) => {
  const user = currentUser(req);
  const order = await prisma.order.findFirst({ where: { id: req.params.id as string, userId: user.id } });
  if (!order) throw AppError.notFound('Commande introuvable');
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw AppError.badRequest('Cette commande ne peut plus être annulée', 'CANNOT_CANCEL');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await restock(tx, order.id);
    return tx.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', history: { create: { status: 'CANCELLED', note: 'Annulée par le client' } } },
      include: orderInclude,
    });
  });
  notifyOrderStatus(updated, getLang(req)).catch(() => undefined);
  res.json(toOrderDto(updated));
});

// PATCH /orders/:id/status — (admin) fait avancer la commande et notifie le client.
router.patch(
  '/:id/status',
  requireRole('ADMIN'),
  validate({
    body: z.object({
      status: z.enum(['CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
      note: z.string().max(200).optional(),
    }),
  }),
  async (req, res) => {
    const { status, note } = req.body as { status: OrderStatus; note?: string };
    const order = await prisma.order.findUnique({
      where: { id: req.params.id as string },
      include: { user: { select: { language: true } } },
    });
    if (!order) throw AppError.notFound('Commande introuvable');
    if (!NEXT_STATUS[order.status].includes(status)) {
      throw AppError.badRequest(`Transition ${order.status} → ${status} impossible`, 'INVALID_TRANSITION');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (status === 'CANCELLED') await restock(tx, order.id);
      return tx.order.update({
        where: { id: order.id },
        data: {
          status,
          // Paiement à la livraison : encaissé à la remise du colis.
          ...(status === 'DELIVERED' && order.paymentMethod === 'CASH_ON_DELIVERY' ? { paymentStatus: 'PAID' } : {}),
          history: { create: { status, note } },
        },
        include: orderInclude,
      });
    });
    notifyOrderStatus(updated, order.user.language).catch(() => undefined);
    res.json(toOrderDto(updated));
  },
);

export default router;
