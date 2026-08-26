import React from 'react';
import { Star, Package, TrendingUp, LogOut } from 'lucide-react';

export default function LivreurStatsPanel({ stats, loading, onLogout }) {
  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Chargement des statistiques...</div>;
  }

  const s = stats || { nombreLivraisons: 0, noteMoyenne: 0, gainsJour: 0, gainsSemaine: 0 };

  const tiles = [
    { label: 'Livraisons totales', value: s.nombreLivraisons, icon: Package },
    { label: 'Note moyenne', value: `${Number(s.noteMoyenne || 0).toFixed(1)} / 5`, icon: Star },
    { label: "Gains aujourd'hui", value: `${Number(s.gainsJour || 0).toFixed(3)} TND`, icon: TrendingUp },
    { label: 'Gains 7 derniers jours', value: `${Number(s.gainsSemaine || 0).toFixed(3)} TND`, icon: TrendingUp },
  ];

  return (
    <div className="p-4 space-y-4 max-w-xl mx-auto pb-24">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                <Icon size={18} />
              </div>
              <p className="text-lg font-black text-slate-900">{tile.value}</p>
              <p className="text-xs text-slate-500">{tile.label}</p>
            </div>
          );
        })}
      </div>

      <button
        onClick={onLogout}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 text-rose-600 font-bold py-3.5 text-sm hover:bg-rose-50 transition"
      >
        <LogOut size={16} /> Déconnexion
      </button>
    </div>
  );
}
