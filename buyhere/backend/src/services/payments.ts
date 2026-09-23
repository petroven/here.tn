import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Intégration des passerelles de paiement tunisiennes (mode sandbox).
 *
 * Flux commun :
 *  1. L'app crée la commande (paymentMethod = KONNECT | FLOUCI).
 *  2. L'API initie le paiement et renvoie `payUrl`.
 *  3. L'app ouvre `payUrl` dans un navigateur in-app.
 *  4. La passerelle redirige vers APP_RETURN_URL et appelle le webhook.
 *  5. L'API vérifie le paiement auprès de la passerelle (jamais sur la seule
 *     foi de la redirection) puis marque la commande payée.
 */

export type PaymentInit = { payUrl: string; paymentRef: string };
type OrderRef = { id: string; number: string; total: number };
type Customer = { firstName: string; lastName: string; email: string; phone: string | null };

// ─── Konnect — https://docs.konnect.network ───

export async function initKonnectPayment(order: OrderRef, customer: Customer): Promise<PaymentInit> {
  if (!env.KONNECT_API_KEY || !env.KONNECT_WALLET_ID) {
    throw new AppError(503, 'PAYMENT_UNAVAILABLE', "Le paiement Konnect n'est pas configuré");
  }
  const res = await fetch(`${env.KONNECT_API_URL}/payments/init-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.KONNECT_API_KEY },
    body: JSON.stringify({
      receiverWalletId: env.KONNECT_WALLET_ID,
      token: 'TND',
      amount: order.total, // Konnect attend des millimes pour le TND
      type: 'immediate',
      description: `Commande ${order.number}`,
      acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
      lifespan: 30, // minutes
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phoneNumber: customer.phone?.replace('+216', ''),
      orderId: order.id,
      webhook: `${env.PUBLIC_API_URL}/payments/konnect/webhook`,
      successUrl: `${env.APP_RETURN_URL}?orderId=${order.id}&status=success`,
      failUrl: `${env.APP_RETURN_URL}?orderId=${order.id}&status=failed`,
      theme: 'light',
    }),
  });
  if (!res.ok) throw new AppError(502, 'PAYMENT_INIT_FAILED', 'Konnect indisponible, réessayez');
  const data = (await res.json()) as { payUrl: string; paymentRef: string };
  return { payUrl: data.payUrl, paymentRef: data.paymentRef };
}

/** Vérifie auprès de Konnect si le paiement est effectivement complété. */
export async function verifyKonnectPayment(paymentRef: string): Promise<boolean> {
  const res = await fetch(`${env.KONNECT_API_URL}/payments/${encodeURIComponent(paymentRef)}`, {
    headers: { 'x-api-key': env.KONNECT_API_KEY ?? '' },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { payment?: { status?: string } };
  return data.payment?.status === 'completed';
}

// ─── Flouci — https://docs.flouci.com ───

export async function initFlouciPayment(order: OrderRef): Promise<PaymentInit> {
  if (!env.FLOUCI_APP_TOKEN || !env.FLOUCI_APP_SECRET) {
    throw new AppError(503, 'PAYMENT_UNAVAILABLE', "Le paiement Flouci n'est pas configuré");
  }
  const res = await fetch(`${env.FLOUCI_API_URL}/generate_payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_token: env.FLOUCI_APP_TOKEN,
      app_secret: env.FLOUCI_APP_SECRET,
      amount: String(order.total), // millimes
      accept_card: 'true',
      session_timeout_secs: 1800,
      success_link: `${env.APP_RETURN_URL}?orderId=${order.id}&status=success`,
      fail_link: `${env.APP_RETURN_URL}?orderId=${order.id}&status=failed`,
      developer_tracking_id: order.id,
    }),
  });
  if (!res.ok) throw new AppError(502, 'PAYMENT_INIT_FAILED', 'Flouci indisponible, réessayez');
  const data = (await res.json()) as { result?: { link: string; payment_id: string; success: boolean } };
  if (!data.result?.success) throw new AppError(502, 'PAYMENT_INIT_FAILED', 'Flouci a refusé la demande');
  return { payUrl: data.result.link, paymentRef: data.result.payment_id };
}

export async function verifyFlouciPayment(paymentId: string): Promise<boolean> {
  const res = await fetch(`${env.FLOUCI_API_URL}/verify_payment/${encodeURIComponent(paymentId)}`, {
    headers: { apppublic: env.FLOUCI_APP_TOKEN ?? '', appsecret: env.FLOUCI_APP_SECRET ?? '' },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean; result?: { status?: string } };
  return !!data.success && data.result?.status === 'SUCCESS';
}
