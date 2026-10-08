// Espace livreur (site et app mobile) : inscription, disponibilité, position,
// proposition de course en cascade, acceptation, retrait, preuve, livraison
// COD et historique des gains.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer, stopTestServer, api, login, attendre, DEMO_CLIENT, DEMO_VENDEUR,
} from './helpers.js';

const DEMO_LIVREUR = { email: 'livreur.demo@here.tn', password: 'LivreurDemo2026!' };

let client;
let vendeur;
let livreur;
let gouvernoratId;
let delegationId;
let models;

before(async () => {
  await startTestServer({ db: 'test-courier' });
  models = await import('../src/models/index.js');
  client = await login(DEMO_CLIENT);
  vendeur = await login(DEMO_VENDEUR);
  // Même connexion que l'app mobile : la route générique, pas /livreur/auth/login.
  livreur = await login(DEMO_LIVREUR);

  const gouvernorats = await api('/api/gouvernorats');
  gouvernoratId = gouvernorats.json.data[0].id;
  const delegations = await api(`/api/gouvernorats/${gouvernoratId}/delegations`);
  delegationId = delegations.json.data[0].id;
});

after(async () => {
  await stopTestServer();
});

async function commandeCodConfirmee() {
  const produit = await api(`/api/vendor/products/${vendeur.user.id}`, {
    method: 'POST',
    token: vendeur.token,
    body: { nom: `Produit livreur ${Date.now()}`, description: 'Produit de test livreur', prix: 40, stock: 10 },
  });
  assert.equal(produit.status, 201, JSON.stringify(produit.json));
  const { status, json } = await api('/api/commandes', {
    method: 'POST',
    token: client.token,
    body: {
      lignes: [{ produitId: produit.json.data.id, quantite: 1 }],
      adresseLivraison: '5 avenue Habib Bourguiba',
      gouvernoratId,
      delegationId,
      methodePaiement: 'cod',
    },
  });
  assert.equal(status, 201, JSON.stringify(json));
  const commande = await models.Commande.findByPk(json.data.commande.id);
  const confirmation = await api(`/api/commandes/confirmation/${commande.confirmationToken}`, {
    method: 'POST',
    body: { action: 'confirmer' },
  });
  assert.equal(confirmation.status, 200);
  return commande;
}

test('routes livreur réservées au rôle livreur', async () => {
  const r = await api('/api/livreur/courses', { token: client.token });
  assert.equal(r.status, 403);
});

