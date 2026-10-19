// Cycle de vie des commandes : machine d'états, historique, stock atomique
// (jamais négatif, restitué à l'annulation et au remboursement), alertes de
// stock faible, notifications, journal d'audit admin et statistiques vendeur.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer, stopTestServer, api, login, attendre, DEMO_CLIENT, DEMO_VENDEUR, DEMO_ADMIN,
} from './helpers.js';

let client;
let vendeur;
let admin;
let boutiqueId;
let gouvernoratId;
let delegationId;
let models;

before(async () => {
  await startTestServer({ db: 'test-lifecycle' });
  models = await import('../src/models/index.js');
  client = await login(DEMO_CLIENT);
  vendeur = await login(DEMO_VENDEUR);
  admin = await login(DEMO_ADMIN);

  const dashboard = await api(`/api/vendor/dashboard/${vendeur.user.id}`, { token: vendeur.token });
  boutiqueId = dashboard.json.data.boutique.id;

  const gouvernorats = await api('/api/gouvernorats');
  gouvernoratId = gouvernorats.json.data[0].id;
  const delegations = await api(`/api/gouvernorats/${gouvernoratId}/delegations`);
  delegationId = delegations.json.data[0].id;
});

after(async () => {
  await stopTestServer();
});

// Produit neuf, sans variantes, de la boutique du vendeur de démo — isolé des
// autres tests pour maîtriser son stock exactement.
async function creerProduit({ stock = 20, prix = 50 } = {}) {
  const { status, json } = await api(`/api/vendor/products/${vendeur.user.id}`, {
    method: 'POST',
    token: vendeur.token,
    body: { nom: `Produit test ${Date.now()}-${Math.random()}`, description: 'Produit de test automatisé', prix, stock },
  });
  assert.equal(status, 201, JSON.stringify(json));
  return json.data;
}

async function commander({ produitId, quantite = 1, methodePaiement = 'cod', token = client.token, invite = false }) {
  return api('/api/commandes', {
    method: 'POST',
    token: invite ? undefined : token,
    body: {
      lignes: [{ produitId, quantite }],
      adresseLivraison: '10 rue de Marseille',
      gouvernoratId,
      delegationId,
      methodePaiement,
      ...(invite ? { guestNom: 'Invite', guestPrenom: 'Concurrent', guestEmail: `inv.${Math.random()}@here.tn`, guestTelephone: '20000000' } : {}),
    },
  });
}

async function stockDe(produitId) {
  const produit = await models.Produit.findByPk(produitId);
  return produit.stock;
}

async function confirmerCod(commandeId) {
  const commande = await models.Commande.findByPk(commandeId);
  const { status } = await api(`/api/commandes/confirmation/${commande.confirmationToken}`, { method: 'POST', body: { action: 'confirmer' } });
  assert.equal(status, 200);
}

async function avancerLivraison(commandeId, statut, token = vendeur.token) {
  return api(`/api/commandes/${commandeId}/livraison`, { method: 'PUT', token, body: { statut } });
}

// --- Machine d'états -----------------------------------------------------

test('machine d\'états : transitions incohérentes refusées', async () => {
  const { peutTransitionner } = await import('../src/utils/orderStatus.js');
  // Interdites
  assert.equal(peutTransitionner('livree', 'payee'), false);
  assert.equal(peutTransitionner('annulee', 'expediee'), false);
  assert.equal(peutTransitionner('retournee', 'livree'), false);
  assert.equal(peutTransitionner('expediee', 'annulee'), false);
  assert.equal(peutTransitionner('livree', 'livree'), false);
  assert.equal(peutTransitionner('en_attente', 'retour'), false);
  // Autorisées
  assert.equal(peutTransitionner('en_attente', 'payee'), true);
  assert.equal(peutTransitionner('en_attente', 'preparation'), true, 'COD : préparation sans passer par payee');
  assert.equal(peutTransitionner('payee', 'expediee'), true);
  assert.equal(peutTransitionner('en_cours_livraison', 'expediee'), true, 'échec de livraison');
  assert.equal(peutTransitionner('livree', 'retour'), true);
  assert.equal(peutTransitionner('retour', 'retournee'), true);
  assert.equal(peutTransitionner('litige', 'livree'), true);
});

// --- Cycle complet COD + historique ---------------------------------------

