import type { NotificationType, OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Enregistre une notification in-app et l'envoie en push (Expo) si
 * l'utilisateur a enregistré un token. Un échec du push n'empêche jamais
 * l'opération métier (commande, etc.) : il est seulement journalisé.
 */
export async function notifyUser(
  userId: string,
  input: { type: NotificationType; title: string; body: string; data?: Prisma.InputJsonValue },
) {
  const notification = await prisma.notification.create({ data: { userId, ...input } });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushToken: true } });
  if (user?.pushToken?.startsWith('ExponentPushToken')) {
    fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: user.pushToken,
        title: input.title,
        body: input.body,
        data: { ...(input.data as object | undefined), notificationId: notification.id },
        sound: 'default',
      }),
    }).catch((err) => console.warn('[PUSH] échec envoi :', err));
  }

  return notification;
}

const STATUS_MESSAGES: Record<OrderStatus, { fr: string; ar: string }> = {
  PENDING: { fr: 'Votre commande a bien été reçue.', ar: 'تم استلام طلبك.' },
  CONFIRMED: { fr: 'Votre commande a été confirmée.', ar: 'تم تأكيد طلبك.' },
  SHIPPED: { fr: 'Votre commande a été expédiée.', ar: 'تم شحن طلبك.' },
  DELIVERED: { fr: 'Votre commande a été livrée. Merci !', ar: 'تم توصيل طلبك. شكراً!' },
  CANCELLED: { fr: 'Votre commande a été annulée.', ar: 'تم إلغاء طلبك.' },
};

/** Notification standard de changement de statut de commande (langue du client). */
export async function notifyOrderStatus(
  order: { id: string; number: string; userId: string; status: OrderStatus },
  lang: 'fr' | 'ar' = 'fr',
) {
  return notifyUser(order.userId, {
    type: 'ORDER',
    title: lang === 'ar' ? `الطلب ${order.number}` : `Commande ${order.number}`,
    body: STATUS_MESSAGES[order.status][lang],
    data: { orderId: order.id },
  });
}
