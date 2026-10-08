// Photos stockées en base (production sans Cloudinary) : elles survivent à un
// redéploiement, contrairement au disque de l'hébergeur. Voir utils/upload.js.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer, api, login, DEMO_VENDEUR } from './helpers.js';
import * as helpers from './helpers.js';

process.env.UPLOAD_STORAGE = 'db';

// Plus petit PNG valide (1×1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let token;

before(async () => {
  await startTestServer({ db: 'upload-db' });
  token = (await login(DEMO_VENDEUR)).token;
});

after(async () => {
  await stopTestServer();
});

const envoyer = (buffer, nom, type) => {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type }), nom);
  return api('/api/upload', { method: 'POST', token, body: form });
};

test('une photo envoyée est enregistrée en base et relue à l’identique', async () => {
  const { status, json } = await envoyer(PNG, 'produit.png', 'image/png');
  assert.equal(status, 201);
  assert.match(json.url, /^\/uploads\/db\/\d+$/);

  const response = await fetch(`${helpers.BASE_URL}${json.url}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.match(response.headers.get('cache-control'), /immutable/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
});

test('un fichier qui n’est pas une image est refusé (400)', async () => {
  const { status } = await envoyer(Buffer.from('bonjour'), 'notes.txt', 'text/plain');
  assert.equal(status, 400);
});

test('une photo inexistante renvoie 404', async () => {
  assert.equal((await fetch(`${helpers.BASE_URL}/uploads/db/999999`)).status, 404);
  assert.equal((await fetch(`${helpers.BASE_URL}/uploads/db/abc`)).status, 404);
});
