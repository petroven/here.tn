// Retour OAuth vers le site : le jeton ne doit jamais figurer dans la query
// string (logs d'accès, Referer, historique), seulement dans le fragment.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_ci_only';
process.env.CLIENT_URL = 'https://site.example';

test('succès : jeton dans le fragment, query vide', async () => {
  const { urlRetourWeb } = await import('../src/routes/oauthRoutes.js');
  const url = new URL(urlRetourWeb({ token: 'eyJhbGciOi.eyJpZCI6MX0.sig-_x' }));
  assert.equal(url.origin + url.pathname, 'https://site.example/oauth/callback');
  assert.equal(url.search, '');
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'), 'eyJhbGciOi.eyJpZCI6MX0.sig-_x');
});

test('erreur : message en query, aucun jeton', async () => {
  const { urlRetourWeb } = await import('../src/routes/oauthRoutes.js');
  const url = new URL(urlRetourWeb({ error: 'Connexion refusée.' }));
  assert.equal(url.searchParams.get('error'), 'Connexion refusée.');
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('token'), null);
});
