import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base de données isolée pour les tests : ne touche jamais data/marketplace.db
// (la vraie démo), ne se dispute pas son verrou de fichier avec un
// `npm run dev` déjà en cours. Doit être posé AVANT tout import qui charge
// (directement ou indirectement) config/database.js.
process.env.SQLITE_STORAGE = path.join(__dirname, '../data/test.db');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_ci_only';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let httpServer;
export let BASE_URL = '';

export async function startTestServer() {
  // Imports différés : doivent arriver après les process.env ci-dessus, et
  // dans CET ordre — server.js importe models/index.js avant config/database.js,
  // ce qui résout un import circulaire (Gouvernorat.js -> database.js pour
  // `sequelize`, database.js -> utils/seed.js -> models/index.js). Importer
  // database.js en premier ferait échouer ce cycle avec une ReferenceError
  // "Cannot access 'sequelize' before initialization".
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
}

export async function api(pathname, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

// Comptes de démonstration seedés automatiquement par syncDatabase() —
// identiques à ceux utilisés en dev (voir utils/seed.js).
export const DEMO_CLIENT = { email: 'client.demo@here.tn', password: 'ClientDemo2026!' };
