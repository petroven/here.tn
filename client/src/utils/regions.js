// Régions (gouvernorats) où au moins une boutique validée est installée,
// avec leurs nombres de boutiques et de produits — pour « Acheter par
// région » à l'accueil et le filtre Région du catalogue.
export function regionsFromBoutiques(boutiques = []) {
  const regions = new Map();
  for (const boutique of boutiques) {
    const gouvernorat = boutique.Gouvernorat;
    if (!gouvernorat) continue;
    const region = regions.get(gouvernorat.id) || { ...gouvernorat, boutiques: 0, produits: 0 };
    region.boutiques += 1;
    region.produits += boutique.nombreProduits || 0;
    regions.set(gouvernorat.id, region);
  }
  return [...regions.values()].sort((a, b) => b.produits - a.produits);
}
