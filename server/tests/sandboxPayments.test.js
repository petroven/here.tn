// Paiement en ligne de bout en bout avec le prestataire sandbox — les 8
// scénarios de services/payments/SandboxMockProvider.js, puis la chaîne
// complète commande → paiement → webhook → confirmation → cashback →
// commission → solde vendeur. Aucune clé Konnect/Flouci nécessaire : quand
// elles arriveront, seul le format de leur webhook reste à brancher.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer, stopTestServer, api, login, attendre, DEMO_CLIENT, DEMO_VENDEUR,
} from './helpers.js';

let client;
let vendeur;
let produitId;
let gouvernoratId;
let delegationId;
let models;
let boutiqueId;

before(async () => {
  await startTestServer({ db: 'test-payments' });
  models = await import('../src/models/index.js');
  client = await login(DEMO_CLIENT);
  vendeur = await login(DEMO_VENDEUR);

  const produit = await api(`/api/vendor/products/${vendeur.user.id}`, {
    method: 'POST',
    token: vendeur.token,
    body: { nom: 'Produit paiement sandbox', description: 'Test paiement', prix: 120, stock: 500 },
  });
  produitId = produit.json.data.id;
  boutiqueId = produit.json.data.boutiqueId;

  const gouvernorats = await api('/api/gouvernorats');
  gouvernoratId = gouvernorats.json.data[0].id;
  const delegations = await api(`/api/gouvernorats/${gouvernoratId}/delegations`);
  delegationId = delegations.json.data[0].id;
});

after(async () => {
  await stopTestServer();
});

async function commandeEnLigne(quantite = 1) {
  const { status, json } = await api('/api/commandes', {
    method: 'POST',
    token: client.token,
    body: {
      lignes: [{ produitId, quantite }],
      adresseLivraison: '3 rue de Rome',
      gouvernoratId,
      delegationId,
      methodePaiement: 'carte',
    },
  });
  assert.equal(status, 201, JSON.stringify(json));
  return json.data.commande;
}

async function initier(commandeId, headers) {
  const r = await api('/api/payments/initiate', {
    method: 'POST', token: client.token, body: { commandeId, provider: 'sandbox' }, headers,
  });
  assert.ok([200, 201].includes(r.status), JSON.stringify(r.json));
  return r.json.data;
}

function simuler(commandeId, scenario, extra = {}) {
  return api('/api/payments/sandbox/simulate', {
    method: 'POST', token: client.token, body: { commandeId, scenario, ...extra },
  });
}

const statutCommande = async (id) => (await models.Commande.findByPk(id)).statut;
const statutTransaction = async (id) => (await models.Transaction.findByPk(id)).statut;
const cashbacks = (commandeId) => models.WalletTransaction.count({ where: { commandeId, motif: 'cashback' } });
const historiquePayee = (commandeId) => models.HistoriqueCommande.count({ where: { commandeId, nouveauStatut: 'payee' } });

test('SUCCESS : commande → paiement → webhook → payée → cashback → commission → solde vendeur', async () => {
  const { calculerFinancesBoutique } = await import('../src/utils/finance.js');
  const { marketplaceConfig } = await import('../src/config/marketplace.js');
  const financesAvant = await calculerFinancesBoutique(boutiqueId);
  const soldeClientAvant = Number((await models.Utilisateur.findByPk(client.user.id)).soldeWallet);

  const commande = await commandeEnLigne(2);
  // Non payée : pas encore de chiffre d'affaires pour le vendeur
  assert.equal((await calculerFinancesBoutique(boutiqueId)).totalVentesNettes, financesAvant.totalVentesNettes);

  const { transactionId } = await initier(commande.id);
  const sim = await simuler(commande.id, 'SUCCESS');
  assert.equal(sim.status, 200);
  assert.equal(sim.json.data.webhooks[0].status, 200);

  // Paiement confirmé
  assert.equal(await statutCommande(commande.id), 'payee');
  assert.equal(await statutTransaction(transactionId), 'validee');
  const paiement = await models.Paiement.findOne({ where: { commandeId: commande.id } });
  assert.equal(paiement.statut, 'valide');
  assert.equal(await historiquePayee(commande.id), 1);

  // Cashback : taux configuré × sous-total, crédité une seule fois
  const cashbackAttendu = Math.round(commande.sousTotal * marketplaceConfig.wallet.cashbackRate * 1000) / 1000;
  const soldeClientApres = Number((await models.Utilisateur.findByPk(client.user.id)).soldeWallet);
  assert.ok(Math.abs(soldeClientApres - soldeClientAvant - cashbackAttendu) < 0.001);
  assert.equal(await cashbacks(commande.id), 1);

  // Commission plateforme
  const commission = await models.Commission.findOne({ where: { commandeId: commande.id } });
  assert.ok(Math.abs(commission.montant - commande.sousTotal * marketplaceConfig.commissionRate) < 0.001);
  assert.ok(Math.abs(commande.montantVendeur - (commande.sousTotal - commission.montant)) < 0.001);

  // Solde vendeur : vente comptée, mais séquestrée tant que la fenêtre de
  // retour n'est pas écoulée après livraison
  const financesPayee = await calculerFinancesBoutique(boutiqueId);
  assert.ok(Math.abs(financesPayee.totalVentesNettes - financesAvant.totalVentesNettes - commande.montantVendeur) < 0.001);
  assert.equal(financesPayee.soldeDisponible, financesAvant.soldeDisponible);

  // Livraison, puis fenêtre de retour écoulée → montant libéré
  for (const statut of ['en_preparation', 'expedie', 'livre']) {
    const r = await api(`/api/commandes/${commande.id}/livraison`, { method: 'PUT', token: vendeur.token, body: { statut } });
    assert.equal(r.status, 200, `${statut} : ${JSON.stringify(r.json)}`);
  }
  assert.equal((await calculerFinancesBoutique(boutiqueId)).soldeDisponible, financesAvant.soldeDisponible, 'toujours séquestré juste après livraison');
  const il_y_a_60_jours = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  await models.Livraison.update({ dateLivraison: il_y_a_60_jours }, { where: { commandeId: commande.id } });
  const financesLiberees = await calculerFinancesBoutique(boutiqueId);
  assert.ok(Math.abs(financesLiberees.soldeDisponible - financesAvant.soldeDisponible - commande.montantVendeur) < 0.001);
  assert.equal(await cashbacks(commande.id), 1, 'la livraison ne recrédite pas de cashback pour un paiement en ligne');
});

