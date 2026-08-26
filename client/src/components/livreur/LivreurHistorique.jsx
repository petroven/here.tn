import React from 'react';
import { PackageCheck, XCircle, Wallet } from 'lucide-react';

export default function LivreurHistorique({ historique, loading }) {
  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Chargement de l'historique...</div>;
  }

  const courses = historique?.courses || [];
  const gains = historique?.gains || 0;

  return (
    <div className="p-4 space-y-4 max-w-xl mx-auto pb-24">
      <div className="rounded-2xl bg-amber-600 text-white p-5 flex items-center justify-between shadow-soft">
        <div>
          <p className="text-xs font-semibold text-amber-100 uppercase tracking-wide">Gains totaux</p>
          <p className="text-2xl font-black">{gains.toFixed(3)} TND</p>
        </div>
        <Wallet size={32} className="text-amber-100" />
      </div>

      {courses.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">Aucune course terminée pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {courses.map((c) => {
            const commande = c.Commande || {};
            const isLivree = c.statutAssignation === 'livree';
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isLivree ? <PackageCheck size={20} className="text-emerald-600" /> : <XCircle size={20} className="text-rose-500" />}
                  <div>
                    <p className="text-sm font-bold text-slate-800">{commande.numeroCommande || c.trackingId}</p>
                    <p className="text-xs text-slate-500">{new Date(c.updatedAt).toLocaleString('fr-TN')}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold ${isLivree ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {isLivree ? `+${Number(c.fraisLivraison || 0).toFixed(3)} TND` : 'Échec'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
