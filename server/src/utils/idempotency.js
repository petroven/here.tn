// Idempotence de la création de produit (en-tête « Idempotency-Key »).
//
// Sur réseau mobile, une requête peut aboutir côté serveur alors que la
// réponse se perd : le client réessaie et créerait un doublon. Le client
// envoie donc une clé unique par fiche ; si la même clé revient, on renvoie
// le produit déjà créé. Une requête encore en cours avec la même clé est
// attendue plutôt que rejouée.
//
// Registre en mémoire (process unique, comme importStore.js) : les clés
// expirent après TTL_MS, ce qui couvre largement les nouvelles tentatives.
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 20_000;
const store = new Map(); // `${scope}:${key}` → { promise, at }

function prune() {
  const now = Date.now();
  for (const [k, entry] of store) {
    if (now - entry.at > TTL_MS || store.size > MAX_ENTRIES) store.delete(k);
    else break; // Map garde l'ordre d'insertion : les suivantes sont plus récentes
  }
}

/**
 * Exécute `create` une seule fois par (scope, clé). Renvoie
 * `{ value, replayed }` : `replayed` vaut true si le résultat vient d'un appel
 * précédent. Sans clé valide, `create` est simplement appelé.
 */
export async function onceByKey(scope, key, create) {
  if (typeof key !== 'string' || key.length < 8 || key.length > 128) {
    return { value: await create(), replayed: false };
  }
  prune();
  const id = `${scope}:${key}`;
  const existing = store.get(id);
  if (existing) return { value: await existing.promise, replayed: true };

  const promise = create();
  store.set(id, { promise, at: Date.now() });
  try {
    return { value: await promise, replayed: false };
  } catch (error) {
    store.delete(id); // échec : la nouvelle tentative doit pouvoir recréer
    throw error;
  }
}

export function resetIdempotencyStore() {
  store.clear();
}
