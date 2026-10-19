// Photos stockées en base (production sans Cloudinary) : elles survivent à un
// redéploiement, contrairement au disque de l'hébergeur. Voir utils/upload.js.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer, api, login, DEMO_VENDEUR, DEMO_ADMIN } from './helpers.js';
import * as helpers from './helpers.js';

process.env.UPLOAD_STORAGE = 'db';

// Plus petit PNG valide (1×1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let token;
let vendeurId;

before(async () => {
  await startTestServer({ db: 'upload-db' });
  const vendeur = await login(DEMO_VENDEUR);
  token = vendeur.token;
  vendeurId = vendeur.user.id;
});

const statutPhoto = async (url) => (await fetch(`${helpers.BASE_URL}${url}`)).status;
const nouvellePhoto = async (nom) => (await envoyer(PNG, nom, 'image/png')).json.url;
const creerProduit = async (images) => {
  const { status, json } = await api(`/api/vendor/products/${vendeurId}`, {
    method: 'POST', token, body: { nom: `Produit photos ${Date.now()}`, description: 'Test photos', prix: 30, stock: 5, image: images[0], images },
  });
  assert.equal(status, 201, JSON.stringify(json));
  return json.data.id;
};

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

test('une photo stockée en base est supprimée puis renvoie 404', async () => {
  const { deleteImage } = await import('../src/utils/upload.js');
  const { json } = await envoyer(PNG, 'a-supprimer.png', 'image/png');
  assert.equal((await fetch(`${helpers.BASE_URL}${json.url}`)).status, 200);

  assert.equal(await deleteImage(json.url), true);
  assert.equal((await fetch(`${helpers.BASE_URL}${json.url}`)).status, 404);
  assert.equal(await deleteImage(json.url), false, 'une seconde suppression ne doit rien supprimer');
});

test('suppression : URL externe, inconnue ou traversée de chemin ignorées', async () => {
  const { deleteImage } = await import('../src/utils/upload.js');
  const { Fichier } = await import('../src/models/index.js');
  const avant = await Fichier.count();
  for (const url of [null, '', 'https://images.example.com/photo.jpg', '/uploads/db/abc', '/uploads/../package.json', '/uploads/..\\package.json', '/uploads/inexistant.png']) {
    assert.equal(await deleteImage(url), false, String(url));
  }
  assert.equal(await Fichier.count(), avant);
});

test('photo de profil remplacée : l’ancienne est effacée du stockage', async () => {
  const envoyerProfil = () => {
    const form = new FormData();
    form.append('photo', new Blob([PNG], { type: 'image/png' }), 'profil.png');
    return api('/api/users/me/photo', { method: 'PUT', token, body: form });
  };
  const premiere = await envoyerProfil();
  assert.equal(premiere.status, 200, JSON.stringify(premiere.json));
  const seconde = await envoyerProfil();
  assert.equal(seconde.status, 200);
  assert.equal(await statutPhoto(premiere.json.data.photo), 404, 'ancienne photo de profil conservée');
  assert.equal(await statutPhoto(seconde.json.data.photo), 200);
});

test('compte supprimé : la photo de profil (donnée personnelle) est effacée', async () => {
  const email = `photo.supprimee.${Date.now()}@here.tn`;
  const password = 'PhotoTest2026';
  const inscription = await api('/api/auth/register', {
    method: 'POST', body: { nom: 'Test', prenom: 'Photo', email, password, accepteConditions: true },
  });
  assert.equal(inscription.status, 201, JSON.stringify(inscription.json));
  const clientToken = (await login({ email, password })).token;

  const form = new FormData();
  form.append('photo', new Blob([PNG], { type: 'image/png' }), 'moi.png');
  const envoi = await api('/api/users/me/photo', { method: 'PUT', token: clientToken, body: form });
  assert.equal(envoi.status, 200, JSON.stringify(envoi.json));
  assert.equal(await statutPhoto(envoi.json.data.photo), 200);

  const suppression = await api('/api/users/me', { method: 'DELETE', token: clientToken, body: { password } });
  assert.equal(suppression.status, 200, JSON.stringify(suppression.json));
  assert.equal(await statutPhoto(envoi.json.data.photo), 404, 'photo de profil conservée après suppression du compte');
});

test('produit modifié : seule la photo retirée est effacée', async () => {
  const [retiree, gardee] = [await nouvellePhoto('a.png'), await nouvellePhoto('b.png')];
  const produitId = await creerProduit([retiree, gardee]);
  const { status, json } = await api(`/api/vendor/products/${produitId}`, {
    method: 'PUT', token, body: { image: gardee, images: [gardee] },
  });
  assert.equal(status, 200, JSON.stringify(json));
  assert.equal(await statutPhoto(retiree), 404, 'photo retirée du produit conservée');
  assert.equal(await statutPhoto(gardee), 200, 'photo encore utilisée supprimée');
});

test('produit supprimé : une photo partagée avec un autre produit est conservée', async () => {
  const [partagee, propre] = [await nouvellePhoto('partagee.png'), await nouvellePhoto('propre.png')];
  const premier = await creerProduit([partagee, propre]);
  const second = await creerProduit([partagee]);

  assert.equal((await api(`/api/vendor/products/${premier}`, { method: 'DELETE', token })).status, 200);
  assert.equal(await statutPhoto(propre), 404, 'photo du produit supprimé conservée');
  assert.equal(await statutPhoto(partagee), 200, 'photo encore utilisée par un autre produit supprimée');

  assert.equal((await api(`/api/vendor/products/${second}`, { method: 'DELETE', token })).status, 200);
  assert.equal(await statutPhoto(partagee), 404, 'photo orpheline conservée');
});

test('logo de boutique remplacé : l’ancien est effacé du stockage', async () => {
  const [ancien, nouveau] = [await nouvellePhoto('logo-a.png'), await nouvellePhoto('logo-b.png')];
  for (const logo of [ancien, nouveau]) {
    const { status, json } = await api(`/api/vendor/boutique/${vendeurId}`, { method: 'PUT', token, body: { logo } });
    assert.equal(status, 200, JSON.stringify(json));
  }
  assert.equal(await statutPhoto(ancien), 404, 'ancien logo conservé');
  assert.equal(await statutPhoto(nouveau), 200);
});

test('image de catégorie remplacée ou retirée : l’ancienne est effacée du stockage', async () => {
  const admin = await login(DEMO_ADMIN);
  const categorie = (await api('/api/categories')).json.data[0];
  const [premiere, seconde] = [await nouvellePhoto('cat-a.png'), await nouvellePhoto('cat-b.png')];
  const changer = (image) => api(`/api/admin/categories/${categorie.id}`, { method: 'PATCH', token: admin.token, body: { image } });

  assert.equal((await changer(premiere)).status, 200);
  assert.equal((await changer(seconde)).status, 200);
  assert.equal(await statutPhoto(premiere), 404, 'ancienne image de catégorie conservée');
  assert.equal(await statutPhoto(seconde), 200);

  assert.equal((await changer(null)).status, 200);
  assert.equal(await statutPhoto(seconde), 404, 'image retirée conservée');
});

test('une photo inexistante renvoie 404', async () => {
  assert.equal((await fetch(`${helpers.BASE_URL}/uploads/db/999999`)).status, 404);
  assert.equal((await fetch(`${helpers.BASE_URL}/uploads/db/abc`)).status, 404);
});
