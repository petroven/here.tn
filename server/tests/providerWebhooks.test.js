// Webhooks Konnect et Flouci de bout en bout, au format de chaque prestataire
// (KonnectProvider / FlouciProvider.parseWebhookPayload), signés en HMAC
// comme le ferait le prestataire. Sans credentials réels : la transaction est
// créée directement en base, telle que /payments/initiate l'aurait laissée.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  startTestServer, stopTestServer, api, login, BASE_URL, DEMO_CLIENT, DEMO_VENDEUR,
} from './helpers.js';

const KONNECT_SECRET = 'test_konnect_webhook_secret';
const FLOUCI_SECRET = 'test_flouci_webhook_secret';

const PROVIDERS = {
  konnect: {
    header: 'x-konnect-signature',
    secret: KONNECT_SECRET,
    payload: (ref, montant, ok = true) => ({ payment_ref: ref, status: ok ? 'completed' : 'failed', amount: Math.round(montant * 1000) }),
  },
  flouci: {
    header: 'x-flouci-signature',
    secret: FLOUCI_SECRET,
    payload: (ref, montant, ok = true) => ({ payment_id: ref, status: ok ? 'SUCCESS' : 'FAILURE', amount: Math.round(montant * 1000) }),
  },
};

let client;
let models;
let commandeBody;

before(async () => {
  process.env.KONNECT_WEBHOOK_SECRET = KONNECT_SECRET;
  process.env.FLOUCI_WEBHOOK_SECRET = FLOUCI_SECRET;
  await startTestServer({ db: 'test-provider-webhooks' });
  models = await import('../src/models/index.js');
  client = await login(DEMO_CLIENT);
  const vendeur = await login(DEMO_VENDEUR);

  const produit = await api(`/api/vendor/products/${vendeur.user.id}`, {
    method: 'POST',
    token: vendeur.token,
    body: { nom: 'Produit webhook prestataire', description: 'Test webhook', prix: 80, stock: 500 },
  });
  const gouvernorats = await api('/api/gouvernorats');
  const gouvernoratId = gouvernorats.json.data[0].id;
  const delegations = await api(`/api/gouvernorats/${gouvernoratId}/delegations`);
  commandeBody = {
    lignes: [{ produitId: produit.json.data.id, quantite: 1 }],
    adresseLivraison: '8 rue de Marseille',
    gouvernoratId,
    delegationId: delegations.json.data[0].id,
    methodePaiement: 'carte',
  };
});

after(async () => {
  await stopTestServer();
});

async function transactionEnAttente(provider, statut = 'en_attente') {
  const { status, json } = await api('/api/commandes', { method: 'POST', token: client.token, body: commandeBody });
  assert.equal(status, 201, JSON.stringify(json));
  const commande = json.data.commande;
  const reference = `${provider.toUpperCase()}-${commande.id}-${crypto.randomUUID()}`;
  const transaction = await models.Transaction.create({
    commandeId: commande.id,
    utilisateurId: client.user.id,
    montant: Number(commande.total),
    provider,
    idempotencyKey: reference,
    providerReference: reference,
    statut,
  });
  return { commande, transaction, reference, montant: Number(commande.total) };
}

