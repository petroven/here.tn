import { PaymentProvider } from './PaymentProvider.js';
import { verifyHmacSignature } from './hmac.js';

const isSandbox = (process.env.PAYMENT_MODE || 'sandbox') === 'sandbox' && process.env.NODE_ENV !== 'production';

/**
 * Local-dev provider used to exercise the full initiate → signed webhook →
 * confirmation pipeline without real gateway credentials. Refuses to
 * operate outside PAYMENT_MODE=sandbox / non-production, same guard used
 * by the legacy sandbox flow in utils/paymentGateway.js.
 */
export class SandboxMockProvider extends PaymentProvider {
  get name() {
    return 'sandbox';
  }

  async initiate({ amount, orderId }) {
    if (!isSandbox) throw new Error('Le provider sandbox est désactivé en production.');
    const providerReference = `SANDBOX-${orderId}-${Date.now()}`;
    return {
      paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/sandbox?ref=${providerReference}&amount=${amount}`,
      providerReference,
      raw: { amount, orderId, mock: true },
    };
  }

  verifyWebhookSignature(req) {
    if (!isSandbox) return false;
    return verifyHmacSignature({
      rawBody: req.rawBody,
      signatureHeader: req.headers['x-sandbox-signature'],
      secret: process.env.SANDBOX_WEBHOOK_SECRET || 'sandbox_webhook_secret',
    });
  }

  parseWebhookPayload(body) {
    return {
      providerReference: body.providerReference,
      statut: body.statut === 'validee' ? 'validee' : 'echec',
      montant: body.montant !== undefined ? Number(body.montant) : undefined,
    };
  }
}
