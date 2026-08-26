import { PaymentProvider } from './PaymentProvider.js';

/**
 * Cash on delivery isn't a real gateway — "initiate" just records the
 * intent, and confirmation happens when the courier collects the cash
 * (see livreurRoutes.js's statut='livree' handler, which already marks
 * the Paiement 'paye_livraison'). No webhook applies to this provider.
 */
export class CashOnDeliveryProvider extends PaymentProvider {
  get name() {
    return 'cod';
  }

  async initiate({ amount, orderId }) {
    return {
      paymentUrl: null,
      providerReference: `COD-${orderId}-${Date.now()}`,
      raw: { amount, orderId, mode: 'cash_on_delivery' },
    };
  }

  verifyWebhookSignature() {
    return false; // COD never receives webhooks
  }

  parseWebhookPayload() {
    throw new Error('CashOnDeliveryProvider does not support webhooks.');
  }
}