test('commande COD : préparation → expédition → livraison, historique et notifications', async () => {
  const produit = await creerProduit();
  const { status, json } = await commander({ produitId: produit.id });
  assert.equal(status, 201, JSON.stringify(json));
  const commandeId = json.data.commande.id;

  // Expédition impossible avant confirmation du client (COD)
  assert.equal((await avancerLivraison(commandeId, 'expedie')).status, 409);
  await confirmerCod(commandeId);

  assert.equal((await avancerLivraison(commandeId, 'en_preparation')).status, 200);
  assert.equal((await avancerLivraison(commandeId, 'expedie')).status, 200);
  assert.equal((await avancerLivraison(commandeId, 'en_cours_livraison')).status, 200);
  assert.equal((await avancerLivraison(commandeId, 'livre')).status, 200);

  // Marche arrière refusée
  const retourArriere = await avancerLivraison(commandeId, 'en_preparation');
  assert.equal(retourArriere.status, 409);

  const historique = await api(`/api/commandes/${commandeId}/historique`, { token: client.token });
  assert.equal(historique.status, 200);
  const statuts = historique.json.data.historique.map((h) => h.nouveauStatut);
  assert.deepEqual(statuts, ['en_attente', 'en_attente', 'preparation', 'expediee', 'en_cours_livraison', 'livree']);
  assert.equal(historique.json.data.historique[0].ancienStatut, null);
  assert.match(historique.json.data.historique[1].commentaire, /confirmée par le client/);

  // Paiement COD encaissé à la livraison
  const commande = await models.Commande.findByPk(commandeId, { include: [{ model: models.Paiement, as: 'paiement' }] });
  assert.equal(commande.statut, 'livree');
  assert.equal(commande.paiement.statut, 'paye_livraison');

  const notifs = await attendre(async () => {
    const r = await api('/api/notifications?limit=50', { token: client.token });
    const types = r.json.data.filter((n) => n.data?.commandeId === commandeId).map((n) => n.type);
    return types.includes('commande_livree') ? types : null;
  });
  assert.ok(notifs, 'notification de livraison attendue');
  for (const type of ['commande_confirmee', 'commande_preparation', 'commande_expediee', 'livreur_en_route', 'commande_livree']) {
    assert.ok(notifs.includes(type), `notification ${type} manquante (${notifs.join(', ')})`);
  }

  // La chronologie est aussi jointe à « Mes commandes »
  const mesCommandes = await api('/api/commandes/mes-commandes', { token: client.token });
  const c = mesCommandes.json.data.find((x) => x.id === commandeId);
  assert.equal(c.historique.length, 6);
});

test('un vendeur ne peut pas faire avancer la livraison d\'une autre boutique (403)', async () => {
  const produit = await creerProduit();
  const { json } = await commander({ produitId: produit.id });
  const autreVendeur = await login({ email: 'vendeur1.demo@here.tn', password: 'VendeurDemo2026!' });
  const r = await avancerLivraison(json.data.commande.id, 'en_preparation', autreVendeur.token);
  assert.equal(r.status, 403);
  const leClient = await avancerLivraison(json.data.commande.id, 'en_preparation', client.token);
  assert.equal(leClient.status, 403);
});

test('une commande payable en ligne mais non payée ne peut pas être préparée (409)', async () => {
  const produit = await creerProduit();
  const { json } = await commander({ produitId: produit.id, methodePaiement: 'carte' });
  const r = await avancerLivraison(json.data.commande.id, 'en_preparation');
  assert.equal(r.status, 409);
  assert.match(r.json.message, /pas encore payée/);
});

// --- Stock ----------------------------------------------------------------

test('stock : deux achats simultanés du dernier article — un seul réussit, jamais de stock négatif', async () => {
  const produit = await creerProduit({ stock: 1 });
  const resultats = await Promise.all([
    commander({ produitId: produit.id, invite: true }),
    commander({ produitId: produit.id, invite: true }),
    commander({ produitId: produit.id, invite: true }),
  ]);
  const succes = resultats.filter((r) => r.status === 201);
  const refus = resultats.filter((r) => r.status !== 201);
  assert.equal(succes.length, 1, resultats.map((r) => `${r.status} ${r.json?.message}`).join(' | '));
  for (const r of refus) {
    assert.equal(r.status, 409, `refus attendu en 409 : ${r.status} ${r.json?.message}`);
    assert.match(r.json.message, /Stock insuffisant/);
  }
  assert.equal(await stockDe(produit.id), 0);
});

