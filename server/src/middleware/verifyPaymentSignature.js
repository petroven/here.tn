import { getProvider } from '../services/payments/index.js';
import { PaymentLog } from '../models/index.js';

// Reusable across every provider's webhook route: resolves the provider
// from the :provider route param and rejects the request before any
// business logic runs if the signature doesn't check out.
export async function verifyPaymentSignature(req, res, next) {
  try {
    const provider = getProvider(req.params.provider);
    const valid = provider.verifyWebhookSignature(req);

    if (!valid) {
      await PaymentLog.create({
        evenement: 'webhook_rejete',
        statut: 'signature_invalide',
        provider: req.params.provider,
        ip: req.ip,
      });
      return res.status(401).json({ success: false, message: 'Signature de webhook invalide.' });
    }

    req.paymentProvider = provider;
    return next();
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
