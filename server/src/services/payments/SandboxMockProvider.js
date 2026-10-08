import crypto from 'crypto';
import { PaymentProvider } from './PaymentProvider.js';
import { verifyHmacSignature } from './hmac.js';

const isSandbox = () => (process.env.PAYMENT_MODE || 'sandbox') === 'sandbox' && process.env.NODE_ENV !== 'production';
const sandboxSecret = () => process.env.SANDBOX_WEBHOOK_SECRET || 'sandbox_webhook_secret';

/**
 * Scénarios de bout en bout simulables sans aucune clé de prestataire
 * (POST /api/payments/sandbox/simulate) — mêmes chemins de code que les
 * vrais webhooks Konnect/Flouci, seule la source du webhook change :
 *
 *  SUCCESS            webhook signé « validée », bon montant
 *  FAILED             webhook signé « échec » (carte refusée…)
 *  CANCELLED          webhook signé « annulée » (le client abandonne)
 *  TIMEOUT            aucun webhook : la transaction expire (voir PAYMENT_TIMEOUT_MINUTES)
 *  DUPLICATE_WEBHOOK  le même webhook « validée » envoyé deux fois
 *  WEBHOOK_DELAYED    webhook « validée » envoyé après un délai (delayMs)
 *  WRONG_AMOUNT       webhook « validée » avec un montant falsifié → rejeté
 *  INVALID_SIGNATURE  webhook « validée » avec une mauvaise signature → rejeté
 */
export const SANDBOX_SCENARIOS = [
  'SUCCESS', 'FAILED', 'CANCELLED', 'TIMEOUT', 'DUPLICATE_WEBHOOK', 'WEBHOOK_DELAYED', 'WRONG_AMOUNT', 'INVALID_SIGNATURE',
];

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
    if (!isSandbox()) throw new Error('Le provider sandbox est désactivé en production.');
    const providerReference = `SANDBOX-${orderId}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    return {
      paymentUrl: `${process.env.CLIENT_URL || 'http://localhost:5174'}/payment/return?orderId=${orderId}&ref=${providerReference}&sandbox=1`,
      providerReference,
      raw: { amount, orderId, mock: true },
    };
  }

  verifyWebhookSignature(req) {
    if (!isSandbox()) return false;
    return verifyHmacSignature({
      rawBody: req.rawBody,
      signatureHeader: req.headers['x-sandbox-signature'],
      secret: sandboxSecret(),
    });
  }

  parseWebhookPayload(body) {
    const statuts = { validee: 'validee', annulee: 'annulee' };
    return {
      providerReference: body.providerReference,
      statut: statuts[body.statut] || 'echec',
      montant: body.montant !== undefined ? Number(body.montant) : undefined,
    };
  }

  /**
   * Construit les webhooks qu'enverrait le prestataire pour un scénario
   * donné : liste de { body, rawBody, headers, delayMs } (vide = aucun
   * webhook, cas TIMEOUT).
   */
  construireWebhooks(scenario, { providerReference, montant, delayMs = 1500 }) {
    if (!isSandbox()) throw new Error('Le provider sandbox est désactivé en production.');
    if (!SANDBOX_SCENARIOS.includes(scenario)) throw new Error(`Scénario sandbox inconnu : ${scenario}`);

    const signe = (body, { mauvaiseSignature = false } = {}) => {
      const rawBody = JSON.stringify(body);
      const signature = crypto
        .createHmac('sha256', mauvaiseSignature ? 'secret_falsifie' : sandboxSecret())
        .update(rawBody)
        .digest('hex');
      return { body, rawBody, headers: { 'Content-Type': 'application/json', 'x-sandbox-signature': signature }, delayMs: 0 };
    };
    const base = { providerReference, montant: Number(montant) };

    switch (scenario) {
      case 'SUCCESS': return [signe({ ...base, statut: 'validee' })];
      case 'FAILED': return [signe({ ...base, statut: 'echec' })];
      case 'CANCELLED': return [signe({ ...base, statut: 'annulee' })];
      case 'TIMEOUT': return [];
      case 'DUPLICATE_WEBHOOK': {
        const webhook = signe({ ...base, statut: 'validee' });
        return [webhook, { ...webhook }];
      }
      case 'WEBHOOK_DELAYED': return [{ ...signe({ ...base, statut: 'validee' }), delayMs }];
      case 'WRONG_AMOUNT': return [signe({ ...base, montant: Math.round((Number(montant) - 1) * 1000) / 1000, statut: 'validee' })];
      case 'INVALID_SIGNATURE': return [signe({ ...base, statut: 'validee' }, { mauvaiseSignature: true })];
      default: return [];
    }
  }
}

export { isSandbox };
