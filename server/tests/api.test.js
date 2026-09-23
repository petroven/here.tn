// Suite de tests automatisés minimale (item 6 du chantier "produit
// utilisable") : couvre les parcours les plus critiques à ne jamais
// régresser silencieusement — auth, panier invité, commande COD, avis après
// livraison, routes publiques. Tourne contre une base SQLite isolée
// (voir helpers.js), recréée et re-seedée à chaque exécution.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, stopTestServer, api, DEMO_CLIENT } from './helpers.js';

let produitId;
let gouvernoratId;
let delegationId;

before(async () => {
  await startTestServer();

  const produits = await api('/api/produits?limit=1');
  produitId = produits.json.data[0].id;

  const gouvernorats = await api('/api/gouvernorats');
  gouvernoratId = gouvernorats.json.data[0].id;

  const delegations = await api(`/api/gouvernorats/${gouvernoratId}/delegations`);
  delegationId = delegations.json.data[0].id;
});

after(async () => {
  await stopTestServer();
});

// --- Routes publiques (aucune connexion requise) -------------------------

test('GET /api/categories renvoie les 12 univers reels', async () => {
  const { status, json } = await api('/api/categories');
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.equal(json.data.length, 12);
});

test('GET /api/produits renvoie le catalogue de demonstration', async () => {
  const { status, json } = await api('/api/produits');
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.ok(json.data.length > 0, 'le catalogue de demo ne doit jamais etre vide');
});

test('GET /api/boutiques renvoie les boutiques validees', async () => {
  const { status, json } = await api('/api/boutiques');
  assert.equal(status, 200);
  assert.equal(json.success, true);
  assert.ok(json.data.length > 0);
});

// --- Authentification ------------------------------------------------------

test('inscription puis connexion avec les memes identifiants', async () => {
  const email = `test.auto.${Date.now()}@here.tn`;
  const register = await api('/api/auth/register', {
    method: 'POST',
    body: {
      nom: 'Test', prenom: 'Auto', email, password: 'MotDePasse123',
      accepteConditions: true,
    },
  });
  assert.equal(register.status, 201);
  assert.equal(register.json.success, true);
  assert.ok(register.json.token);

  const login = await api('/api/auth/login', { method: 'POST', body: { email, password: 'MotDePasse123' } });
  assert.equal(login.status, 200);
  assert.equal(login.json.success, true);
});

test('inscription refusee sans acceptation des conditions', async () => {
  const { status, json } = await api('/api/auth/register', {
    method: 'POST',
    body: { nom: 'Test', prenom: 'Sans', email: `sans.conditions.${Date.now()}@here.tn`, password: 'MotDePasse123' },
  });
  assert.equal(status, 400);
  assert.equal(json.success, false);
});

test('email deja utilise refuse (409)', async () => {
  const { status } = await api('/api/auth/register', {
    method: 'POST',
    body: { nom: 'Doublon', prenom: 'Test', email: DEMO_CLIENT.email, password: 'AutreMotDePasse1', accepteConditions: true },
  });
  assert.equal(status, 409);
});

test('mot de passe incorrect refuse (401)', async () => {
  const { status, json } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: DEMO_CLIENT.email, password: 'MauvaisMotDePasse' },
  });
  assert.equal(status, 401);
  assert.equal(json.success, false);
});

// --- Panier invite / checkout sans compte -----------------------------------

test('commande invite acceptee sans jeton, avec les champs invite requis', async () => {
  const { status, json } = await api('/api/commandes', {
    method: 'POST',
    body: {
      lignes: [{ produitId, quantite: 1 }],
      adresseLivraison: '12 rue de la Republique',
      gouvernoratId,
      delegationId,
      methodePaiement: 'cod',
      guestNom: 'Invite', guestPrenom: 'Test', guestEmail: `invite.${Date.now()}@here.tn`, guestTelephone: '20123456',
    },
  });
  assert.equal(status, 201, JSON.stringify(json));
  assert.equal(json.success, true);
  assert.equal(json.data.commande.clientId, null);
  assert.equal(json.data.commande.guestNom, 'Invite');
});

test('commande invite refusee sans les champs invite (400)', async () => {
  const { status, json } = await api('/api/commandes', {
    method: 'POST',
    body: {
      lignes: [{ produitId, quantite: 1 }],
      adresseLivraison: '12 rue de la Republique',
      gouvernoratId,
      delegationId,
      methodePaiement: 'cod',
    },
  });
  assert.equal(status, 400);
  assert.equal(json.success, false);
});

// --- Commande authentifiee + avis apres livraison ---------------------------

test('commande COD authentifiee, puis avis produit apres livraison', async () => {
  const login = await api('/api/auth/login', { method: 'POST', body: DEMO_CLIENT });
  assert.equal(login.status, 200);
  const { token, user } = login.json;

  const order = await api('/api/commandes', {
    method: 'POST',
    token,
    body: {
      lignes: [{ produitId, quantite: 1 }],
      adresseLivraison: '5 avenue Habib Bourguiba',
      gouvernoratId,
      delegationId,
      methodePaiement: 'cod',
    },
  });
  assert.equal(order.status, 201, JSON.stringify(order.json));
  assert.equal(order.json.data.commande.clientId, user.id);
  const commandeId = order.json.data.commande.id;

  // Un avis sur une commande pas encore livree doit etre refuse.
  const avisTropTot = await api('/api/avis', {
    method: 'POST', token,
    body: { produitId, commandeId, note: 5, commentaire: 'Trop tot.' },
  });
  assert.equal(avisTropTot.status, 403);

  // La transition vers "livree" passe par le flux livreur/socket (hors
  // perimetre de ce test) — on la simule directement en base, comme le
  // ferait la derniere etape reelle de la livraison.
  const { Commande } = await import('../src/models/index.js');
  await Commande.update({ statut: 'livree' }, { where: { id: commandeId } });

  const mesCommandes = await api('/api/commandes/mes-commandes', { token });
  const commandeLivree = mesCommandes.json.data.find((c) => c.id === commandeId);
  assert.equal(commandeLivree.statut, 'livree');

  const avis = await api('/api/avis', {
    method: 'POST', token,
    body: { produitId, commandeId, note: 5, commentaire: 'Tres bon produit, conforme a la description.' },
  });
  assert.equal(avis.status, 201, JSON.stringify(avis.json));

  // Un second avis sur la meme commande/produit doit etre refuse (409).
  const doublon = await api('/api/avis', {
    method: 'POST', token,
    body: { produitId, commandeId, note: 4, commentaire: 'Deuxieme avis.' },
  });
  assert.equal(doublon.status, 409);
});

test('un vendeur ne peut pas passer commande (400)', async () => {
  const login = await api('/api/auth/login', { method: 'POST', body: { email: 'vendeur1.demo@here.tn', password: 'VendeurDemo2026!' } });
  assert.equal(login.status, 200);

  const { status, json } = await api('/api/commandes', {
    method: 'POST',
    token: login.json.token,
    body: {
      lignes: [{ produitId, quantite: 1 }],
      adresseLivraison: '5 avenue Habib Bourguiba',
      gouvernoratId,
      delegationId,
      methodePaiement: 'cod',
    },
  });
  assert.equal(status, 400);
  assert.equal(json.success, false);
});