test('stock : quantité supérieure au stock refusée', async () => {
  const produit = await creerProduit({ stock: 2 });
  const r = await commander({ produitId: produit.id, quantite: 3 });
  assert.equal(r.status, 409);
  assert.equal(await stockDe(produit.id), 2);
});

test('stock : restauré à l\'annulation, mouvements journalisés, double annulation refusée', async () => {
  const produit = await creerProduit({ stock: 10 });
  const { json } = await commander({ produitId: produit.id, quantite: 3 });
  const commandeId = json.data.commande.id;
  assert.equal(await stockDe(produit.id), 7);

  const annulation = await api(`/api/commandes/${commandeId}/annuler`, { method: 'PUT', token: client.token });
  assert.equal(annulation.status, 200, JSON.stringify(annulation.json));
  assert.equal(await stockDe(produit.id), 10);

  const encore = await api(`/api/commandes/${commandeId}/annuler`, { method: 'PUT', token: client.token });
  assert.equal(encore.status, 400);
  assert.equal(await stockDe(produit.id), 10, 'une seconde annulation ne doit pas re-créditer le stock');

  const mouvements = await models.MouvementStock.findAll({ where: { produitId: produit.id }, order: [['id', 'ASC']] });
  assert.deepEqual(mouvements.map((m) => [m.motif, m.variation]), [['vente', -3], ['annulation', 3]]);
});

test('stock : refus de confirmation COD par le client restitue le stock', async () => {
  const produit = await creerProduit({ stock: 4 });
  const { json } = await commander({ produitId: produit.id, quantite: 2 });
  const commande = await models.Commande.findByPk(json.data.commande.id);
  const r = await api(`/api/commandes/confirmation/${commande.confirmationToken}`, { method: 'POST', body: { action: 'annuler' } });
  assert.equal(r.status, 200);
  assert.equal(await stockDe(produit.id), 4);
  assert.equal((await models.Commande.findByPk(commande.id)).statut, 'annulee');
});

test('stock faible : alerte vendeur au franchissement du seuil et filtres vendeur/admin', async () => {
  const produit = await creerProduit({ stock: 6 });
  await commander({ produitId: produit.id, quantite: 1 }); // 6 → 5 : seuil (5) franchi

  const alerte = await attendre(async () => {
    const r = await api('/api/notifications?limit=50', { token: vendeur.token });
    return r.json.data.find((n) => n.type === 'stock_faible' && n.data?.produitId === produit.id);
  });
  assert.ok(alerte, 'alerte stock faible attendue');
  assert.match(alerte.message, /Plus que 5/);

  const filtreVendeur = await api(`/api/vendor/products/${vendeur.user.id}?stock=faible`, { token: vendeur.token });
  assert.ok(filtreVendeur.json.data.some((p) => p.id === produit.id));
  assert.ok(filtreVendeur.json.data.every((p) => p.stock <= 5));

  const filtreAdmin = await api('/api/admin/products?stock=faible', { token: admin.token });
  assert.equal(filtreAdmin.status, 200);
  assert.ok(filtreAdmin.json.data.some((p) => p.id === produit.id));
  assert.ok(filtreAdmin.json.data.every((p) => p.stock <= 5));

  const stats = await api('/api/admin/stats', { token: admin.token });
  assert.ok(stats.json.data.products.lowStock >= 1);
});

// --- Retours ----------------------------------------------------------------

async function commandeLivree(produit, quantite = 1) {
  const { json } = await commander({ produitId: produit.id, quantite });
  const commandeId = json.data.commande.id;
  await confirmerCod(commandeId);
  for (const statut of ['en_preparation', 'expedie', 'livre']) {
    const r = await avancerLivraison(commandeId, statut);
    assert.equal(r.status, 200, `${statut} : ${JSON.stringify(r.json)}`);
  }
  return commandeId;
}

async function demanderRetour(commandeId) {
  const form = new FormData();
  form.append('commandeId', String(commandeId));
  form.append('motif', 'Produit arrivé cassé');
  form.append('motifCategorie', 'defaut');
  form.append('photos', new Blob([Buffer.from('fake-image')], { type: 'image/jpeg' }), 'photo.jpg');
  return api('/api/retours', { method: 'POST', token: client.token, body: form });
}

