// Static demo mode (VITE_DEMO_API=true, used by `npm run build:static`):
// answers the site's API calls from a snapshot of the seeded demo catalog so
// products and stores display on hosts that cannot run the Node API. Anything
// that needs the real server (login, cart checkout, dashboards) gets a clear
// 503 instead of a network error.
import snapshot from './snapshot.json';

const DEMO_MESSAGE = 'Version de démonstration statique : cette action nécessite le serveur.';

// Static hosts like the Claude Artifact preview only serve images from the
// page's own files, so the catalog's external photos are swapped for a
// generated card showing the product or store name in the brand palette.
const PALETTE = [['#C4532C', '#8F3A1E'], ['#1E1B18', '#3A342E'], ['#B8862E', '#7A5A1F'], ['#3F6B5A', '#264237'], ['#6B4A3A', '#43302A']];
const escapeXml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function placeholderImage(label, seed) {
  const [from, to] = PALETTE[Math.abs(seed) % PALETTE.length];
  const words = String(label).split(/\s+/);
  const lines = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && `${last} ${word}`.length <= 16) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const shown = lines.slice(0, 4);
  const startY = 450 - (shown.length - 1) * 38;
  const text = shown
    .map((line, i) => `<text x="450" y="${startY + i * 76}" text-anchor="middle" font-family="Schibsted Grotesk, Arial, sans-serif" font-size="62" font-weight="700" fill="#FFF8F1">${escapeXml(line)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="900" height="900" fill="url(#g)"/><circle cx="760" cy="150" r="220" fill="#FFF8F1" opacity="0.07"/><circle cx="120" cy="820" r="180" fill="#FFF8F1" opacity="0.06"/>${text}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const isExternal = (value) => typeof value === 'string' && /^https?:\/\//.test(value);

// Walks a saved response and replaces every external image field of a
// product or store with its generated card.
function localizeImages(value) {
  if (Array.isArray(value)) return value.map(localizeImages);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, field] of Object.entries(value)) out[key] = localizeImages(field);
  const label = value.nom || value.name;
  if (label) {
    for (const key of ['image', 'logo', 'bannière', 'photo']) {
      if (isExternal(out[key])) out[key] = placeholderImage(label, value.id || 0);
    }
    if (Array.isArray(out.images)) {
      out.images = out.images.map((image) => (isExternal(image) ? placeholderImage(label, value.id || 0) : image));
    }
  }
  return out;
}

snapshot.produits = localizeImages(snapshot.produits);
snapshot.responses = localizeImages(snapshot.responses);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Parent category id -> its own id plus its sub-categories', mirroring
// getProduits on the server.
const categoryIds = new Map();
for (const categorie of snapshot.responses['/categories']?.data || []) {
  categoryIds.set(categorie.id, [categorie.id, ...(categorie.sousCategories || []).map((child) => child.id)]);
}

const average = (produit) => (produit.note == null ? -1 : Number(produit.note));

function listProduits(params) {
  const page = Math.max(Number.parseInt(params.get('page'), 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(params.get('limit'), 10) || 24, 1), 60);
  const search = params.get('search')?.toLowerCase();
  const categoryId = Number(params.get('categoryId'));
  const storeId = Number(params.get('storeId'));
  const minPrice = params.get('minPrice');
  const maxPrice = params.get('maxPrice');
  const minRating = params.get('minRating');

  let rows = snapshot.produits.filter((produit) => {
    if (search && !`${produit.nom} ${produit.description || ''}`.toLowerCase().includes(search)) return false;
    if (categoryId && !(categoryIds.get(categoryId) || [categoryId]).includes(produit.categorieId)) return false;
    if (storeId && produit.boutiqueId !== storeId) return false;
    if (minPrice && produit.prix < Number(minPrice)) return false;
    if (maxPrice && produit.prix > Number(maxPrice)) return false;
    if (params.get('inStock') === 'true' && !(produit.stock > 0)) return false;
    if (params.get('promotion') === 'true' && !(produit.prixAvant > produit.prix)) return false;
    if (minRating && average(produit) < Number(minRating)) return false;
    return true;
  });

  const sort = params.get('sort') || 'newest';
  const byDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  const comparators = {
    price_asc: (a, b) => a.prix - b.prix,
    price_desc: (a, b) => b.prix - a.prix,
    rating: (a, b) => average(b) - average(a),
    best_sellers: (a, b) => -byDate(a, b),
    newest: byDate,
  };
  rows = [...rows].sort(comparators[sort] || byDate);

  const count = rows.length;
  return json({
    success: true,
    data: rows.slice((page - 1) * limit, page * limit),
    count,
    pagination: { page, limit, totalPages: Math.ceil(count / limit) },
  });
}

function handle(url, method) {
  const path = url.pathname.slice(url.pathname.indexOf('/api/') + 4).replace(/\/$/, '');
  if (method === 'GET') {
    if (path === '/produits') return listProduits(url.searchParams);
    if (path === '/wishlist' || path === '/wishlist/check') return json({ success: true, data: [] });
    const saved = snapshot.responses[path];
    if (saved) return json(saved);
  }
  return json({ success: false, message: DEMO_MESSAGE }, 503);
}

export function installDemoApi() {
  // Decorative photos hard-coded in the pages (hero, category banner) can't
  // load either; hide them so their colored backdrop shows instead of a
  // broken-image icon.
  document.addEventListener('error', (event) => {
    const target = event.target;
    if (target instanceof HTMLImageElement && isExternal(target.src)) target.style.visibility = 'hidden';
  }, true);

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (!url.pathname.includes('/api/')) return realFetch(input, init);
    const method = (init.method || (typeof input === 'string' ? 'GET' : input.method) || 'GET').toUpperCase();
    return handle(url, method);
  };
}
