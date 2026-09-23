import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { verifyFlouciPayment, verifyKonnectPayment } from '../services/payments.js';
import { notifyUser } from '../services/notify.js';

const router = Router();

/**
 * Vérifie le paiement d'une commande auprès de sa passerelle et met à jour
 * son statut. Idempotent : peut être appelé par le webhook ET par l'app.
 */
async function reconcile(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.paymentRef) return order;
  if (order.paymentStatus === 'PAID') return order;

  const paid =
    order.paymentMethod === 'KONNECT'
      ? await verifyKonnectPayment(order.paymentRef)
      : order.paymentMethod === 'FLOUCI'
        ? await verifyFlouciPayment(order.paymentRef)
        : false;

  if (!paid) return order;

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      // Paiement reçu => commande confirmée automatiquement.
      ...(order.status === 'PENDING'
        ? { status: 'CONFIRMED', history: { create: { status: 'CONFIRMED', note: 'Paiement en ligne reçu' } } }
        : {}),
    },
  });
  await notifyUser(order.userId, {
    type: 'ORDER',
    title: `Paiement reçu — ${order.number}`,
    body: 'Votre paiement a été confirmé. Merci pour votre achat !',
    data: { orderId: order.id },
  });
  return updated;
}

// Webhook Konnect : GET /payments/konnect/webhook?payment_ref=...
router.get('/konnect/webhook', async (req, res) => {
  const ref = String(req.query.payment_ref ?? '');
  const order = ref ? await prisma.order.findFirst({ where: { paymentRef: ref } }) : null;
  if (order) await reconcile(order.id);
  res.status(200).json({ received: true });
});

// POST /payments/verify/:orderId — appelé par l'app au retour de la page de paiement.
router.post('/verify/:orderId', requireAuth, async (req, res) => {
  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId as string, userId: currentUser(req).id },
  });
  if (!order) throw AppError.notFound('Commande introuvable');
  const updated = await reconcile(order.id);
  res.json({ paymentStatus: updated?.paymentStatus ?? order.paymentStatus, status: updated?.status ?? order.status });
});

export default router;
