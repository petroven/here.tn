/**
 * Common interface every payment provider must implement. Adding a new
 * payment method means writing one new file that extends this class and
 * registering it in services/payments/index.js — nothing else in the
 * codebase needs to change.
 */
export class PaymentProvider {
  /** Unique lowercase provider key, e.g. 'flouci', 'konnect', 'cod'. */
  get name() {
    throw new Error('PaymentProvider.name must be implemented.');
  }

  /**
   * Start a payment. Must NEVER receive or persist raw card data — the
   * frontend talks to the provider's own hosted form/redirect, never to
   * this backend, for anything card-related.
   * @param {{ amount: number, orderId: number, email: string, phone?: string }} params
   * @returns {Promise<{ paymentUrl: string|null, providerReference: string, raw: object }>}
   */
  async initiate(_params) {
    throw new Error('PaymentProvider.initiate must be implemented.');
  }

  /**
   * Verify that an incoming webhook request genuinely came from this
   * provider. Must be constant-time and based on the raw request body,
   * not the parsed JSON (signatures are computed over exact bytes).
   * @param {import('express').Request} _req
   * @returns {boolean}
   */
  verifyWebhookSignature(_req) {
    throw new Error('PaymentProvider.verifyWebhookSignature must be implemented.');
  }

  /**
   * Turn a verified webhook body into a normalized shape the route
   * handler can act on uniformly across providers.
   * @param {object} _body
   * @returns {{ providerReference: string, statut: 'validee'|'echec', montant?: number }}
   */
  parseWebhookPayload(_body) {
    throw new Error('PaymentProvider.parseWebhookPayload must be implemented.');
  }
}
