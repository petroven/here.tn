// Comptes de démonstration : leurs mots de passe sont publics (README,
// documentation). En production ils ne doivent ouvrir aucune session : mot de
// passe de la variable DEMO_*_PASSWORD, sinon aléatoire ; un compte encore sur
// le mot de passe public est corrigé au démarrage.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer, api, DEMO_ADMIN } from './helpers.js';

let seed;
const connexion = (email, password) => api('/api/auth/login', { method: 'POST', body: { email, password } });

before(async () => {
  await startTestServer({ db: 'test-demo-production' });
  seed = await import('../src/utils/seed.js');
});

after(async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.DEMO_SUPER_ADMIN_PASSWORD;
  await stopTestServer();
});

test('hors production : mot de passe public (développement, tests)', async () => {
  assert.equal(seed.motDePasseDemo('DEMO_INEXISTANT', 'Public2026!'), 'Public2026!');
  assert.equal((await connexion(DEMO_ADMIN.email, DEMO_ADMIN.password)).status, 200);
});

test('production : aléatoire sans variable, jamais le mot de passe public', () => {
  process.env.NODE_ENV = 'production';
  try {
    const a = seed.motDePasseDemo('DEMO_INEXISTANT', 'Public2026!');
    const b = seed.motDePasseDemo('DEMO_INEXISTANT', 'Public2026!');
    assert.notEqual(a, 'Public2026!');
    assert.notEqual(a, b);
    assert.ok(a.length >= 24);
  } finally {
    process.env.NODE_ENV = 'test';
  }
});

test('production : comptes existants sur le mot de passe public corrigés au démarrage', async () => {
  process.env.NODE_ENV = 'production';
  process.env.DEMO_SUPER_ADMIN_PASSWORD = 'Configure-Sur-Render-2026';
  try {
    await seed.seedDemoAccounts();
  } finally {
    process.env.NODE_ENV = 'test';
  }
  assert.equal((await connexion(DEMO_ADMIN.email, DEMO_ADMIN.password)).status, 401, 'mot de passe public refusé');
  assert.equal((await connexion(DEMO_ADMIN.email, 'Configure-Sur-Render-2026')).status, 200, 'mot de passe de la variable accepté');
  assert.equal((await connexion('client.demo@here.tn', 'ClientDemo2026!')).status, 401, 'client : public refusé (aléatoire)');
  assert.equal((await connexion('vendeur1.demo@here.tn', 'VendeurDemo2026!')).status, 401, 'vendeur : public refusé');
});
