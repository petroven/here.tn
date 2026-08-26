import React from 'react';
import { MapPin, Navigation, Wallet } from 'lucide-react';

const STATUS_LABELS = {
  en_attente: { label: 'Disponible', className: 'bg-amber-100 text-amber-700' },
  assignee: { label: 'À récupérer', className: 'bg-indigo-100 text-indigo-700' },
  en_cours: { label: 'En livraison', className: 'bg-teal-100 text-teal-700' },
  livree: { label: 'Livrée', className: 'bg-emerald-100 text-emerald-700' },
  echec: { label: 'Échec', className: 'bg-rose-100 text-rose-700' },
};

export default function LivreurCourseCard({ course, onOpen, onAccepter }) {
  const commande = course.Commande || {};
  const boutique = commande.boutique || {};
  const status = STATUS_LABELS[course.statutAssignation] || STATUS_LABELS.en_attente;
  const distance = course.distanceEstimeeKm;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{course.trackingId}</p>
          <p className="text-sm font-extrabold text-slate-900 mt-0.5">{commande.numeroCommande || 'Commande'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-slate-600">
        <div className="flex items-start gap-1.5">
          <MapPin size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <span><strong className="text-slate-800">Retrait :</strong> {boutique.nom || 'Boutique'} — {boutique.adresse || 'Adresse non renseignée'}</span>
        </div>
        <div className="flex items-start gap-1.5">
          <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <span><strong className="text-slate-800">Livraison :</strong> {commande.adresseLivraison || 'Adresse non renseignée'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
          <span className="inline-flex items-center gap-1"><Navigation size={13} className="text-slate-400" /> {distance !== null && distance !== undefined ? `${distance.toFixed(1)} km` : 'Distance non disponible'}</span>
          <span className="inline-flex items-center gap-1"><Wallet size={13} className="text-slate-400" /> {Number(course.fraisLivraison || 0).toFixed(3)} TND</span>
        </div>
        {course.statutAssignation === 'en_attente' ? (
          <button
            onClick={() => onAccepter(course.id)}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 transition"
          >
            Accepter
          </button>
        ) : (
          <button
            onClick={() => onOpen(course)}
            className="rounded-xl border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2 hover:bg-slate-50 transition"
          >
            Voir détail
          </button>
        )}
      </div>
    </div>
  );
}