test('inscription livreur : compte dédié, hors ligne par défaut, connexion générique', async () => {
  const email = `livreur.${Date.now()}@here.tn`;
  const r = await api('/api/livreur/register', {
    method: 'POST',
    body: { prenom: 'Sami', nom: 'Test', email, telephone: '22123456', password: 'Livreur2026', vehiculeType: 'velo' },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.user.role, 'livreur');
  assert.equal(r.json.profil.vehiculeType, 'velo');
  assert.equal(r.json.profil.statut, 'hors_ligne');

  const doublon = await api('/api/livreur/register', {
    method: 'POST',
    body: { prenom: 'Sami', nom: 'Test', email, telephone: '22123456', password: 'Livreur2026' },
  });
  assert.equal(doublon.status, 409);

  const session = await login({ email, password: 'Livreur2026' });
  const me = await api('/api/users/me', { token: session.token });
  assert.equal(me.json.data.role, 'livreur');
});

test('course COD : proposition, acceptation, retrait, preuve, livraison et gains', async () => {
  const t = livreur.token;
  assert.equal((await api('/api/livreur/statut', { method: 'PATCH', token: t, body: { statut: 'disponible' } })).status, 200);
  assert.equal((await api('/api/livreur/statut', { method: 'PATCH', token: t, body: { statut: 'en_vacances' } })).status, 400);
  const position = await api('/api/livreur/position', {
    method: 'PATCH', token: t, body: { latitude: 36.8065, longitude: 10.1815 },
  });
  assert.equal(position.status, 200);
  assert.equal((await api('/api/livreur/position', { method: 'PATCH', token: t, body: { latitude: '36' } })).status, 400);

  const commande = await commandeCodConfirmee();
  const livraison = await models.Livraison.findOne({ where: { commandeId: commande.id } });

  // Course libre visible avec le paiement : le livreur sait qu'il encaisse.
  const courses = await api('/api/livreur/courses', { token: t });
  const libre = courses.json.data.disponibles.find((c) => c.id === livraison.id);
  assert.ok(libre, 'course listée dans les disponibles');
  assert.deepEqual(libre.Commande.paiement, { methode: 'cod', statut: 'en_attente_livraison' });
  assert.equal(libre.Commande.adresseLivraison, '5 avenue Habib Bourguiba');

  // Expédition → cascade : la proposition attend le livreur.
  for (const statut of ['en_preparation', 'expedie']) {
    const r = await api(`/api/commandes/${commande.id}/livraison`, { method: 'PUT', token: vendeur.token, body: { statut } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  const offre = await attendre(async () => {
    const r = await api('/api/livreur/notifications/pending', { token: t });
    return r.json.data?.livraisonId === livraison.id ? r.json.data : null;
  });
  assert.ok(offre, 'proposition reçue');
  assert.ok(new Date(offre.expiresAt) > new Date());
  assert.equal(offre.adresseArrivee, '5 avenue Habib Bourguiba');

  const accept = await api(`/api/livreur/notifications/${offre.notificationId}/accepter`, { method: 'PATCH', token: t });
  assert.equal(accept.status, 200, JSON.stringify(accept.json));
  const deuxFois = await api(`/api/livreur/notifications/${offre.notificationId}/accepter`, { method: 'PATCH', token: t });
  assert.equal(deuxFois.status, 409);
  assert.equal((await api('/api/livreur/stats', { token: t })).json.data.statut, 'occupe');

  const enCours = (await api('/api/livreur/courses', { token: t })).json.data.enCours;
  assert.equal(enCours.find((c) => c.id === livraison.id)?.statutAssignation, 'assignee');

  // Colis récupéré → commande « en cours de livraison ».
  const retrait = await api(`/api/livreur/courses/${livraison.id}/statut`, { method: 'PATCH', token: t, body: { statut: 'en_cours' } });
  assert.equal(retrait.status, 200);
  assert.equal((await models.Commande.findByPk(commande.id)).statut, 'en_cours_livraison');

  // Preuve photo (multipart « preuve », comme l'app).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const form = new FormData();
  form.append('preuve', new Blob([png], { type: 'image/png' }), 'preuve.png');
  const preuve = await api(`/api/livreur/courses/${livraison.id}/preuve`, { method: 'POST', token: t, body: form });
  assert.equal(preuve.status, 201, JSON.stringify(preuve.json));
  assert.ok(preuve.json.data.preuveLivraison);

  // Livré : commande livrée, COD encaissé, livreur de nouveau disponible.
  const livre = await api(`/api/livreur/courses/${livraison.id}/statut`, { method: 'PATCH', token: t, body: { statut: 'livree' } });
  assert.equal(livre.status, 200);
  const finale = await models.Commande.findByPk(commande.id, { include: [{ model: models.Paiement, as: 'paiement' }] });
  assert.equal(finale.statut, 'livree');
  assert.equal(finale.paiement.statut, 'paye_livraison');

  const stats = (await api('/api/livreur/stats', { token: t })).json.data;
  assert.equal(stats.statut, 'disponible');
  assert.ok(stats.nombreLivraisons >= 1);
  assert.equal(stats.gainsJour, livraison.fraisLivraison);

  const historique = (await api('/api/livreur/historique', { token: t })).json.data;
  const ligne = historique.courses.find((c) => c.id === livraison.id);
  assert.equal(ligne.statutAssignation, 'livree');
  assert.ok(historique.gains >= livraison.fraisLivraison);
});

test('échec de livraison : la course retourne dans le pool', async () => {
  const t = livreur.token;
  const commande = await commandeCodConfirmee();
  const livraison = await models.Livraison.findOne({ where: { commandeId: commande.id } });
  for (const statut of ['en_preparation', 'expedie']) {
    await api(`/api/commandes/${commande.id}/livraison`, { method: 'PUT', token: vendeur.token, body: { statut } });
  }
  // Acceptation directe depuis la liste (sans passer par la proposition).
  const accept = await api(`/api/livreur/courses/${livraison.id}/accepter`, { method: 'PATCH', token: t });
  assert.equal(accept.status, 200, JSON.stringify(accept.json));
  assert.equal((await api(`/api/livreur/courses/${livraison.id}/accepter`, { method: 'PATCH', token: t })).status, 409);

  await api(`/api/livreur/courses/${livraison.id}/statut`, { method: 'PATCH', token: t, body: { statut: 'en_cours' } });
  const echec = await api(`/api/livreur/courses/${livraison.id}/statut`, { method: 'PATCH', token: t, body: { statut: 'echec' } });
  assert.equal(echec.status, 200);

  await livraison.reload();
  assert.equal(livraison.livreurId, null);
  assert.equal(livraison.statutAssignation, 'en_attente');
  assert.equal((await models.Commande.findByPk(commande.id)).statut, 'expediee');
});
