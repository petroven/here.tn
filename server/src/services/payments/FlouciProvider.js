import { PaymentProvider } from './PaymentProvider.js';
import { initFlouciPayment } from '../../utils/paymentGateway.js';
import { verifyHmacSignature } from './hmac.js';

export class FlouciProvider extends PaymentProvider {
  get name() {
    return 'flouci';
  }

  async initiate({ amount, orderId, email }) {
    const result = await initFlouciPayment({ amount, orderId, email });
    return { paymentUrl: result.paymentUrl, providerReference: result.paymentRef, raw: result };
  }

  verifyWebhookSignature(req) {
    return verifyHmacSignature({
      rawBody: req.rawBody,
      signatureHeader: req.headers['x-flouci-signature'],
      secret: process.env.FLOUCI_WEBHOOK_SECRET || 'sandbox_flouci_webhook_secret',
    });
  }

  parseWebhookPayload(body) {
    return {
      providerReference: body.payment_id || body.developer_tracking_id,
      statut: body.status === 'SUCCESS' ? 'validee' : 'echec',
      montant: body.amount ? Number(body.amount) / 1000 : undefined,
    };
  }
}
