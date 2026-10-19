import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Les gardes du mode sandbox lisent NODE_ENV (parfois au chargement du
// module) : on les observe dans un processus séparé, configuré comme le
// service Render de production avec un PAYMENT_MODE=sandbox oublié.
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const probe = `
import express from 'express';
const { isSandbox, paymentModeWarning, SandboxMockProvider } = await import('./src/services/payments/SandboxMockProvider.js');
const { confirmSandboxPayment } = await import('./src/utils/paymentGateway.js');
const { default: marketRoutes } = await import('./src/routes/marketRoutes.js');

const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };
const provider = new SandboxMockProvider();

const app = express();
app.use('/api', marketRoutes);
const server = app.listen(0);
const { port } = server.address();
const config = await (await fetch('http://127.0.0.1:' + port + '/api/config/payment-methods')).json();
server.close();

console.log(JSON.stringify({
  isSandbox: isSandbox(),
  warning: paymentModeWarning(),
  initiateRejected: await rejects(() => provider.initiate({ amount: 10, orderId: 1 })),
  simulationRejected: await rejects(() => provider.construireWebhooks('SUCCESS', { providerReference: 'x', montant: 10 })),
  webhookAccepted: provider.verifyWebhookSignature({ headers: {}, rawBody: Buffer.from('{}') }),
  confirmRejected: await rejects(() => confirmSandboxPayment('REF-1')),
  paiementTest: config.data.paiementTest,
}));
process.exit(0);
`;

function runProbe(env) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
    cwd: serverRoot,
    env: {
      ...process.env,
      SQLITE_STORAGE: path.join(os.tmpdir(), `heretn-guard-${process.pid}.db`),
      ...env,
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim().split('\n').pop());
}

test('production + PAYMENT_MODE=sandbox : simulateur et paiements de test désactivés', () => {
  const r = runProbe({ NODE_ENV: 'production', PAYMENT_MODE: 'sandbox', JWT_SECRET: 'q7Vx2LpR9sKe4TnW8yBc3HfJ6mZa1UdG5oQi0NrE' });
  assert.equal(r.isSandbox, false);
  assert.equal(r.initiateRejected, true, 'initiate sandbox accepté en production');
  assert.equal(r.simulationRejected, true, 'simulation de webhook acceptée en production');
  assert.equal(r.webhookAccepted, false, 'webhook sandbox accepté en production');
  assert.equal(r.confirmRejected, true, 'confirmation sandbox acceptée en production');
  assert.equal(r.paiementTest, false, 'le site annoncerait un paiement de test en production');
  assert.match(r.warning, /PAYMENT_MODE=sandbox est ignoré en production/);
});

test('production + PAYMENT_MODE=production : aucun avertissement', () => {
  const r = runProbe({ NODE_ENV: 'production', PAYMENT_MODE: 'production', JWT_SECRET: 'q7Vx2LpR9sKe4TnW8yBc3HfJ6mZa1UdG5oQi0NrE' });
  assert.equal(r.isSandbox, false);
  assert.equal(r.paiementTest, false);
  assert.equal(r.warning, null);
});

test('développement + PAYMENT_MODE=sandbox : simulateur disponible', () => {
  const r = runProbe({ NODE_ENV: 'development', PAYMENT_MODE: 'sandbox' });
  assert.equal(r.isSandbox, true);
  assert.equal(r.initiateRejected, false);
  assert.equal(r.confirmRejected, false);
  assert.equal(r.paiementTest, true);
  assert.equal(r.warning, null);
});