test('retour : commande en « retour », remboursement → « retournee », stock restitué et solde crédité', async () => {
  const produit = await creerProduit({ stock: 8 });
  const commandeId = await commandeLivree(produit, 2);
  assert.equal(await stockDe(produit.id), 6);

  const demande = await demanderRetour(commandeId);
  assert.equal(demande.status, 201, JSON.stringify(demande.json));
  assert.equal((await models.Commande.findByPk(commandeId)).statut, 'retour');

  const soldeAvant = Number((await models.Utilisateur.findByPk(client.user.id)).soldeWallet);
  const rembourse = await api(`/api/retours/${demande.json.data.id}/statut`, {
    method: 'PUT', token: vendeur.token, body: { statut: 'rembourse' },
  });
  assert.equal(rembourse.status, 200, JSON.stringify(rembourse.json));

  const commande = await models.Commande.findByPk(commandeId);
  assert.equal(commande.statut, 'retournee');
  assert.equal(await stockDe(produit.id), 8);
  const soldeApres = Number((await models.Utilisateur.findByPk(client.user.id)).soldeWallet);
  assert.ok(Math.abs(soldeApres - soldeAvant - Number(commande.total)) < 0.001);

  // Un retour clôturé ne peut plus être traité
  const encore = await api(`/api/retours/${demande.json.data.id}/statut`, { method: 'PUT', token: vendeur.token, body: { statut: 'rembourse' } });
  assert.equal(encore.status, 409);
  assert.equal(await stockDe(produit.id), 8);
});

test('retour refusé : la commande redevient « livree » et le client est notifié', async () => {
  const produit = await creerProduit();
  const commandeId = await commandeLivree(produit);
  const demande = await demanderRetour(commandeId);
  const refus = await api(`/api/retours/${demande.json.data.id}/statut`, {
    method: 'PUT', token: vendeur.token, body: { statut: 'refuse', commentaireVendeur: 'Produit utilisé' },
  });
  assert.equal(refus.status, 200);
  assert.equal((await models.Commande.findByPk(commandeId)).statut, 'livree');
  const notif = await attendre(async () => {
    const r = await api('/api/notifications?limit=50', { token: client.token });
    return r.json.data.find((n) => n.type === 'retour_refuse' && n.data?.commandeId === commandeId);
  });
  assert.ok(notif);
});

// --- Admin : statut manuel + audit -----------------------------------------

test('admin : changement de statut manuel journalisé, transition incohérente refusée', async () => {
  const produit = await creerProduit({ stock: 5 });
  const { json } = await commander({ produitId: produit.id, quantite: 2 });
  const commandeId = json.data.commande.id;

  const sansCommentaire = await api(`/api/admin/orders/${commandeId}/statut`, { method: 'PATCH', token: admin.token, body: { statut: 'annulee' } });
  assert.equal(sansCommentaire.status, 400);

  const incoherent = await api(`/api/admin/orders/${commandeId}/statut`, {
    method: 'PATCH', token: admin.token, body: { statut: 'livree', commentaire: 'test' },
  });
  assert.equal(incoherent.status, 200, 'en_attente → livree est un saut avant autorisé');

  const arriere = await api(`/api/admin/orders/${commandeId}/statut`, {
    method: 'PATCH', token: admin.token, body: { statut: 'payee', commentaire: 'retour arrière' },
  });
  assert.equal(arriere.status, 409);

  const journal = await api(`/api/admin/audit-logs?entite=Commande&entiteId=${commandeId}`, { token: admin.token });
  assert.equal(journal.status, 200);
  assert.equal(journal.json.data.length, 1, 'seule la transition réussie est journalisée');
  const entree = journal.json.data[0];
  assert.equal(entree.action, 'commande.statut');
  assert.equal(entree.acteurId, admin.user.id);
  assert.deepEqual(entree.avant, { statut: 'en_attente' });
  assert.deepEqual(entree.apres, { statut: 'livree' });

  const refuseAuClient = await api('/api/admin/audit-logs', { token: client.token });
  assert.equal(refuseAuClient.status, 403);
});

test('admin : annulation manuelle restitue le stock', async () => {
  const produit = await creerProduit({ stock: 5 });
  const { json } = await commander({ produitId: produit.id, quantite: 2 });
  const r = await api(`/api/admin/orders/${json.data.commande.id}/statut`, {
    method: 'PATCH', token: admin.token, body: { statut: 'annulee', commentaire: 'Fraude suspectée' },
  });
  assert.equal(r.status, 200);
  assert.equal(await stockDe(produit.id), 5);
});

