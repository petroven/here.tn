// Connexion Google / Facebook sans clés sur le serveur : avant, le bouton
// envoyait vers Google avec « client_id=missing_google_client_id » (page
// d'erreur de Google). Maintenant : retour sur le site avec un message clair.
// Avec les clés : redirection vers le fournisseur.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer } from './helpers.js';
import * as helpers from './helpers.js';

const cles = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'];
const sauvegarde = Object.fromEntries(cles.map((k) => [k, process.env[k]]));
const ouvrir = (chemin) => fetch(`${helpers.BASE_URL}${chemin}`, { redirect: 'manual' });

before(async () => {
  for (const k of cles) delete process.env[k];
  await startTestServer({ db: 'test-oauth-configuration' });
});

after(async () => {
  for (const k of cles) {
    if (sauvegarde[k] === undefined) delete process.env[k];
    else process.env[k] = sauvegarde[k];
  }
  await stopTestServer();
});

test('sans clés : retour sur le site avec un message, jamais « missing_… » chez Google', async () => {
  for (const [fournisseur, nom] of [['google', 'Google'], ['facebook', 'Facebook']]) {
    const r = await ouvrir(`/api/auth/${fournisseur}`);
    assert.equal(r.status, 302);
    const cible = new URL(r.headers.get('location'));
    assert.equal(cible.pathname, '/oauth/callback');
    assert.match(cible.searchParams.get('error'), new RegExp(`connexion avec ${nom} n'est pas encore disponible`));
  }
});

test('sans clés, depuis l\'app : le message revient dans l\'app', async () => {
  const r = await ouvrir(`/api/auth/google?redirect=${encodeURIComponent('buyhere://oauth')}`);
  const cible = r.headers.get('location');
  assert.match(cible, /^buyhere:\/\/oauth\?/);
  assert.match(new URL(cible).searchParams.get('error'), /Google/);
});

test('avec les clés : redirection vers le fournisseur', async () => {
  process.env.GOOGLE_CLIENT_ID = 'id-de-test.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'secret-de-test';
  const r = await ouvrir('/api/auth/google');
  assert.equal(r.status, 302);
  assert.equal(new URL(r.headers.get('location')).host, 'accounts.google.com');
});
