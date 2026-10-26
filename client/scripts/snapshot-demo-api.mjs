// Captures the public, read-only API responses of a running server (seeded
// with the demo catalog) into src/demo/snapshot.json. The static build
// (`npm run build:static`) serves the site from that snapshot, since a static
// host such as the Claude Artifact preview cannot run the Node API.
//
// Usage: start the server (`npm --prefix server run start`), then
//   API=http://localhost:5000/api node scripts/snapshot-demo-api.mjs
import { writeFileSync } from 'node:fs';

const API = process.env.API || 'http://localhost:5000/api';

async function get(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

const responses = {};
const save = async (path) => {
  responses[path] = await get(path);
  return responses[path];
};

// The catalog is small, so every product list query is answered client-side
// from this one full list.
const produits = await get('/produits?limit=60');
if (produits.count > produits.data.length) {
  throw new Error(`Catalog has ${produits.count} products; the snapshot only captures ${produits.data.length}.`);
}

for (const path of ['/categories', '/boutiques', '/gouvernorats', '/config/payment-methods', '/coupons/actifs']) {
  await save(path);
}
for (const produit of produits.data) {
  await save(`/produits/${produit.id}`);
  await save(`/produits/${produit.id}/avis`);
}
for (const boutique of responses['/boutiques'].data) await save(`/boutiques/${boutique.id}`);
for (const gouvernorat of responses['/gouvernorats'].data) {
  await save(`/gouvernorats/${gouvernorat.id}/delegations`);
  await save(`/gouvernorats/${gouvernorat.id}/frais`);
}

const out = new URL('../src/demo/snapshot.json', import.meta.url);
writeFileSync(out, JSON.stringify({ produits: produits.data, responses }));
console.log(`Wrote ${Object.keys(responses).length} responses and ${produits.data.length} products to ${out.pathname}`);
