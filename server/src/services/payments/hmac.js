import crypto from 'crypto';

/**
 * Generic HMAC-SHA256 webhook signature check, computed over the exact
 * raw request bytes (req.rawBody — captured by express.json's `verify`
 * hook in server.js). This is the pattern most providers use (a shared
 * secret + a signature header), but the exact header name and algorithm
 * vary per real provider — adjust when wiring real Flouci/Konnect
 * credentials; this is the single place that needs to change.
 */
/**
 * Secret de webhook d'un prestataire. La valeur de repli est publique (dans
 * ce dépôt) : elle n'est utilisable qu'en développement. En production, un
 * secret absent donne null et verifyHmacSignature refuse alors tout webhook,
 * sinon n'importe qui pourrait signer un faux « paiement validé ».
 */
export function webhookSecret(envName, devFallback) {
  if (process.env[envName]) return process.env[envName];
  return process.env.NODE_ENV === 'production' ? null : devFallback;
}

export function verifyHmacSignature({ rawBody, signatureHeader, secret }) {
  if (!rawBody || !signatureHeader || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(signatureHeader);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}
