// Ajout rapide de produits (site : QuickAddModal, app : SellerQuickAddScreen) —
// la nouvelle tentative après une réponse perdue ne doit jamais créer de doublon.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { startTestServer, stopTestServer, api, login, DEMO_VENDEUR } from './helpers.js';

let token;
let vendeurId;

before(async () => {
  await startTestServer({ db: 'quick-add' });
  const session = await login(DEMO_VENDEUR);
  token = session.token;
  vendeurId = session.user.id;
});

after(async () => {
  await stopTestServer();
});

const fiche = (nom) => ({ nom, description: nom, prix: 25, stock: 3 });

async function compterProduits(nom) {
  const { json } = await api(`/api/vendor/products/${vendeurId}`, { token });
  return json.data.filter((p) => p.nom === nom).length;
}

test('même Idempotency-Key rejouée → un seul produit, le même renvoyé', async () => {
  const key = randomUUID();
  const nom = `Robe rapide ${key.slice(0, 6)}`;
  const premier = await api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: fiche(nom), headers: { 'Idempotency-Key': key } });
  const rejoue = await api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: fiche(nom), headers: { 'Idempotency-Key': key } });

  assert.equal(premier.status, 201);
  assert.equal(rejoue.status, 200);
  assert.equal(rejoue.json.replayed, true);
  assert.equal(rejoue.json.data.id, premier.json.data.id);
  assert.equal(await compterProduits(nom), 1);
});

test('deux envois simultanés avec la même clé → un seul produit', async () => {
  const key = randomUUID();
  const nom = `Sac rapide ${key.slice(0, 6)}`;
  const envoi = () => api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: fiche(nom), headers: { 'Idempotency-Key': key } });
  const [a, b] = await Promise.all([envoi(), envoi()]);

  assert.equal(a.json.data.id, b.json.data.id);
  assert.equal(await compterProduits(nom), 1);
});

test('clés différentes (ou absentes) → produits distincts', async () => {
  const nom = `Chemise ${randomUUID().slice(0, 6)}`;
  await api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: fiche(nom), headers: { 'Idempotency-Key': randomUUID() } });
  await api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: fiche(nom), headers: { 'Idempotency-Key': randomUUID() } });
  await api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: fiche(nom) });
  assert.equal(await compterProduits(nom), 3);
});

test('un envoi refusé (prix invalide) ne bloque pas la clé', async () => {
  const key = randomUUID();
  const nom = `Pull ${key.slice(0, 6)}`;
  const refuse = await api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: { ...fiche(nom), prix: -1 }, headers: { 'Idempotency-Key': key } });
  assert.equal(refuse.status, 400);
  const corrige = await api(`/api/vendor/products/${vendeurId}`, { method: 'POST', token, body: fiche(nom), headers: { 'Idempotency-Key': key } });
  assert.equal(corrige.status, 201);
  assert.equal(await compterProduits(nom), 1);
});
