import React from 'react';
import { MapPin, Package, ArrowRight } from 'lucide-react';

// Carte boutique — bannière + logo superposé + badges + CTA. Utilisée sur
// StoresPage.jsx (liste complète) et sur la section "Découvrez nos
// boutiques" de la page d'accueil (App.jsx#HomeView).
export default function BoutiqueCard({ store, onOpen, language = 'fr' }) {
  const isAr = language === 'ar';

  return (
    <article className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft transition hover:-translate-y-1 hover:border-terre-200">
      <div className="relative h-36 bg-slate-900">
        {store.bannière ? (
          <img src={store.bannière} alt="" className="h-full w-full object-cover opacity-80" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 to-terre-900" />
        )}
        <div className="absolute -bottom-8 left-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-xl font-black text-[#C4532C] shadow">
          {store.logo ? <img src={store.logo} alt={store.nom} className="h-full w-full object-cover" /> : store.nom?.slice(0, 1).toUpperCase()}
        </div>
      </div>
      <div className="space-y-4 p-5 pt-12">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">{store.nom}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{store.description || (isAr ? 'متجر تونسي موثوق' : 'Boutique tunisienne verifiee')}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1"><Package size={14} /> {store.nombreProduits || 0} produits</span>
          {store.Gouvernorat?.nom && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {store.Gouvernorat.nom}</span>}
          {store.categorie && <span className="rounded-full bg-slate-100 px-2 py-1">{store.categorie}</span>}
        </div>
        <button onClick={() => onOpen(store.id)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C4532C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#994122]">
          {isAr ? 'زيارة المتجر' : 'Voir la boutique'} <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}