test('initiation idempotente : deux appels rejouent la même transaction', async () => {
  const commande = await commandeEnLigne();
  const premier = await initier(commande.id);
  const second = await initier(commande.id);
  assert.equal(second.transactionId, premier.transactionId);
  assert.equal(second.replay, true);
  const avecCle = await initier(commande.id, { 'Idempotency-Key': `cle-${commande.id}` });
  const avecCleBis = await initier(commande.id, { 'Idempotency-Key': `cle-${commande.id}` });
  assert.equal(avecCleBis.transactionId, avecCle.transactionId);
});

test('FAILED : transaction en échec, commande non payée, nouvel essai possible puis réussi', async () => {
  const commande = await commandeEnLigne();
  const { transactionId } = await initier(commande.id);
  const sim = await simuler(commande.id, 'FAILED');
  assert.equal(sim.json.data.webhooks[0].status, 200);
  assert.equal(await statutTransaction(transactionId), 'echec');
  assert.equal(await statutCommande(commande.id), 'en_attente');
  assert.equal((await models.Paiement.findOne({ where: { commandeId: commande.id } })).statut, 'echec');
  assert.equal(await cashbacks(commande.id), 0);

  const notif = await attendre(async () => {
    const r = await api('/api/notifications?limit=50', { token: client.token });
    return r.json.data.find((n) => n.type === 'paiement_echoue' && n.data?.commandeId === commande.id);
  });
  assert.ok(notif, 'le client est prévenu de l\'échec');

  const nouvelEssai = await initier(commande.id);
  assert.notEqual(nouvelEssai.transactionId, transactionId, 'une nouvelle tentative est créée');
  await simuler(commande.id, 'SUCCESS');
  assert.equal(await statutCommande(commande.id), 'payee');
  assert.equal((await models.Paiement.findOne({ where: { commandeId: commande.id } })).statut, 'valide');
});

test('CANCELLED : transaction annulée, commande toujours en attente', async () => {
  const commande = await commandeEnLigne();
  const { transactionId } = await initier(commande.id);
  await simuler(commande.id, 'CANCELLED');
  assert.equal(await statutTransaction(transactionId), 'annulee');
  assert.equal(await statutCommande(commande.id), 'en_attente');
});

test('TIMEOUT : sans webhook, la transaction expire à la lecture du statut ; un webhook tardif est quand même honoré', async () => {
  const commande = await commandeEnLigne();
  const { transactionId } = await initier(commande.id);
  const sim = await simuler(commande.id, 'TIMEOUT');
  assert.deepEqual(sim.json.data.webhooks, []);

  const statutImmediat = await api(`/api/payments/${commande.id}/status`, { token: client.token });
  assert.equal(statutImmediat.json.data.transaction.statut, 'en_attente');

  // Vieillit la transaction au-delà de PAYMENT_TIMEOUT_MINUTES (30 par défaut)
  const ilYa31Minutes = new Date(Date.now() - 31 * 60 * 1000);
  await models.Transaction.sequelize.query('UPDATE "Transactions" SET "createdAt" = ? WHERE id = ?', { replacements: [ilYa31Minutes.toISOString(), transactionId] });

  const statutExpire = await api(`/api/payments/${commande.id}/status`, { token: client.token });
  assert.equal(statutExpire.json.data.transaction.statut, 'echec');
  assert.equal(await models.PaymentLog.count({ where: { transactionId, evenement: 'timeout' } }), 1);
  assert.equal(await statutCommande(commande.id), 'en_attente');

  // L'argent a pu être prélevé malgré tout : un webhook « validée » tardif
  // pour cette référence confirme la commande.
  await simuler(commande.id, 'SUCCESS');
  assert.equal(await statutCommande(commande.id), 'payee');
});