async function envoyerWebhook(provider, body, { secret = PROVIDERS[provider].secret } = {}) {
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const response = await fetch(`${BASE_URL}/api/payments/webhook/${provider}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [PROVIDERS[provider].header]: signature },
    body: rawBody,
  });
  return { status: response.status, json: await response.json().catch(() => null) };
}

const statutCommande = async (id) => (await models.Commande.findByPk(id)).statut;
const statutTransaction = async (id) => (await models.Transaction.findByPk(id)).statut;
const historiquePayee = (commandeId) => models.HistoriqueCommande.count({ where: { commandeId, nouveauStatut: 'payee' } });

for (const provider of Object.keys(PROVIDERS)) {
  const { payload } = PROVIDERS[provider];

  test(`${provider} : webhook signé valide → commande payée, doublon ignoré sans rejouer les effets`, async () => {
    const { commande, transaction, reference, montant } = await transactionEnAttente(provider);

    const premier = await envoyerWebhook(provider, payload(reference, montant));
    assert.equal(premier.status, 200, JSON.stringify(premier.json));
    assert.equal(await statutTransaction(transaction.id), 'validee');
    assert.equal(await statutCommande(commande.id), 'payee');

    const doublon = await envoyerWebhook(provider, payload(reference, montant));
    assert.equal(doublon.status, 200);
    assert.equal(doublon.json.data.alreadyProcessed, true);
    assert.equal(await historiquePayee(commande.id), 1, 'effets de bord rejoués par le doublon');
  });

  test(`${provider} : signature invalide → 401, commande non payée`, async () => {
    const { commande, transaction, reference, montant } = await transactionEnAttente(provider);
    const r = await envoyerWebhook(provider, payload(reference, montant), { secret: 'secret_falsifie' });
    assert.equal(r.status, 401);
    assert.equal(await statutTransaction(transaction.id), 'en_attente');
    assert.equal(await statutCommande(commande.id), 'en_attente');
  });

  test(`${provider} : montant incohérent → 400, commande non payée`, async () => {
    const { commande, transaction, reference, montant } = await transactionEnAttente(provider);
    const r = await envoyerWebhook(provider, payload(reference, montant - 1));
    assert.equal(r.status, 400);
    assert.equal(await statutTransaction(transaction.id), 'en_attente');
    assert.equal(await statutCommande(commande.id), 'en_attente');
  });

  test(`${provider} : paiement tardif après expiration → accepté, commande payée`, async () => {
    const { commande, transaction, reference, montant } = await transactionEnAttente(provider, 'echec');
    const r = await envoyerWebhook(provider, payload(reference, montant));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(await statutTransaction(transaction.id), 'validee');
    assert.equal(await statutCommande(commande.id), 'payee');
  });

  test(`${provider} : échec signalé → transaction en échec, commande non payée`, async () => {
    const { commande, transaction, reference, montant } = await transactionEnAttente(provider);
    const r = await envoyerWebhook(provider, payload(reference, montant, false));
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(await statutTransaction(transaction.id), 'echec');
    assert.equal(await statutCommande(commande.id), 'en_attente');
  });
}

test('production sans secret de webhook : la valeur publique du dépôt est refusée (401)', async () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, KONNECT: process.env.KONNECT_WEBHOOK_SECRET, FLOUCI: process.env.FLOUCI_WEBHOOK_SECRET };
  const fixtures = {
    konnect: await transactionEnAttente('konnect'),
    flouci: await transactionEnAttente('flouci'),
  };
  process.env.NODE_ENV = 'production';
  delete process.env.KONNECT_WEBHOOK_SECRET;
  delete process.env.FLOUCI_WEBHOOK_SECRET;
  try {
    const { paymentConfigWarnings } = await import('../src/services/payments/index.js');
    const warnings = paymentConfigWarnings().join('\n');
    assert.match(warnings, /KONNECT_WEBHOOK_SECRET absent/);
    assert.match(warnings, /FLOUCI_WEBHOOK_SECRET absent/);

    for (const [provider, publicSecret] of [['konnect', 'sandbox_konnect_webhook_secret'], ['flouci', 'sandbox_flouci_webhook_secret']]) {
      const { commande, transaction, reference, montant } = fixtures[provider];
      const r = await envoyerWebhook(provider, PROVIDERS[provider].payload(reference, montant), { secret: publicSecret });
      assert.equal(r.status, 401, `${provider} : webhook signé avec le secret public accepté en production`);
      assert.equal(await statutTransaction(transaction.id), 'en_attente');
      assert.equal(await statutCommande(commande.id), 'en_attente');
    }
  } finally {
    process.env.NODE_ENV = saved.NODE_ENV;
    process.env.KONNECT_WEBHOOK_SECRET = saved.KONNECT;
    process.env.FLOUCI_WEBHOOK_SECRET = saved.FLOUCI;
  }
});
