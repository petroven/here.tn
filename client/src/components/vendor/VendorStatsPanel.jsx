import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Table2, BarChart3, AlertTriangle } from 'lucide-react';
import { API_URL } from '../../config/api.js';

const BRAND = '#C4532C';
const fmt = (v) => Number(v || 0).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

// Graduations « propres » (0 / 50 / 100…) couvrant le maximum de la série.
function graduations(max) {
  if (max <= 0) return [0, 1];
  const brut = max / 4;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut);
  const ticks = [];
  for (let v = 0; v <= max + pas * 0.001; v += pas) ticks.push(Math.round(v * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + pas);
  return ticks;
}

/**
 * CA quotidien en colonnes (une seule série → pas de légende, le titre la
 * nomme). Colonnes ≤ 24px à bout arrondi, grille hairline, infobulle au
 * survol sur toute la largeur de la bande, valeur affichée seulement sur le
 * maximum ; le tableau donne toutes les valeurs.
 */
function CaChart({ serie, language }) {
  const isAr = language === 'ar';
  const [survol, setSurvol] = useState(null);
  const largeur = 640;
  const hauteur = 200;
  const marge = { haut: 18, droite: 8, bas: 24, gauche: 44 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;

  const max = Math.max(...serie.map((p) => p.ca), 0);
  const ticks = graduations(max);
  const plafond = ticks[ticks.length - 1] || 1;
  const bande = zoneL / serie.length;
  const epaisseur = Math.min(24, Math.max(4, bande - 2)); // 2px d'air entre colonnes au minimum
  const y = (v) => marge.haut + zoneH - (v / plafond) * zoneH;
  const indexMax = max > 0 ? serie.findIndex((p) => p.ca === max) : -1;

  const libelleJour = (date, court) => {
    const d = new Date(`${date}T12:00:00Z`);
    return d.toLocaleDateString(isAr ? 'ar-TN' : 'fr-FR', court
      ? (serie.length <= 7 ? { weekday: 'narrow' } : { day: 'numeric' })
      : { weekday: 'long', day: 'numeric', month: 'long' });
  };
  // 30 jours : une étiquette sur 5 pour éviter les collisions.
  const pasEtiquette = serie.length <= 7 ? 1 : 5;

  // Colonne à bout arrondi (4px) et base carrée, posée sur la ligne de base.
  const colonne = (x, haut, h) => {
    if (h <= 0) return '';
    const r = Math.min(4, h, epaisseur / 2);
    const bas = haut + h;
    return `M${x},${bas} V${haut + r} Q${x},${haut} ${x + r},${haut} H${x + epaisseur - r} Q${x + epaisseur},${haut} ${x + epaisseur},${haut + r} V${bas} Z`;
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${largeur} ${hauteur}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Chiffre d'affaires par jour, maximum ${fmt(max)} TND`}
        onMouseLeave={() => setSurvol(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={marge.gauche} x2={largeur - marge.droite} y1={y(t)} y2={y(t)} stroke="#E8E3DA" strokeWidth="1" />
            <text x={marge.gauche - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400" fontSize="10">
              {fmt(t)}
            </text>
          </g>
        ))}

        {serie.map((p, i) => {
          const xBande = marge.gauche + i * bande;
          const x = xBande + (bande - epaisseur) / 2;
          const haut = y(p.ca);
          const h = marge.haut + zoneH - haut;
          const actif = survol === i;
          return (
            <g key={p.date}>
              {actif && <rect x={xBande} y={marge.haut} width={bande} height={zoneH} fill="#F4ECDF" opacity="0.6" />}
              <path d={colonne(x, haut, h)} fill={BRAND} opacity={survol === null || actif ? 1 : 0.55} />
              {i === indexMax && (
                <text x={x + epaisseur / 2} y={haut - 5} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-slate-700">
                  {fmt(p.ca)}
                </text>
              )}
              {i % pasEtiquette === 0 && (
                <text x={xBande + bande / 2} y={hauteur - 8} textAnchor="middle" fontSize="10" className="fill-slate-500">
                  {libelleJour(p.date, true)}
                </text>
              )}
              {/* Cible de survol : toute la bande, pas seulement la colonne */}
              <rect
                x={xBande}
                y={marge.haut}
                width={bande}
                height={zoneH}
                fill="transparent"
                onMouseEnter={() => setSurvol(i)}
                onFocus={() => setSurvol(i)}
                tabIndex={0}
                aria-label={`${libelleJour(p.date, false)} : ${fmt(p.ca)} TND, ${p.commandes} commande(s)`}
              />
            </g>
          );
        })}
        <line x1={marge.gauche} x2={largeur - marge.droite} y1={marge.haut + zoneH} y2={marge.haut + zoneH} stroke="#CFC6B8" strokeWidth="1" />
      </svg>

      {survol !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-soft"
          style={{
            left: `${((marge.gauche + (survol + 0.5) * bande) / largeur) * 100}%`,
            transform: `translateX(${survol > serie.length / 2 ? '-105%' : '5%'})`,
          }}
        >
          <p className="font-bold capitalize text-slate-800">{libelleJour(serie[survol].date, false)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-slate-600">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: BRAND }} />
            {fmt(serie[survol].ca)} TND
          </p>
          <p className="text-slate-400">{serie[survol].commandes} {isAr ? 'طلب' : 'commande(s)'}</p>
        </div>
      )}
    </div>
  );
}

function Tuile({ label, valeur, sousTexte, accent = false }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-soft ${accent ? 'border-terre-200' : 'border-slate-200'}`}>
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className={`mt-1 font-black text-slate-900 ${accent ? 'text-3xl' : 'text-lg'}`}>{valeur}</p>
      {sousTexte && <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{sousTexte}</p>}
    </div>
  );
}

/**
 * Statistiques du tableau de bord vendeur — GET /vendor/stats/:vendeurId.
 * `onVoirStockFaible` ouvre l'onglet produits filtré sur le stock faible.
 */
export default function VendorStatsPanel({ vendorId, token, language = 'fr', onVoirStockFaible }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const [jours, setJours] = useState(7);
  const [stats, setStats] = useState(null);
  const [vueTableau, setVueTableau] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!vendorId) return;
    let annule = false;
    fetch(`${API_URL}/vendor/stats/${vendorId}?jours=${jours}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (annule) return;
        if (data.success) { setStats(data.data); setErreur(''); } else setErreur(data.message || 'Erreur');
      })
      .catch(() => !annule && setErreur(tr('Statistiques indisponibles.', 'الإحصائيات غير متوفرة.')));
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, jours, token]);

  const totalSerie = useMemo(() => (stats?.serie || []).reduce((s, p) => s + p.ca, 0), [stats]);

  if (erreur) return <p className="mb-6 text-xs font-semibold text-rose-600">{erreur}</p>;
  if (!stats) return <div className="mb-6 h-48 animate-pulse rounded-lg bg-white" />;

  return (
    <section className="mb-8" aria-labelledby="stats-vendeur">
      <h2 id="stats-vendeur" className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-500">
        <TrendingUp size={16} /> {tr('Activité', 'النشاط')}
      </h2>

      {stats.stockFaible > 0 && (
        <button
          type="button"
          onClick={onVoirStockFaible}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs font-bold text-amber-800 transition hover:bg-amber-100"
        >
          <AlertTriangle size={16} />
          {tr(
            `${stats.stockFaible} produit(s) avec un stock ≤ ${stats.seuilStockFaible} — voir les produits à réapprovisionner`,
            `${stats.stockFaible} منتج بمخزون ≤ ${stats.seuilStockFaible} — عرض المنتجات`,
          )}
        </button>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile accent label={tr('CA ce mois', 'رقم المعاملات هذا الشهر')} valeur={`${fmt(stats.mois.ca)} TND`} sousTexte={`${stats.mois.commandes} ${tr('commande(s)', 'طلب')}`} />
        <Tuile label={tr("CA aujourd'hui", 'رقم المعاملات اليوم')} valeur={`${fmt(stats.aujourdHui.ca)} TND`} sousTexte={`${stats.aujourdHui.commandes} ${tr('commande(s)', 'طلب')}`} />
        <Tuile label={tr('CA cette semaine', 'رقم المعاملات هذا الأسبوع')} valeur={`${fmt(stats.semaine.ca)} TND`} sousTexte={`${stats.semaine.commandes} ${tr('commande(s)', 'طلب')}`} />
        <Tuile label={tr('Panier moyen (mois)', 'متوسط السلة (الشهر)')} valeur={`${fmt(stats.panierMoyenMois)} TND`} sousTexte={`${stats.produitsVendusMois} ${tr('article(s) vendu(s)', 'منتج مباع')}`} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile label={tr('Taux de retour', 'نسبة الإرجاع')} valeur={`${fmt(stats.tauxRetour)} %`} sousTexte={tr('Sur les commandes livrées', 'من الطلبات المسلمة')} />
        <Tuile label={tr('Commission prélevée', 'العمولة المقتطعة')} valeur={`${fmt(stats.commissions)} TND`} sousTexte={tr('Sur les ventes encaissées', 'من المبيعات المحصلة')} />
        <Tuile label={tr('Solde disponible', 'الرصيد المتاح')} valeur={`${fmt(stats.soldeDisponible)} TND`} sousTexte={tr('Retirable maintenant', 'قابل للسحب الآن')} />
        <Tuile label={tr('En séquestre', 'في الضمان')} valeur={`${fmt(stats.sequestre)} TND`} sousTexte={tr('Libéré après la fenêtre de retour', 'يُحرَّر بعد مهلة الإرجاع')} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-800">{tr("Chiffre d'affaires par jour (TND)", 'رقم المعاملات اليومي (د.ت)')}</h3>
            <p className="text-[11px] text-slate-400">
              {tr('Articles commandés, hors livraison, commandes annulées et remboursées exclues', 'المنتجات المطلوبة، دون التوصيل والطلبات الملغاة والمستردة')}
              {' · '}{tr('Total', 'المجموع')} {fmt(totalSerie)} TND
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-slate-200 p-0.5 text-[11px] font-bold" role="group" aria-label={tr('Période', 'الفترة')}>
              {[7, 30].map((j) => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setJours(j)}
                  aria-pressed={jours === j}
                  className={`rounded-lg px-3 py-1 transition ${jours === j ? 'bg-[#1E1B18] text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {j} {tr('jours', 'يوم')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setVueTableau((v) => !v)}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800"
              aria-pressed={vueTableau}
            >
              {vueTableau ? <BarChart3 size={13} /> : <Table2 size={13} />}
              {vueTableau ? tr('Graphique', 'رسم بياني') : tr('Tableau', 'جدول')}
            </button>
          </div>
        </div>

        {vueTableau ? (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-400">
                  <th className="py-2 font-bold">{tr('Jour', 'اليوم')}</th>
                  <th className="py-2 text-right font-bold">{tr('CA (TND)', 'رقم المعاملات')}</th>
                  <th className="py-2 text-right font-bold">{tr('Commandes', 'الطلبات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 tabular-nums text-slate-700">
                {stats.serie.map((p) => (
                  <tr key={p.date}>
                    <td className="py-1.5">{new Date(`${p.date}T12:00:00Z`).toLocaleDateString(isAr ? 'ar-TN' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="py-1.5 text-right">{fmt(p.ca)}</td>
                    <td className="py-1.5 text-right">{p.commandes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <CaChart serie={stats.serie} language={language} />
        )}
      </div>
    </section>
  );
}