test('admin : validation KYC et suspension de boutique journalisées et notifiées au vendeur', async () => {
  const boutique = await models.Boutique.findByPk(boutiqueId);
  await boutique.update({ kycStatut: 'en_attente', kycCin: '01234567', kycRib: '12345678901234567890' });

  const kyc = await api(`/api/admin/boutiques/${boutiqueId}/kyc`, { method: 'PATCH', token: admin.token, body: { kycStatut: 'valide' } });
  assert.equal(kyc.status, 200);
  const suspension = await api(`/api/admin/boutiques/${boutiqueId}/statut`, { method: 'PATCH', token: admin.token, body: { statut: 'suspendue' } });
  assert.equal(suspension.status, 200);
  await api(`/api/admin/boutiques/${boutiqueId}/statut`, { method: 'PATCH', token: admin.token, body: { statut: 'validee' } });

  const journal = await api(`/api/admin/audit-logs?entite=Boutique&entiteId=${boutiqueId}`, { token: admin.token });
  const actions = journal.json.data.map((e) => e.action);
  assert.ok(actions.includes('kyc.valider'));
  assert.ok(actions.includes('boutique.suspendue'));
  const kycEntree = journal.json.data.find((e) => e.action === 'kyc.valider');
  assert.equal(kycEntree.avant.kycStatut, 'en_attente');
  assert.equal(kycEntree.apres.kycStatut, 'valide');
  assert.equal(kycEntree.apres.kycDocumentCin, undefined, 'les documents KYC ne sont jamais copiés dans le journal');

  const notif = await attendre(async () => {
    const r = await api('/api/notifications?limit=50', { token: vendeur.token });
    return r.json.data.find((n) => n.type === 'kyc_valide');
  });
  assert.ok(notif);
});

// --- Statistiques vendeur --------------------------------------------------

test('statistiques vendeur : CA du jour, série quotidienne et indicateurs', async () => {
  const avant = await api(`/api/vendor/stats/${vendeur.user.id}`, { token: vendeur.token });
  assert.equal(avant.status, 200);
  const produit = await creerProduit({ prix: 100 });
  await commander({ produitId: produit.id, quantite: 2 });

  const apres = await api(`/api/vendor/stats/${vendeur.user.id}?jours=30`, { token: vendeur.token });
  const d = apres.json.data;
  assert.equal(d.serie.length, 30);
  assert.ok(Math.abs(d.aujourdHui.ca - avant.json.data.aujourdHui.ca - 200) < 0.001);
  assert.equal(d.aujourdHui.commandes, avant.json.data.aujourdHui.commandes + 1);
  assert.ok(d.semaine.ca >= d.aujourdHui.ca);
  assert.ok(d.mois.ca >= d.aujourdHui.ca);
  assert.equal(d.serie.at(-1).ca, d.aujourdHui.ca);
  for (const cle of ['panierMoyenMois', 'tauxRetour', 'commissions', 'soldeDisponible', 'sequestre', 'produitsVendusMois']) {
    assert.equal(typeof d[cle], 'number', cle);
  }

  const autreVendeur = await login({ email: 'vendeur1.demo@here.tn', password: 'VendeurDemo2026!' });
  const interdit = await api(`/api/vendor/stats/${vendeur.user.id}`, { token: autreVendeur.token });
  assert.equal(interdit.status, 403);
});

// --- Notifications & jetons push -------------------------------------------

test('notifications : jeton push, compteur non lues, marquer comme lu', async () => {
  const invalide = await api('/api/users/me/push-token', { method: 'PUT', token: client.token, body: { token: 'pas-un-jeton' } });
  assert.equal(invalide.status, 400);
  const valide = await api('/api/users/me/push-token', {
    method: 'PUT', token: client.token, body: { token: 'ExponentPushToken[test-123]', plateforme: 'android' },
  });
  assert.equal(valide.status, 200);
  assert.equal(await models.PushToken.count({ where: { utilisateurId: client.user.id } }), 1);

  const avant = await api('/api/notifications/non-lues', { token: client.token });
  assert.ok(avant.json.data.count > 0);
  const liste = await api('/api/notifications?limit=1', { token: client.token });
  const lue = await api(`/api/notifications/${liste.json.data[0].id}/lu`, { method: 'PATCH', token: client.token });
  assert.equal(lue.status, 200);
  const apres = await api('/api/notifications/non-lues', { token: client.token });
  assert.equal(apres.json.data.count, avant.json.data.count - 1);

  // Impossible de marquer la notification de quelqu'un d'autre
  const autre = await api(`/api/notifications/${liste.json.data[0].id}/lu`, { method: 'PATCH', token: vendeur.token });
  assert.equal(autre.status, 404);

  await api('/api/notifications/tout-lu', { method: 'PATCH', token: client.token });
  assert.equal((await api('/api/notifications/non-lues', { token: client.token })).json.data.count, 0);

  await api('/api/users/me/push-token', { method: 'DELETE', token: client.token, body: { token: 'ExponentPushToken[test-123]' } });
  assert.equal(await models.PushToken.count({ where: { utilisateurId: client.user.id } }), 0);
});

