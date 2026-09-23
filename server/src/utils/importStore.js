import { cleanupImagePaths } from './productImport.js';

// Registre en mémoire des imports en attente de confirmation (écran de
// prévisualisation) — process unique (SQLite/Node single-instance, voir
// config/database.js), donc pas besoin d'un store partagé type Redis pour ce
// MVP. Une entrée expire après TTL_MS si le vendeur ne valide ni n'annule
// l'import, pour ne jamais laisser de fichiers temporaires orphelins.
const TTL_MS = 30 * 60 * 1000;
const store = new Map();

export function createImport(id, data) {
  store.set(id, { ...data, createdAt: Date.now() });
}

export function getImport(id) {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    discardImport(id);
    return null;
  }
  return entry;
}

export function discardImport(id) {
  const entry = store.get(id);
  if (!entry) return;
  store.delete(id);
  cleanupImagePaths(entry.imagesByReference);
}

const sweepInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) discardImport(id);
  }
}, 5 * 60 * 1000);
sweepInterval.unref();
