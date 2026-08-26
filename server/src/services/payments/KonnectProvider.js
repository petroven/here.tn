import { PaymentProvider } from './PaymentProvider.js';
import { initKonnectPayment } from '../../utils/paymentGateway.js';
import { verifyHmacSignature } from './hmac.js';

export class KonnectProvider extends PaymentProvider {
  get name() {
    return 'konnect';
  }

  async initiate({ amount, orderId, email, phone }) {
    const result = await initKonnectPayment({ amount, orderId, email, phone });
    return { paymentUrl: result.paymentUrl, providerReference: result.paymentRef, raw: result };
  }

  verifyWebhookSignature(req) {
    return verifyHmacSignature({
      rawBody: req.rawBody,
      signatureHeader: req.headers['x-konnect-signature'],
      secret: process.env.KONNECT_WEBHOOK_SECRET || 'sandbox_konnect_webhook_secret',
    });
  }

  parseWebhookPayload(body) {
    return {
      providerReference: body.payment_ref || body.orderId,
      statut: body.status === 'completed' ? 'validee' : 'echec',
      montant: body.amount ? Number(body.amount) / 1000 : undefined,
    };
  }
}