// --- TVA et timbre fiscal --------------------------------------------------

test('commande : timbre fiscal ajouté au total, TVA comprise détaillée', async () => {
  const { marketplaceConfig } = await import('../src/config/marketplace.js');
  const { tvaRate, timbreFiscal } = marketplaceConfig.fiscal;
  const produit = await creerProduit({ prix: 119 });
  const { status, json } = await commander({ produitId: produit.id, quantite: 2 });
  assert.equal(status, 201, JSON.stringify(json));

  const commande = await models.Commande.findByPk(json.data.commande.id, { include: [{ model: models.Paiement, as: 'paiement' }] });
  const ttcHorsTimbre = 238 + commande.fraisLivraison;
  assert.equal(commande.timbreFiscal, timbreFiscal);
  assert.ok(Math.abs(commande.total - (ttcHorsTimbre + timbreFiscal)) < 0.001, `total ${commande.total}`);
  const tvaAttendue = Math.round(((ttcHorsTimbre * tvaRate) / (1 + tvaRate)) * 1000) / 1000;
  assert.ok(Math.abs(commande.montantTva - tvaAttendue) < 0.001, `TVA ${commande.montantTva} ≠ ${tvaAttendue}`);
  // Le client paie le timbre (COD : montant encaissé à la livraison).
  assert.equal(commande.paiement.montant, commande.total);

  // Taux et timbre exposés aux récapitulatifs du panier (site et app).
  const config = await api('/api/config/payment-methods');
  assert.equal(config.json.data.tvaTaux, tvaRate);
  assert.equal(config.json.data.timbreFiscal, timbreFiscal);

  // Facture PDF générée avec les nouvelles lignes.
  const facture = await fetch(`${(await import('./helpers.js')).BASE_URL}/api/commandes/${commande.id}/facture`, {
    headers: { Authorization: `Bearer ${client.token}` },
  });
  assert.equal(facture.status, 200);
  assert.match(facture.headers.get('content-type'), /pdf/);
});

test('finances vendeur : le timbre fiscal ne compte pas dans les ventes', async () => {
  const { calculerFinancesBoutique } = await import('../src/utils/finance.js');
  const avant = await calculerFinancesBoutique(boutiqueId);
  const produit = await creerProduit({ prix: 30 });
  const { json } = await commander({ produitId: produit.id, methodePaiement: 'konnect' });
  const commande = await models.Commande.findByPk(json.data.commande.id, { include: [{ model: models.Paiement, as: 'paiement' }] });
  await commande.paiement.update({ statut: 'valide' });
  await commande.update({ statut: 'payee' });
  const apres = await calculerFinancesBoutique(boutiqueId);
  const hausse = Math.round((apres.totalVentesBrutes - avant.totalVentesBrutes) * 1000) / 1000;
  assert.equal(hausse, Math.round((commande.total - commande.timbreFiscal) * 1000) / 1000);
});

test('produit vendeur : prix ou stock invalides refusés à la création et à la modification', async () => {
  const url = `/api/vendor/products/${vendeur.user.id}`;
  for (const body of [
    { nom: 'Prix négatif', description: 'x', prix: -10, stock: 5 },
    { nom: 'Prix texte', description: 'x', prix: 'abc', stock: 1 },
    { nom: 'Stock négatif', description: 'x', prix: 10, stock: -3 },
    { nom: 'Stock décimal', description: 'x', prix: 10, stock: 1.5 },
    { nom: 'Variante négative', description: 'x', prix: 10, variantes: [{ taille: 'M', stock: -1 }] },
  ]) {
    const { status, json } = await api(url, { method: 'POST', token: vendeur.token, body });
    assert.equal(status, 400, `${body.nom} : ${JSON.stringify(json)}`);
  }
  const produit = await creerProduit({ prix: 20 });
  const maj = await api(`/api/vendor/products/${produit.id}`, { method: 'PUT', token: vendeur.token, body: { prix: -5 } });
  assert.equal(maj.status, 400);
  assert.equal((await models.Produit.findByPk(produit.id)).prix, 20);
});
