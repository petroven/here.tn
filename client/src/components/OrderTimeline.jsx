import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Phone, Bike, Car, Truck, MapPin, Clock, XCircle, RotateCcw } from 'lucide-react';
import { etapesCommande, EVENEMENT_LABELS } from '../utils/orderStatus.js';

const VEHICULES = {
  moto: { fr: 'Moto', ar: 'دراجة نارية', Icon: Bike },
  velo: { fr: 'Vélo', ar: 'دراجة', Icon: Bike },
  voiture: { fr: 'Voiture', ar: 'سيارة', Icon: Car },
  camionnette: { fr: 'Camionnette', ar: 'شاحنة صغيرة', Icon: Truck },
};

/**
 * Suivi d'une commande : barre de progression (commande passée → livrée),
 * carte du livreur une fois la course assignée, et historique daté
 * dépliable. `order` est une commande de /commandes/mes-commandes, qui joint
 * déjà `historique` et `suiviLivreur`.
 */
export default function OrderTimeline({ order, language = 'fr' }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const locale = isAr ? 'ar-TN' : 'fr-TN';
  const [ouvert, setOuvert] = useState(false);

  const etapes = etapesCommande(order);
  const livreur = order.suiviLivreur;
  const historique = order.historique || [];
  const formatDate = (d) => new Date(d).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const bandeau = {
    annulee: { Icon: XCircle, classe: 'border-rose-200 bg-rose-50 text-rose-700', texte: tr('Cette commande a été annulée.', 'تم إلغاء هذا الطلب.') },
    retour: { Icon: RotateCcw, classe: 'border-orange-200 bg-orange-50 text-orange-700', texte: tr('Demande de retour en cours d\'examen par la boutique.', 'طلب الإرجاع قيد المراجعة من المتجر.') },
    litige: { Icon: RotateCcw, classe: 'border-red-200 bg-red-50 text-red-700', texte: tr('Retour transmis à la médiation here.tn.', 'تمت إحالة الإرجاع إلى الوساطة.') },
    retournee: { Icon: RotateCcw, classe: 'border-slate-200 bg-slate-50 text-slate-700', texte: tr('Retour accepté : remboursement crédité sur votre solde.', 'تم قبول الإرجاع وإضافة المبلغ إلى رصيدك.') },
  }[order.statut];

  return (
    <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
      {bandeau && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${bandeau.classe}`}>
          <bandeau.Icon size={14} />
          {bandeau.texte}
        </div>
      )}

      {/* Barre de progression */}
      <ol className="grid grid-cols-6 gap-1" aria-label={tr('Progression de la commande', 'تقدم الطلب')}>
        {etapes.map((etape, index) => {
          const faite = etape.etat === 'faite';
          const courante = etape.etat === 'courante';
          return (
            <li key={etape.cle} className="relative flex flex-col items-center text-center" aria-current={courante ? 'step' : undefined}>
              {index > 0 && (
                <span
                  className={`absolute top-3 h-0.5 ${faite ? 'bg-[#C4532C]' : 'bg-slate-200'}`}
                  style={{ [isAr ? 'right' : 'left']: '-50%', width: '100%' }}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-black ${
                  faite
                    ? 'border-[#C4532C] bg-[#C4532C] text-white'
                    : courante
                      ? 'border-[#C4532C] bg-white text-[#C4532C]'
                      : 'border-slate-200 bg-white text-slate-300'
                }`}
              >
                {faite ? <Check size={12} strokeWidth={3} /> : courante ? <span className="h-2 w-2 rounded-full bg-[#C4532C]" /> : null}
              </span>
              <span className={`mt-1.5 text-[10px] font-bold leading-tight ${faite || courante ? 'text-slate-800' : 'text-slate-400'}`}>
                {tr(etape.fr, etape.ar)}
              </span>
              {etape.date && (
                <span className="mt-0.5 text-[9px] text-slate-400">{formatDate(etape.date)}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Livreur assigné */}
      {livreur && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-violet-100 bg-white p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-700">
            {(() => {
              const V = VEHICULES[livreur.vehicule]?.Icon || Bike;
              return <V size={18} />;
            })()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-slate-800">
              {livreur.nom}
              <span className="ms-2 text-[10px] font-semibold text-slate-400">
                {VEHICULES[livreur.vehicule] ? tr(VEHICULES[livreur.vehicule].fr, VEHICULES[livreur.vehicule].ar) : ''}
              </span>
            </p>
            <p className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-slate-500">
              {livreur.distanceKm !== null && (
                <span className="flex items-center gap-1"><MapPin size={11} /> {livreur.distanceKm} km</span>
              )}
              {livreur.etaMinutes !== null && (
                <span className="flex items-center gap-1"><Clock size={11} /> {tr('Arrivée estimée', 'الوصول المتوقع')} ~{livreur.etaMinutes} min</span>
              )}
              {livreur.distanceKm === null && (
                <span>{livreur.statut === 'en_cours' ? tr('En route vers vous', 'في الطريق إليك') : tr('Récupère votre colis', 'يستلم طردك')}</span>
              )}
            </p>
          </div>
          {livreur.telephone && (
            <a
              href={`tel:${livreur.telephone}`}
              className="flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-50"
            >
              <Phone size={13} />
              {tr('Appeler', 'اتصال')}
            </a>
          )}
        </div>
      )}

      {/* Historique détaillé */}
      {historique.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
            aria-expanded={ouvert}
          >
            {ouvert ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {tr('Historique détaillé', 'السجل التفصيلي')} ({historique.length})
          </button>
          {ouvert && (
            <ul className="mt-2 space-y-1.5 border-s-2 border-slate-200 ps-3">
              {historique.map((h) => {
                const libelle = EVENEMENT_LABELS[h.nouveauStatut];
                const estEvenement = h.ancienStatut === h.nouveauStatut;
                return (
                  <li key={h.id} className="text-[11px]">
                    <span className="font-mono text-slate-400">{formatDate(h.createdAt)}</span>
                    <span className="ms-2 font-semibold text-slate-700">
                      {estEvenement && h.commentaire ? h.commentaire : (libelle ? tr(libelle.fr, libelle.ar) : h.nouveauStatut)}
                    </span>
                    {!estEvenement && h.commentaire && h.ancienStatut !== null && (
                      <span className="ms-1 text-slate-400">— {h.commentaire}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