test('DUPLICATE_WEBHOOK : le second webhook est ignoré, aucun effet de bord rejoué', async () => {
  const commande = await commandeEnLigne();
  await initier(commande.id);
  const sim = await simuler(commande.id, 'DUPLICATE_WEBHOOK');
  const [premier, second] = sim.json.data.webhooks;
  assert.equal(premier.status, 200);
  assert.equal(premier.body.data.alreadyProcessed, undefined);
  assert.equal(second.status, 200);
  assert.equal(second.body.data.alreadyProcessed, true);

  assert.equal(await statutCommande(commande.id), 'payee');
  assert.equal(await cashbacks(commande.id), 1);
  assert.equal(await historiquePayee(commande.id), 1);
});

test('DUPLICATE_WEBHOOK concurrent : deux webhooks simultanés, un seul traitement', async () => {
  const commande = await commandeEnLigne();
  const { providerReference } = await initier(commande.id);
  const { getProvider } = await import('../src/services/payments/index.js');
  const [webhook] = getProvider('sandbox').construireWebhooks('SUCCESS', { providerReference, montant: commande.total });
  const { BASE_URL } = await import('./helpers.js');
  const envoyer = () => fetch(`${BASE_URL}/api/payments/webhook/sandbox`, { method: 'POST', headers: webhook.headers, body: webhook.rawBody })
    .then((r) => r.json());
  const reponses = await Promise.all([envoyer(), envoyer(), envoyer()]);
  assert.equal(reponses.filter((r) => r.success && !r.data.alreadyProcessed).length, 1, JSON.stringify(reponses));
  assert.equal(await cashbacks(commande.id), 1);
  assert.equal(await historiquePayee(commande.id), 1);
});

test('WEBHOOK_DELAYED : la commande reste en attente puis passe payée à réception', async () => {
  const commande = await commandeEnLigne();
  await initier(commande.id);
  const sim = await simuler(commande.id, 'WEBHOOK_DELAYED', { delayMs: 300 });
  assert.equal(sim.status, 202);

  const immediat = await api(`/api/payments/${commande.id}/status`, { token: client.token });
  assert.equal(immediat.json.data.commandeStatut, 'en_attente');

  const payee = await attendre(async () => (await statutCommande(commande.id)) === 'payee', { timeoutMs: 5000 });
  assert.ok(payee, 'la commande doit être payée après le webhook différé');
});

test('WRONG_AMOUNT : webhook rejeté (400), commande non payée, incident journalisé', async () => {
  const commande = await commandeEnLigne();
  const { transactionId } = await initier(commande.id);
  const sim = await simuler(commande.id, 'WRONG_AMOUNT');
  assert.equal(sim.json.data.webhooks[0].status, 400);
  assert.equal(await statutCommande(commande.id), 'en_attente');
  assert.equal(await statutTransaction(transactionId), 'en_attente');
  assert.equal(await models.PaymentLog.count({ where: { transactionId, statut: 'montant_invalide' } }), 1);
  assert.equal(await cashbacks(commande.id), 0);
});

test('INVALID_SIGNATURE : webhook rejeté (401), commande non payée, tentative journalisée', async () => {
  const commande = await commandeEnLigne();
  const { transactionId } = await initier(commande.id);
  const rejetsAvant = await models.PaymentLog.count({ where: { evenement: 'webhook_rejete' } });
  const sim = await simuler(commande.id, 'INVALID_SIGNATURE');
  assert.equal(sim.json.data.webhooks[0].status, 401);
  assert.equal(await statutCommande(commande.id), 'en_attente');
  assert.equal(await statutTransaction(transactionId), 'en_attente');
  assert.equal(await models.PaymentLog.count({ where: { evenement: 'webhook_rejete' } }), rejetsAvant + 1);
});

test('une commande déjà payée ne peut pas être payée à nouveau (409)', async () => {
  const commande = await commandeEnLigne();
  await initier(commande.id);
  await simuler(commande.id, 'SUCCESS');
  const r = await api('/api/payments/initiate', { method: 'POST', token: client.token, body: { commandeId: commande.id, provider: 'sandbox' } });
  assert.equal(r.status, 409);
});

test('le simulateur refuse un scénario inconnu et la commande d\'un autre client', async () => {
  const commande = await commandeEnLigne();
  await initier(commande.id);
  assert.equal((await simuler(commande.id, 'NIMPORTE_QUOI')).status, 400);
  const autre = await api('/api/payments/sandbox/simulate', {
    method: 'POST', token: vendeur.token, body: { commandeId: commande.id, scenario: 'SUCCESS' },
  });
  assert.equal(autre.status, 403);
});
