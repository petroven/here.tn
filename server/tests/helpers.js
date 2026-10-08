import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base de données isolée pour les tests : ne touche jamais data/marketplace.db
// (la vraie démo), ne se dispute pas son verrou de fichier avec un
// `npm run dev` déjà en cours. Chaque fichier de test a SA base (node --test
// exécute les fichiers en parallèle) — voir startTestServer({ db }).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_ci_only';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PAYMENT_MODE = 'sandbox';
// SMTP injoignable immédiatement (connexion refusée) plutôt que le délai de
// connexion à smtp.ethereal.email : ~9 s économisées par commande créée.
process.env.SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
process.env.SMTP_PORT = process.env.SMTP_PORT || '9';

let httpServer;
export let BASE_URL = '';

export async function startTestServer({ db = 'test' } = {}) {
  // Doit être posé AVANT tout import qui charge (directement ou
  // indirectement) config/database.js — d'où les imports différés ci-dessous.
  const storage = path.join(__dirname, `../data/${db}.db`);
  fs.mkdirSync(path.dirname(storage), { recursive: true });
  fs.rmSync(storage, { force: true });
  process.env.SQLITE_STORAGE = storage;

  // Imports différés, dans CET ordre — server.js importe models/index.js
  // avant config/database.js, ce qui résout un import circulaire
  // (Gouvernorat.js -> database.js pour `sequelize`, database.js ->
  // utils/seed.js -> models/index.js). Importer database.js en premier ferait
  // échouer ce cycle avec une ReferenceError "Cannot access 'sequelize'
  // before initialization".
  const { default: app } = await import('../src/server.js');
  const { syncDatabase } = await import('../src/config/database.js');

  await syncDatabase();

  httpServer = http.createServer(app);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address();
  BASE_URL = `http://127.0.0.1:${port}`;
  return BASE_URL;
}

export async function stopTestServer() {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  const { arreterCascades } = await import('../src/utils/courierMatching.js');
  arreterCascades();
  const { default: sequelize } = await import('../src/config/database.js');
  await sequelize.close();
}

export async function api(pathname, { method = 'GET', token, body, headers = {} } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

export async function login({ email, password }) {
  const { status, json } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  if (status !== 200) throw new Error(`Connexion impossible pour ${email} : ${status} ${JSON.stringify(json)}`);
  return json;
}

/** Attend qu'une condition asynchrone devienne vraie (effets différés). */
export async function attendre(condition, { timeoutMs = 5000, intervalMs = 50 } = {}) {
  const debut = Date.now();
  for (;;) {
    const resultat = await condition();
    if (resultat) return resultat;
    if (Date.now() - debut > timeoutMs) return resultat;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// Comptes de démonstration seedés automatiquement par syncDatabase() —
// identiques à ceux utilisés en dev (voir utils/seed.js).
export const DEMO_CLIENT = { email: 'client.demo@here.tn', password: 'ClientDemo2026!' };
export const DEMO_VENDEUR = { email: 'boutique.admin@here.tn', password: 'BoutiqueDemo2026!' };
export const DEMO_ADMIN = { email: 'super.admin@here.tn', password: 'SuperAdminDemo2026!' };
