import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink } from 'lucide-react';

// Rayon du cercle « zone approximative » quand l'adresse exacte n'a pas été trouvée.
const APPROX_RADIUS_M = { delegation: 1500, gouvernorat: 8000 };

const pin = (emoji, bg, pulse = false) => L.divIcon({
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:17px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:17px;background:${bg}"${pulse ? ' class="animate-pulse"' : ''}>${emoji}</div>`,
});

const POINTS = [
  { key: 'depart', emoji: '🏪', bg: '#1E1B18' },
  { key: 'arrivee', emoji: '🏠', bg: '#16A34A' },
  { key: 'livreur', emoji: '🛵', bg: '#C4532C', pulse: true },
];

/**
 * Carte de suivi d'une commande (Leaflet / OpenStreetMap, sans clé API) :
 * boutique, adresse de livraison géocodée et position du livreur. Les
 * données viennent de `commande.carte` (server/src/utils/geocode.js).
 */
export default function OrderMap({ carte, language = 'fr' }) {
  const tr = (fr, ar) => (language === 'ar' ? ar : fr);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({});
  const fittedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
      fittedRef.current = false;
    };
  }, []);

  // Mise à jour des points sans recréer la carte (le livreur se déplace).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !carte) return;
    const coords = [];
    for (const { key, emoji, bg, pulse } of POINTS) {
      layersRef.current[key]?.remove();
      delete layersRef.current[key];
      const p = carte[key];
      if (!p) continue;
      const group = L.layerGroup();
      if (APPROX_RADIUS_M[p.precision]) {
        L.circle([p.latitude, p.longitude], { radius: APPROX_RADIUS_M[p.precision], color: bg, weight: 1, fillOpacity: 0.12 }).addTo(group);
      }
      L.marker([p.latitude, p.longitude], { icon: pin(emoji, bg, pulse) }).addTo(group);
      group.addTo(map);
      layersRef.current[key] = group;
      coords.push([p.latitude, p.longitude]);
    }
    if (!coords.length) return;
    if (!fittedRef.current || carte.livreur) {
      if (coords.length === 1) map.setView(coords[0], 14);
      else map.fitBounds(coords, { padding: [40, 40], maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [carte]);

  if (!carte) return null;
  const arrivee = carte.arrivee;
  const approx = arrivee && arrivee.precision && arrivee.precision !== 'adresse';
  const cible = carte.livreur || arrivee || carte.depart;
  const zone = arrivee?.precision === 'delegation' ? tr('délégation', 'المعتمدية') : tr('gouvernorat', 'الولاية');

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{tr('Suivi sur la carte', 'التتبع على الخريطة')}</p>
      <div ref={containerRef} className="relative z-0 h-64 w-full overflow-hidden rounded-xl bg-slate-100" />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
        {carte.depart && <span>🏪 {carte.boutique || tr('Boutique', 'المتجر')}</span>}
        {arrivee && <span>🏠 {tr('Votre adresse', 'عنوانك')}</span>}
        {carte.livreur && <span>🛵 {tr('Votre livreur', 'المُوصِّل')}</span>}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {approx
          ? tr(`Adresse exacte introuvable sur la carte : zone approximative (${zone}).`, `لم يتم العثور على العنوان بدقة: منطقة تقريبية (${zone}).`)
          : arrivee
            ? tr("Position de votre adresse estimée d'après le texte saisi.", 'موقع عنوانك تقديري حسب النص المُدخل.')
            : tr('Localisation de votre adresse en cours…', 'جارٍ تحديد موقع عنوانك…')}
      </p>
      {cible && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${cible.latitude},${cible.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800"
        >
          <ExternalLink size={13} /> {tr('Ouvrir dans Google Maps', 'فتح في خرائط Google')}
        </a>
      )}
    </div>
  );
}
