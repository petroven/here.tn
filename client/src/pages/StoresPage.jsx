import React, { useEffect, useState } from 'react';
import { MapPin, Search, Store, ArrowRight, Package, ShieldCheck } from 'lucide-react';

export default function StoresPage({ language = 'fr', onOpenStore }) {
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/boutiques')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setStores(data.data);
      })
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredStores = stores.filter((store) => {
    const haystack = `${store.nom} ${store.description || ''} ${store.categorie || ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 pb-24 pt-8 sm:px-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#6366F1]"><Store size={17} /> here.tn</span>
              <h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">{language === 'ar' ? 'جميع المتاجر' : 'Toutes les boutiques'}</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{language === 'ar' ? 'اكتشف متاجر تونسية موثوقة ومنتجات متنوعة في مكان واحد.' : 'Entrez dans les vitrines de commerçants tunisiens verifies et trouvez votre prochaine bonne affaire.'}</p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'ar' ? 'ابحث عن متجر' : 'Rechercher une boutique'} className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-900">{filteredStores.length} {language === 'ar' ? 'متجر' : 'boutique(s)'}</h2>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck size={15} /> {language === 'ar' ? 'متاجر موثوقة' : 'Boutiques validees'}</span>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-3xl bg-slate-200" />)}
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">{language === 'ar' ? 'لا توجد متاجر مطابقة.' : 'Aucune boutique ne correspond a votre recherche.'}</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStores.map((store) => (
              <article key={store.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft transition hover:-translate-y-1 hover:border-indigo-200">
                <div className="relative h-36 bg-slate-900">
                  {store.bannière ? <img src={store.bannière} alt="" className="h-full w-full object-cover opacity-80" /> : <div className="h-full w-full bg-gradient-to-br from-slate-800 to-indigo-900" />}
                  <div className="absolute -bottom-8 left-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-xl font-black text-[#6366F1] shadow">
                    {store.logo ? <img src={store.logo} alt={store.nom} className="h-full w-full object-cover" /> : store.nom?.slice(0, 1).toUpperCase()}
                  </div>
                </div>
                <div className="space-y-4 p-5 pt-12">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{store.nom}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{store.description || (language === 'ar' ? 'متجر تونسي موثوق' : 'Boutique tunisienne verifiee')}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1"><Package size={14} /> {store.nombreProduits || 0} produits</span>
                    {store.Gouvernorat?.nom && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {store.Gouvernorat.nom}</span>}
                    {store.categorie && <span className="rounded-full bg-slate-100 px-2 py-1">{store.categorie}</span>}
                  </div>
                  <button onClick={() => onOpenStore(store.id)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#4F46E5]">
                    {language === 'ar' ? 'زيارة المتجر' : 'Voir la boutique'} <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
