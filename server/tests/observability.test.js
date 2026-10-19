// Observabilité : health check qui vérifie réellement la base, anomalies de
// paiement recopiées dans les logs du serveur.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer, api } from './helpers.js';

let sequelize;
let PaymentLog;

before(async () => {
  await startTestServer({ db: 'test-observability' });
  ({ default: sequelize } = await import('../src/config/database.js'));
  ({ PaymentLog } = await import('../src/models/index.js'));
});

after(async () => {
  await stopTestServer();
});

async function capturerConsole(fn) {
  const originals = { error: console.error, warn: console.warn };
  const logs = [];
  console.error = (...args) => logs.push({ level: 'error', text: args.join(' ') });
  console.warn = (...args) => logs.push({ level: 'warn', text: args.join(' ') });
  try {
    await fn();
  } finally {
    Object.assign(console, originals);
  }
  return logs;
}

test('health : 200 quand la base répond', async () => {
  const { status, json } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(json.status, 'ok');
  assert.equal(json.database, 'ok');
  assert.equal(typeof json.uptimeSeconds, 'number');
});

test('health : 503 quand la base est injoignable, sans détail d’erreur exposé', async () => {
  const query = sequelize.query;
  sequelize.query = async () => { throw new Error('connect ECONNREFUSED 10.0.0.1:5432'); };
  let reponse;
  const logs = await capturerConsole(async () => { reponse = await api('/api/health'); });
  sequelize.query = query;

  assert.equal(reponse.status, 503);
  assert.equal(reponse.json.status, 'degraded');
  assert.equal(reponse.json.database, 'error');
  assert.ok(!JSON.stringify(reponse.json).includes('10.0.0.1'), 'détail interne exposé publiquement');
  assert.ok(logs.some((l) => l.level === 'error' && /\[HEALTH\]/.test(l.text)));
});

test('paiement : les anomalies sont journalisées, les événements normaux non', async () => {
  const logs = await capturerConsole(async () => {
    await PaymentLog.create({ evenement: 'webhook_recu', statut: 'montant_invalide', montant: 12, provider: 'konnect', ip: '1.2.3.4' });
    await PaymentLog.create({ evenement: 'webhook_rejete', statut: 'signature_invalide', provider: 'flouci' });
    await PaymentLog.create({ evenement: 'paiement_sur_commande_close', statut: 'a_rembourser', montant: 40, provider: 'konnect' });
    await PaymentLog.create({ evenement: 'webhook_recu', statut: 'validee', montant: 40, provider: 'konnect' });
    await PaymentLog.create({ evenement: 'initiate', statut: 'en_attente', montant: 40, provider: 'konnect' });
  });
  const paiement = logs.filter((l) => l.text.startsWith('[PAYMENT]'));
  assert.equal(paiement.length, 3, JSON.stringify(paiement));
  assert.ok(paiement.some((l) => l.level === 'warn' && /montant_invalide/.test(l.text) && /konnect/.test(l.text)));
  assert.ok(paiement.some((l) => l.level === 'warn' && /signature_invalide/.test(l.text)));
  assert.ok(paiement.some((l) => l.level === 'error' && /a_rembourser/.test(l.text)));
});
