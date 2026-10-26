// Annonces à tous les clients depuis le tableau de bord admin : push Expo +
// notification dans la cloche, réservé aux administrateurs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer, stopTestServer, api, login, DEMO_CLIENT, DEMO_VENDEUR, DEMO_ADMIN,
} from './helpers.js';

let models;
let admin;
let client;
let vendeur;

before(async () => {
  await startTestServer({ db: 'annonces' });
  models = await import('../src/models/index.js');
  [admin, client, vendeur] = await Promise.all([login(DEMO_ADMIN), login(DEMO_CLIENT), login(DEMO_VENDEUR)]);
});

after(async () => {
  await stopTestServer();
});

const ANNONCE = { titre: 'Soldes d’automne', message: 'Jusqu’à -30 % ce week-end dans toutes les boutiques.', lien: 'coupons' };

test('annonces : réservées aux administrateurs', async () => {
  assert.equal((await api('/api/admin/annonces', { method: 'POST', body: ANNONCE })).status, 401);
  assert.equal((await api('/api/admin/annonces', { method: 'POST', token: client.token, body: ANNONCE })).status, 403);
  assert.equal((await api('/api/admin/annonces', { method: 'POST', token: vendeur.token, body: ANNONCE })).status, 403);
  assert.equal((await api('/api/admin/annonces/audience', { token: client.token })).status, 403);
});

test('annonces : titre, message et lien validés', async () => {
  const envoyer = (body) => api('/api/admin/annonces', { method: 'POST', token: admin.token, body });
  assert.equal((await envoyer({ ...ANNONCE, titre: '   ' })).status, 400);
  assert.equal((await envoyer({ ...ANNONCE, titre: 'x'.repeat(66) })).status, 400);
  assert.equal((await envoyer({ ...ANNONCE, message: '' })).status, 400);
  assert.equal((await envoyer({ ...ANNONCE, message: 'x'.repeat(241) })).status, 400);
  assert.equal((await envoyer({ ...ANNONCE, lien: 'https://exemple.com' })).status, 400);
  assert.equal((await envoyer({ ...ANNONCE, lien: 'produit/abc' })).status, 400);
});

test('annonces : chaque client reçoit la notification, pas les vendeurs', async () => {
  await api('/api/users/me/push-token', {
    method: 'PUT', token: client.token, body: { token: 'ExponentPushToken[annonce-1]', plateforme: 'android' },
  });
  const nbClients = await models.Utilisateur.count({ where: { role: 'client' } });

  const audience = await api('/api/admin/annonces/audience', { token: admin.token });
  assert.equal(audience.status, 200);
  assert.deepEqual(audience.json.data, { clients: nbClients, appareils: 1 });

  const envoi = await api('/api/admin/annonces', { method: 'POST', token: admin.token, body: ANNONCE });
  assert.equal(envoi.status, 200);
  // Push coupé pendant les tests (NODE_ENV=test) : rien n'est envoyé à Expo.
  assert.deepEqual(envoi.json.data, { clients: nbClients, appareils: 1, envoyes: 0 });

  const recues = await api('/api/notifications', { token: client.token });
  const annonce = recues.json.data.find((n) => n.type === 'annonce');
  assert.ok(annonce, 'le client voit l’annonce dans sa cloche');
  assert.equal(annonce.titre, ANNONCE.titre);
  assert.equal(annonce.lien, 'coupons');
  assert.equal(annonce.lu, false);

  assert.equal(await models.Notification.count({ where: { type: 'annonce', utilisateurId: vendeur.user.id } }), 0);
  assert.equal(await models.Notification.count({ where: { type: 'annonce' } }), nbClients);

  const journal = await models.AuditLog.findOne({ where: { action: 'annonce_clients' } });
  assert.ok(journal, 'l’envoi est inscrit au journal d’audit');
  assert.equal(journal.acteurId, admin.user.id);
});

test('annonces : un double envoi immédiat est refusé', async () => {
  const doublon = await api('/api/admin/annonces', { method: 'POST', token: admin.token, body: ANNONCE });
  assert.equal(doublon.status, 429);
  const autre = await api('/api/admin/annonces', {
    method: 'POST', token: admin.token, body: { ...ANNONCE, message: 'Dernier jour des soldes !' },
  });
  assert.equal(autre.status, 200);
});

test('push Expo : envoi par lots de 100 messages au plus', async () => {
  const { envoyerPushExpo } = await import('../src/utils/notifications.js');
  const tokens = Array.from({ length: 250 }, (_, i) => ({ token: `ExponentPushToken[lot-${i}]` }));
  const lots = [];
  const originalFetch = globalThis.fetch;
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  globalThis.fetch = async (_url, options) => {
    const messages = JSON.parse(options.body);
    lots.push(messages.length);
    return { ok: true, status: 200, json: async () => ({ data: messages.map(() => ({ status: 'ok' })) }) };
  };
  try {
    assert.equal(await envoyerPushExpo(tokens, { titre: 'T', message: 'M' }), 250);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = nodeEnv;
  }
  assert.deepEqual(lots, [100, 100, 50]);
});
