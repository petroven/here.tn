import { Livraison, Commande, Boutique, Gouvernorat, Delegation } from '../models/index.js';

/**
 * Géocodage des adresses de livraison (carte du suivi client, distance des
 * courses livreur) via Nominatim / OpenStreetMap : gratuit, sans clé.
 *
 * Politique d'usage Nominatim : au plus 1 requête/s, User-Agent identifiant
 * l'application, résultats mis en cache. D'où la file d'attente ci-dessous,
 * et le géocodage en tâche de fond (jamais dans le chemin d'une requête HTTP).
 *
 * Adresse introuvable → repli sur la délégation, puis le gouvernorat :
 * la précision obtenue est enregistrée pour que la carte l'indique.
 *
 * Désactivé pendant les tests et avec GEOCODING=off. NOMINATIM_URL permet de
 * pointer vers une instance auto-hébergée.
 */

const NOMINATIM_URL = (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'here.tn-marketplace/1.0 (contact@here.tn)';
const INTERVALLE_MS = 1100;

function actif() {
  return process.env.NODE_ENV !== 'test' && process.env.GEOCODING !== 'off';
}

const cache = new Map(); // requête normalisée → { latitude, longitude } | null
let file = Promise.resolve();
let dernierAppel = 0;

/** zone : { latitude, longitude, rayonDeg } — limite la recherche autour d'un point. */
async function interrogerNominatim(q, zone = null) {
  const viewbox = zone
    ? `&bounded=1&viewbox=${[
        zone.longitude - zone.rayonDeg,
        zone.latitude + zone.rayonDeg,
        zone.longitude + zone.rayonDeg,
        zone.latitude - zone.rayonDeg,
      ].map((n) => n.toFixed(4)).join(',')}`
    : '';
  const cle = `${q.trim().toLowerCase()}|${viewbox}`;
  if (cache.has(cle)) return cache.get(cle);

  // Sérialise les appels et respecte l'intervalle minimal entre deux requêtes.
  const resultat = file.then(async () => {
    const attente = dernierAppel + INTERVALLE_MS - Date.now();
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    dernierAppel = Date.now();
    try {
      const url = `${NOMINATIM_URL}/search?format=json&limit=1&countrycodes=tn&q=${encodeURIComponent(q)}${viewbox}`;
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fr' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return undefined; // erreur temporaire : pas de mise en cache
      const [premier] = await response.json();
      const point = premier ? { latitude: Number(premier.lat), longitude: Number(premier.lon) } : null;
      cache.set(cle, point);
      return point;
    } catch (error) {
      console.error('[GEOCODE] Échec Nominatim:', error.message);
      return undefined;
    }
  });
  file = resultat.catch(() => undefined);
  return resultat;
}

/**
 * Coordonnées d'une adresse tunisienne. La zone (délégation, sinon
 * gouvernorat) est localisée d'abord, puis l'adresse n'est cherchée que
 * dans cette zone : une « rue de Marseille » homonyme dans une autre ville
 * n'est jamais retenue. Adresse introuvable → centre de la zone.
 * Renvoie { latitude, longitude, precision }, null si rien n'est trouvé, ou
 * undefined si le service est indisponible (on réessaiera plus tard).
 */
export async function geocoderAdresse({ adresse, delegation, gouvernorat }) {
  if (!actif()) return undefined;

  let zone = null;
  if (delegation) {
    const point = await interrogerNominatim([delegation, gouvernorat, 'Tunisie'].filter(Boolean).join(', '));
    if (point === undefined) return undefined;
    if (point) zone = { ...point, precision: 'delegation', rayonDeg: 0.12 }; // ~13 km
  }
  if (!zone && gouvernorat) {
    const point = await interrogerNominatim(`${gouvernorat}, Tunisie`);
    if (point === undefined) return undefined;
    if (point) zone = { ...point, precision: 'gouvernorat', rayonDeg: 0.4 }; // ~45 km
  }

  if (adresse) {
    const point = await interrogerNominatim(adresse, zone);
    if (point === undefined) return undefined;
    if (point) return { ...point, precision: 'adresse' };
  }
  return zone ? { latitude: zone.latitude, longitude: zone.longitude, precision: zone.precision } : null;
}

async function nomsZone(gouvernoratId, delegationId) {
  const [gouvernorat, delegation] = await Promise.all([
    gouvernoratId ? Gouvernorat.findByPk(gouvernoratId, { attributes: ['nom'] }) : null,
    delegationId ? Delegation.findByPk(delegationId, { attributes: ['nom'] }) : null,
  ]);
  return { gouvernorat: gouvernorat?.nom, delegation: delegation?.nom };
}

const enCours = new Set();

/**
 * Géocode le départ (boutique) et l'arrivée (client) d'une livraison et les
 * enregistre. Une seule tentative aboutie par livraison (champ geocodage) ;
 * si Nominatim est injoignable, rien n'est marqué et on réessaiera.
 */
export async function geocoderLivraison(livraisonId) {
  if (!actif() || enCours.has(livraisonId)) return;
  enCours.add(livraisonId);
  try {
    const livraison = await Livraison.findByPk(livraisonId, {
      include: [{ model: Commande, include: [{ model: Boutique, as: 'boutique' }] }],
    });
    const commande = livraison?.Commande;
    if (!livraison || !commande || livraison.geocodage) return;

    const arrivee = await geocoderAdresse({
      adresse: commande.adresseLivraison,
      ...(await nomsZone(commande.gouvernoratId, commande.delegationId)),
    });
    if (arrivee === undefined) return;

    const boutique = commande.boutique;
    let depart = null;
    if (boutique?.latitude != null && boutique?.longitude != null) {
      depart = { latitude: boutique.latitude, longitude: boutique.longitude, precision: 'adresse' };
    } else if (boutique) {
      depart = await geocoderAdresse({
        adresse: boutique.adresse,
        ...(await nomsZone(boutique.gouvernoratId, boutique.delegationId)),
      });
      if (depart === undefined) return;
    }

    await livraison.update({
      latitudeArrivee: arrivee?.latitude ?? null,
      longitudeArrivee: arrivee?.longitude ?? null,
      latitudeDepart: depart?.latitude ?? null,
      longitudeDepart: depart?.longitude ?? null,
      geocodage: {
        arrivee: arrivee?.precision ?? 'introuvable',
        depart: depart?.precision ?? 'introuvable',
        date: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GEOCODE] Échec livraison', livraisonId, error.message);
  } finally {
    enCours.delete(livraisonId);
  }
}

/** Lance le géocodage en tâche de fond des livraisons qui n'en ont pas encore. */
export function planifierGeocodage(livraisons) {
  if (!actif()) return;
  for (const livraison of livraisons) {
    if (livraison && !livraison.geocodage) geocoderLivraison(livraison.id);
  }
}

/**
 * Données de la carte de suivi d'une commande : départ (boutique), arrivée
 * (client) et position du livreur assigné. null si rien à afficher.
 */
export function carteCommande(commande, suivi) {
  const livraison = commande?.livraison;
  if (!livraison) return null;
  const geo = livraison.geocodage || {};
  const point = (lat, lng, precision) =>
    lat != null && lng != null ? { latitude: lat, longitude: lng, precision: precision || 'adresse' } : null;

  const carte = {
    depart: point(livraison.latitudeDepart, livraison.longitudeDepart, geo.depart),
    arrivee: point(livraison.latitudeArrivee, livraison.longitudeArrivee, geo.arrivee),
    livreur: suivi?.position || null,
    boutique: commande.boutique?.nom || null,
  };
  return carte.depart || carte.arrivee || carte.livreur ? carte : null;
}
