// Délai de retour d'un produit : celui de sa catégorie (14 jours par défaut),
// que le vendeur peut seulement raccourcir, jamais allonger — même règle que
// server/src/utils/returnPolicy.js.
export function returnDays(product) {
  if (!product) return null;
  const base = Number.isFinite(product.categorie?.delaiRetourJours) ? product.categorie.delaiRetourJours : 14;
  const override = product.delaiRetourJoursOverride;
  return Number.isFinite(override) ? Math.max(0, Math.min(base, override)) : base;
}
