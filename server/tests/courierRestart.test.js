// Cascade d'attribution des livreurs après un redémarrage du serveur (mise en
// veille Render, redéploiement) : les minuteurs en mémoire disparaissent, la
// cascade doit reprendre depuis les lignes NotificationLivreur sans bloquer la
// livraison ni re-solliciter un livreur. Redémarrage simulé par
// arreterCascades() (perte des minuteurs et de l'état) puis reprendreCascades().
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
let models;
let matching;
let gouvernoratId;
let delegationId;
const livreurs = []; // { token, profilId }

before(async () => {
  await startTestServer({ db: 'test-courier-restart' });
  models = await import('../src/models/index.js');
  matching = await import('../src/utils/courierMatching.js');
  client = await login(DEMO_CLIENT);
  vendeur = await login(DEMO_VENDEUR);

  const gouvernorats = await api('/api/gouvernorats');
  gouvernoratId = gouvernorats.json.data[0].id;
  const delegations = await api(`/api/gouvernorats/${gouvernoratId}/delegations`);
  delegationId = delegations.json.data[0].id;

  // Seuls deux livreurs dédiés sont disponibles, placés au point de retrait.
  const demo = await login(DEMO_LIVREUR);
  await api('/api/livreur/statut', { method: 'PATCH', token: demo.token, body: { statut: 'hors_ligne' } });
  const boutique = await models.Boutique.findOne({ where: { vendeurId: vendeur.user.id } });
  const position = { latitude: boutique?.latitude ?? 36.8065, longitude: boutique?.longitude ?? 10.1815 };
  for (const prenom of ['Amine', 'Bilel']) {
    const email = `${prenom.toLowerCase()}.${Date.now()}@here.tn`;
    const r = await api('/api/livreur/register', {
      method: 'POST',
      body: { prenom, nom: 'Reprise', email, telephone: '22123456', password: 'Livreur2026', vehiculeType: 'moto' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const { token } = await login({ email, password: 'Livreur2026' });
    assert.equal((await api('/api/livreur/statut', { method: 'PATCH', token, body: { statut: 'disponible' } })).status, 200);
    assert.equal((await api('/api/livreur/position', { method: 'PATCH', token, body: position })).status, 200);
    livreurs.push({ token, profilId: r.json.profil.id });
  }
});

after(async () => {
  await stopTestServer();
});

async function livraisonExpediee() {
  const produit = await api(`/api/vendor/products/${vendeur.user.id}`, {
    method: 'POST', token: vendeur.token, body: { nom: `Produit reprise ${Date.now()}`, description: 'Test reprise', prix: 30, stock: 10 },
  });
  const { json } = await api('/api/commandes', {
    method: 'POST',
    token: client.token,
    body: { lignes: [{ produitId: produit.json.data.id, quantite: 1 }], adresseLivraison: '2 rue de Rome', gouvernoratId, delegationId, methodePaiement: 'cod' },
  });
  const commande = await models.Commande.findByPk(json.data.commande.id);
  await api(`/api/commandes/confirmation/${commande.confirmationToken}`, { method: 'POST', body: { action: 'confirmer' } });
  for (const statut of ['en_preparation', 'expedie']) {
    const r = await api(`/api/commandes/${commande.id}/livraison`, { method: 'PUT', token: vendeur.token, body: { statut } });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  const livraison = await models.Livraison.findOne({ where: { commandeId: commande.id } });
  const premiere = await attendre(() => offreEnCours(livraison.id));
  assert.ok(premiere, 'première offre envoyée');
  return { livraison, premiere };
}

const offreEnCours = (livraisonId) => models.NotificationLivreur.findOne({ where: { livraisonId, statut: 'envoyee' } });
const offres = (livraisonId) => models.NotificationLivreur.findAll({ where: { livraisonId }, order: [['id', 'ASC']] });

// « Redémarrage » : minuteurs et état perdus ; l'offre a pu expirer pendant l'arrêt.
async function redemarrer(notification, { expireDansMs }) {
  matching.arreterCascades();
  await notification.update({ dateExpiration: new Date(Date.now() + expireDansMs) });
}

test('offre expirée pendant l’arrêt : reprise au démarrage, passage au livreur suivant, jamais deux fois le même', async () => {
  const { livraison, premiere } = await livraisonExpediee();

  await redemarrer(premiere, { expireDansMs: -1000 });
  assert.ok(await matching.reprendreCascades() >= 1);
  await premiere.reload();
  assert.equal(premiere.statut, 'expiree');
  const seconde = await attendre(() => offreEnCours(livraison.id));
  assert.ok(seconde, 'la cascade est restée bloquée');
  assert.notEqual(seconde.livreurId, premiere.livreurId);

  // Second redémarrage : les deux livreurs ont été sollicités, personne n'est relancé.
  await redemarrer(seconde, { expireDansMs: -1000 });
  await matching.reprendreCascades();
  await seconde.reload();
  assert.equal(seconde.statut, 'expiree');
  assert.equal(await offreEnCours(livraison.id), null);
  const parLivreur = (await offres(livraison.id)).map((o) => o.livreurId);
  assert.equal(new Set(parLivreur).size, parLivreur.length, `livreur sollicité deux fois : ${parLivreur}`);
});

test('offre encore valide au redémarrage : minuteur réarmé pour le temps restant', async () => {
  const { livraison, premiere } = await livraisonExpediee();

  await redemarrer(premiere, { expireDansMs: 400 });
  assert.ok(await matching.reprendreCascades() >= 1);
  await premiere.reload();
  assert.equal(premiere.statut, 'envoyee', 'offre encore valide expirée trop tôt');

  const suivante = await attendre(async () => {
    await premiere.reload();
    return premiere.statut === 'expiree' ? offreEnCours(livraison.id) : null;
  }, { timeoutMs: 4000 });
  assert.ok(suivante, 'le minuteur réarmé n’a pas fait avancer la cascade');
  assert.notEqual(suivante.livreurId, premiere.livreurId);
  matching.arreterCascades();
});

test('offre expirée constatée par le livreur (/notifications/pending) : la cascade avance aussi', async () => {
  const { livraison, premiere } = await livraisonExpediee();
  const livreur = livreurs.find((l) => l.profilId === premiere.livreurId);
  assert.ok(livreur, 'offre destinée à un livreur de test');

  await redemarrer(premiere, { expireDansMs: -1000 });
  const r = await api('/api/livreur/notifications/pending', { token: livreur.token });
  assert.equal(r.status, 200);
  assert.equal(r.json.data, null);

  const suivante = await attendre(() => offreEnCours(livraison.id));
  assert.ok(suivante, 'expiration constatée sans faire avancer la cascade');
  assert.notEqual(suivante.livreurId, premiere.livreurId);
  matching.arreterCascades();
});
