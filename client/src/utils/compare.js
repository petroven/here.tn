import { useEffect, useState } from 'react';

// Liste de comparaison (jusqu'à 3 produits), gardée dans le navigateur pour
// survivre à la navigation et au rechargement. Un événement synchronise les
// composants qui l'affichent (cartes produit, barre du catalogue, page).
const KEY = 'compare';
const EVENT = 'compare-change';
export const MAX_COMPARE = 3;

function read() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(ids) ? ids.filter(Number.isInteger).slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function write(ids) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Stockage indisponible (navigation privée) : la liste vit le temps de la page.
  }
  memory = ids;
  window.dispatchEvent(new Event(EVENT));
}

let memory = null;
const current = () => memory ?? (memory = read());

export function useCompare() {
  const [ids, setIds] = useState(current);
  useEffect(() => {
    const sync = () => setIds(current());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  return {
    ids,
    isFull: ids.length >= MAX_COMPARE,
    has: (id) => ids.includes(id),
    // Renvoie false quand la liste est déjà pleine.
    toggle: (id) => {
      const list = current();
      if (list.includes(id)) {
        write(list.filter((item) => item !== id));
        return true;
      }
      if (list.length >= MAX_COMPARE) return false;
      write([...list, id]);
      return true;
    },
    clear: () => write([]),
  };
}
