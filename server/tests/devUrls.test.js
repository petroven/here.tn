import test from 'node:test';
import assert from 'node:assert/strict';

// Sans CLIENT_URL / FRONTEND_URL, les liens envoyés au client doivent viser le
// serveur Vite de développement (port 5174, strictPort), pas l'ancien 5173.
const DEV_CLIENT = 'http://localhost:5174';

function withoutClientEnv(fn) {
  return async () => {
    const saved = {
      CLIENT_URL: process.env.CLIENT_URL,
      FRONTEND_URL: process.env.FRONTEND_URL,
      SMS_PROVIDER: process.env.SMS_PROVIDER,
    };
    delete process.env.CLIENT_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.SMS_PROVIDER;
    try {
      await fn();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
}

test('SMS de confirmation : lien par défaut sur le client de dev 5174', withoutClientEnv(async () => {
  const { smsConfirmationCommande } = await import('../src/utils/sms.js');
  const result = await smsConfirmationCommande('+21622123456', 'CMD-1', 'tok123');
  assert.ok(result.message.includes(`${DEV_CLIENT}/confirmer-commande/tok123`), result.message);
}));

test('passerelles sandbox : URLs de retour par défaut sur le client de dev 5174', withoutClientEnv(async () => {
  const { initKonnectPayment, initFlouciPayment } = await import('../src/utils/paymentGateway.js');
  const originalFetch = globalThis.fetch;
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return { ok: false };
  };
  try {
    const konnect = await initKonnectPayment({ amount: 10, orderId: 7, email: 'a@here.tn' });
    const flouci = await initFlouciPayment({ amount: 10, orderId: 7, email: 'a@here.tn' });
    const [konnectBody, flouciBody] = bodies;
    for (const url of [konnectBody.successUrl, konnectBody.failUrl, flouciBody.success_link, flouciBody.fail_link]) {
      assert.ok(url.startsWith(`${DEV_CLIENT}/payment/return?`), url);
    }
    // Passerelle injoignable en sandbox : repli sur la page de paiement simulée.
    for (const result of [konnect, flouci]) {
      assert.ok(result.paymentUrl.startsWith(`${DEV_CLIENT}/payment/sandbox?`), result.paymentUrl);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}));
