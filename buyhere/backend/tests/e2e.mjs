// Test de bout en bout de l'API BuyHere.
// Prérequis : base fraîchement seedée (npm run db:reset) et API lancée (npm run dev).
// Usage : npm run test:e2e   (API_URL=http://... pour une autre instance)
const API = process.env.API_URL ?? 'http://localhost:4000';
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} ${extra}`); }
};
async function call(method, path, { body, token, lang } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(lang ? { 'Accept-Language': lang } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

console.log('Catalogue');
let r = await call('GET', '/health'); ok(r.status === 200, 'GET /health');
r = await call('GET', '/home');
ok(r.status === 200 && r.data.banners.length === 3 && r.data.categories.length === 5, 'GET /home : 3 bannières, 5 catégories');
ok(r.data.flash.length > 0 && r.data.popular.length > 0 && r.data.newest.length === 10, 'GET /home : flash, populaires, nouveautés');
r = await call('GET', '/home', { lang: 'ar' });
ok(r.data.categories[0].name === 'أزياء', 'Accept-Language: ar renvoie les noms arabes');
r = await call('GET', '/categories'); ok(r.data.reduce((s, c) => s + c.productCount, 0) === 30, 'GET /categories : 30 produits au total');
r = await call('GET', '/products?limit=20'); ok(r.data.total === 30 && r.data.items.length === 20 && r.data.hasMore, 'Pagination page 1 (20/30, hasMore)');
r = await call('GET', '/products?limit=20&page=2'); ok(r.data.items.length === 10 && !r.data.hasMore, 'Pagination page 2 (10, fin)');
r = await call('GET', '/products?category=electronique&sort=price_asc');
ok(r.data.items.every((p, i, a) => i === 0 || a[i - 1].price <= p.price) && r.data.total === 6, 'Filtre catégorie + tri prix croissant');
r = await call('GET', '/products?minPrice=50000&maxPrice=100000');
ok(r.data.items.length > 0 && r.data.items.every((p) => p.price >= 50000 && p.price <= 100000), 'Filtre prix 50–100 DT');
r = await call('GET', '/products?q=casque'); ok(r.data.total >= 1 && /casque/i.test(r.data.items[0].name), 'Recherche « casque »');
r = await call('GET', '/products?minRating=4'); ok(r.data.items.every((p) => p.rating >= 4), 'Filtre note ≥ 4');
r = await call('GET', '/products?onSale=true'); ok(r.data.items.every((p) => p.compareAt > p.price), 'Filtre en promotion');
r = await call('GET', '/products?sort=bad'); ok(r.status === 400 && r.data.error.code === 'VALIDATION_ERROR', 'Tri invalide → 400 VALIDATION_ERROR');
r = await call('GET', '/products/suggestions?q=bas'); ok(r.data.length > 0, 'Suggestions « bas »');
r = await call('GET', '/products/t-shirt-coton-bio');
const tshirt = r.data;
ok(r.status === 200 && tshirt.variants.length === 12 && tshirt.options.sizes.length === 4 && tshirt.options.colors.length === 3, 'Détail produit avec variantes (4 tailles × 3 couleurs)');
ok(tshirt.similar.length > 0, 'Produits similaires');
r = await call('GET', '/products/nope'); ok(r.status === 404, 'Produit inexistant → 404');

console.log('Auth');
r = await call('POST', '/auth/login', { body: { identifier: 'client@buyhere.tn', password: 'mauvais' } });
ok(r.status === 401 && r.data.error.code === 'INVALID_CREDENTIALS', 'Mauvais mot de passe → 401');
r = await call('POST', '/auth/login', { body: { identifier: '22 123 456', password: 'BuyHere2026' } });
ok(r.status === 200 && r.data.accessToken, 'Connexion par téléphone (22 123 456)');
r = await call('POST', '/auth/login', { body: { identifier: 'client@buyhere.tn', password: 'BuyHere2026' } });
let { accessToken: token, refreshToken } = r.data; ok(r.status === 200, 'Connexion par email');
r = await call('POST', '/auth/register', { body: { firstName: 'Test', lastName: 'User', email: 'client@buyhere.tn', password: 'abcdef12' } });
ok(r.status === 409, 'Inscription email existant → 409');
r = await call('POST', '/auth/register', { body: { firstName: 'T', lastName: 'User', email: 'x', password: 'short' } });
ok(r.status === 400 && r.data.error.details.length >= 3, 'Inscription invalide → 400 avec détails');
const email = `e2e${Date.now()}@buyhere.tn`;
r = await call('POST', '/auth/register', { body: { firstName: 'Sami', lastName: 'Test', email, phone: '+216 98 765 432', password: 'Secret123' } });
ok(r.status === 201 && r.data.user.phone === '+21698765432', 'Inscription + normalisation du téléphone');
r = await call('GET', '/users/me'); ok(r.status === 401, 'Sans jeton → 401');
r = await call('GET', '/users/me', { token }); ok(r.data.email === 'client@buyhere.tn' && !('passwordHash' in r.data), 'GET /users/me sans hash');
r = await call('POST', '/auth/refresh', { body: { refreshToken } });
ok(r.status === 200 && r.data.refreshToken !== refreshToken, 'Refresh : rotation du jeton');
const newRefresh = r.data.refreshToken; token = r.data.accessToken;
r = await call('POST', '/auth/refresh', { body: { refreshToken } });
ok(r.status === 401 && r.data.error.code === 'REFRESH_REUSED', 'Réutilisation d’un refresh révoqué détectée');
r = await call('POST', '/auth/refresh', { body: { refreshToken: newRefresh } });
ok(r.status === 401, '… et toute la session est révoquée');
r = await call('POST', '/auth/login', { body: { identifier: 'client@buyhere.tn', password: 'BuyHere2026' } });
token = r.data.accessToken;

console.log('Mot de passe oublié');
r = await call('POST', '/auth/forgot-password', { body: { identifier: email } });
ok(r.status === 200 && /^\d{6}$/.test(r.data.devCode), 'Code à 6 chiffres généré');
const code = r.data.devCode;
r = await call('POST', '/auth/reset-password', { body: { identifier: email, code: code === '000000' ? '111111' : '000000', password: 'NewPass123' } });
ok(r.status === 400, 'Mauvais code → 400');
r = await call('POST', '/auth/reset-password', { body: { identifier: email, code, password: 'NewPass123' } });
ok(r.status === 200, 'Réinitialisation avec le bon code');
r = await call('POST', '/auth/login', { body: { identifier: email, password: 'NewPass123' } });
ok(r.status === 200, 'Connexion avec le nouveau mot de passe');

console.log('Panier & coupons');
await call('DELETE', '/cart', { token });
r = await call('POST', '/cart/items', { token, body: { productId: tshirt.id, quantity: 1 } });
ok(r.status === 400 && r.data.error.code === 'VARIANT_REQUIRED', 'Produit à variantes sans variante → VARIANT_REQUIRED');
const variant = tshirt.variants.find((v) => v.stock >= 3);
r = await call('POST', '/cart/items', { token, body: { productId: tshirt.id, variantId: variant.id, quantity: 2 } });
ok(r.status === 201 && r.data.itemCount === 2 && r.data.subtotal === 2 * variant.price, 'Ajout avec variante');
r = await call('POST', '/cart/items', { token, body: { productId: tshirt.id, variantId: variant.id, quantity: 1 } });
ok(r.data.items.length === 1 && r.data.items[0].quantity === 3, 'Même variante → quantité fusionnée');
r = await call('POST', '/cart/items', { token, body: { productId: tshirt.id, variantId: variant.id, quantity: 10 } });
ok(r.status === 400 && ['OUT_OF_STOCK'].includes(r.data.error.code), 'Au-delà du stock → OUT_OF_STOCK');
const headphones = (await call('GET', '/products/casque-bluetooth-anc')).data;
r = await call('POST', '/cart/items', { token, body: { productId: headphones.id, quantity: 1 } });
ok(r.data.items.length === 2 && r.data.shippingFee === 0, 'Ajout du casque, livraison gratuite (> 150 DT)');
r = await call('POST', '/cart/coupon', { token, body: { code: 'faux' } });
ok(r.status === 400 && r.data.error.code === 'COUPON_INVALID', 'Coupon invalide → 400');
r = await call('POST', '/cart/coupon', { token, body: { code: 'bienvenue10' } });
ok(r.status === 200 && r.data.discount === Math.min(Math.floor(r.data.subtotal * 0.1), 30000), 'Coupon BIENVENUE10 (-10 %, plafonné à 30 DT)');
const line = r.data.items.find((i) => i.productId === tshirt.id);
r = await call('PATCH', `/cart/items/${line.id}`, { token, body: { quantity: 1 } });
ok(r.data.items.find((i) => i.id === line.id).quantity === 1, 'Modifier la quantité');
const cartBefore = r.data;
ok(cartBefore.total === cartBefore.subtotal - cartBefore.discount + cartBefore.shippingFee, 'Total = sous-total − remise + livraison');

console.log('Adresses & commande');
r = await call('POST', '/users/me/addresses', { token, body: { fullName: 'Amira Ben Salah', phone: '98111222', governorate: 'Paris', city: 'X', street: 'Rue 1' } });
ok(r.status === 400, 'Gouvernorat inconnu → 400');
r = await call('GET', '/users/me/addresses', { token });
const address = r.data.find((a) => a.isDefault); ok(!!address, 'Adresse par défaut du compte démo');
const stockBefore = (await call('GET', '/products/casque-bluetooth-anc')).data.stock;
const variantStockBefore = (await call('GET', '/products/t-shirt-coton-bio')).data.variants.find((v) => v.id === variant.id).stock;
r = await call('POST', '/orders', { token, body: { addressId: address.id, paymentMethod: 'CASH_ON_DELIVERY', note: 'Appeler avant' } });
const order = r.data.order;
ok(r.status === 201 && /^BH-\d{8}-[0-9A-F]{4}$/.test(order.number), `Commande créée (${order?.number})`);
ok(order.total === cartBefore.total && order.discount === cartBefore.discount && order.couponCode === 'BIENVENUE10', 'Totaux de la commande = panier');
ok(order.status === 'PENDING' && order.history.length === 1 && r.data.payUrl === null, 'Statut En attente, paiement à la livraison');
r = await call('GET', '/cart', { token }); ok(r.data.items.length === 0 && r.data.couponCode === null, 'Panier vidé après commande');
ok((await call('GET', '/products/casque-bluetooth-anc')).data.stock === stockBefore - 1, 'Stock produit décrémenté');
ok((await call('GET', '/products/t-shirt-coton-bio')).data.variants.find((v) => v.id === variant.id).stock === variantStockBefore - 1, 'Stock variante décrémenté');
r = await call('POST', '/orders', { token, body: { addressId: address.id } });
ok(r.status === 400 && r.data.error.code === 'CART_EMPTY', 'Commander un panier vide → CART_EMPTY');
r = await call('GET', '/orders', { token }); ok(r.data.items[0].id === order.id && r.data.total >= 3, 'Historique des commandes');
r = await call('GET', '/orders?status=DELIVERED', { token }); ok(r.data.items.every((o) => o.status === 'DELIVERED'), 'Filtre par statut');
r = await call('POST', '/auth/login', { body: { identifier: email, password: 'NewPass123' } });
const otherToken = r.data.accessToken;
r = await call('GET', `/orders/${order.id}`, { token: otherToken }); ok(r.status === 404, 'Commande d’un autre client → 404');
r = await call('PATCH', `/orders/${order.id}/status`, { token, body: { status: 'CONFIRMED' } }); ok(r.status === 403, 'Changer le statut sans être admin → 403');

console.log('Suivi (admin) & annulation');
const admin = (await call('POST', '/auth/login', { body: { identifier: 'admin@buyhere.tn', password: 'BuyHere2026' } })).data.accessToken;
r = await call('PATCH', `/orders/${order.id}/status`, { token: admin, body: { status: 'DELIVERED' } });
ok(r.status === 400 && r.data.error.code === 'INVALID_TRANSITION', 'Transition En attente → Livrée refusée');
r = await call('PATCH', `/orders/${order.id}/status`, { token: admin, body: { status: 'CONFIRMED' } });
ok(r.status === 200 && r.data.status === 'CONFIRMED' && r.data.history.length === 2, 'Admin : Confirmée');
r = await call('POST', `/orders/${order.id}/cancel`, { token });
ok(r.status === 200 && r.data.status === 'CANCELLED', 'Client : annulation d’une commande confirmée');
ok((await call('GET', '/products/casque-bluetooth-anc')).data.stock === stockBefore, 'Stock restauré après annulation');
r = await call('POST', `/orders/${order.id}/cancel`, { token }); ok(r.status === 400, 'Double annulation refusée');
r = await call('GET', '/notifications', { token });
ok(r.data.items.some((n) => n.title.includes(order.number)) && r.data.unread > 0, 'Notifications de commande créées');
r = await call('POST', '/notifications/read-all', { token }); ok(r.status === 204, 'Tout marquer comme lu');
r = await call('GET', '/notifications/unread-count', { token }); ok(r.data.unread === 0, 'Compteur non lus = 0');

console.log('Paiement en ligne (sans clés sandbox)');
await call('POST', '/cart/items', { token, body: { productId: headphones.id, quantity: 1 } });
r = await call('POST', '/orders', { token, body: { addressId: address.id, paymentMethod: 'KONNECT' } });
ok(r.status === 201 && r.data.order.paymentStatus === 'PENDING' && r.data.payUrl === null, 'Commande Konnect créée même si la passerelle n’est pas configurée');
r = await call('POST', `/orders/${r.data.order.id}/pay`, { token });
ok(r.status === 503 && r.data.error.code === 'PAYMENT_UNAVAILABLE', 'Relance du paiement → 503 explicite');

console.log('Favoris & avis');
r = await call('PUT', `/favorites/${headphones.id}`, { token }); ok(r.status === 204, 'Ajouter un favori');
r = await call('PUT', `/favorites/${headphones.id}`, { token }); ok(r.status === 204, 'Ajout idempotent');
r = await call('GET', '/favorites/ids', { token }); ok(r.data.includes(headphones.id), 'Favori présent');
r = await call('GET', `/products/${headphones.slug}`, { token }); ok(r.data.isFavorite === true, 'isFavorite dans le détail');
r = await call('DELETE', `/favorites/${headphones.id}`, { token }); ok(r.status === 204, 'Retirer le favori');
r = await call('POST', '/reviews', { token, body: { productId: headphones.id, rating: 5 } });
ok(r.status === 403 && r.data.error.code === 'NOT_PURCHASED', 'Avis sans achat livré → 403');
const serum = (await call('GET', '/products/serum-vitamine-c')).data;
r = await call('POST', '/reviews', { token, body: { productId: serum.id, rating: 1, comment: 'Test e2e' } });
ok(r.status === 201, 'Avis sur un produit livré (commande démo)');
const after = (await call('GET', '/products/serum-vitamine-c')).data;
ok(after.ratingCount === serum.ratingCount && after.rating !== serum.rating, 'Note moyenne recalculée (avis mis à jour, pas dupliqué)');
r = await call('GET', `/reviews/product/${serum.id}`);
ok(r.data.items.length > 0 && Object.values(r.data.distribution).reduce((a, b) => a + b, 0) === r.data.total, 'Liste des avis + répartition des notes');

r = await call('GET', '/nope'); ok(r.status === 404 && r.data.error.code === 'ROUTE_NOT_FOUND', 'Route inconnue → 404 JSON');
console.log(`\n${pass} réussis, ${fail} échoués`);
process.exit(fail ? 1 : 0);
