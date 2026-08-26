import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, Package, Search, Star, Store, Truck } from 'lucide-react';

export default function StorePage({ storeId, language = 'fr', onBack, onOpenProduct, onAddToCart }) {
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState('products');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/boutiques/${storeId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setStore(data.data);
      })
      .catch(() => setStore(null))
      .finally(() => setLoading(false));
  }, [storeId]);

  const products = useMemo(() => (store?.Produits || []).filter((product) => `${product.nom} ${product.description || ''}`.toLowerCase().includes(search.toLowerCase())), [store, search]);

  if (loading) return <div className="min-h-screen animate-pulse bg-slate-100 p-8"><div className="mx-auto h-56 max-w-7xl rounded-3xl bg-slate-200" /></div>;
  if (!store) return <div className="p-10 text-center text-slate-600">{language === 'ar' ? 'المتجر غير موجود.' : 'Boutique introuvable.'}</div>;

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 pb-24 md:pb-10">
      <div className="relative h-52 overflow-hidden bg-slate-900 sm:h-64">
        {store.bannière ? <img src={store.bannière} alt="" className="h-full w-full object-cover opacity-70" /> : <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900" />}
        <button onClick={onBack} className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-slate-800"><ArrowLeft size={15} /> {language === 'ar' ? 'رجوع' : 'Retour'}</button>
      </div>

      <main className="mx-auto -mt-10 max-w-7xl px-4 sm:px-6">
        <section className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-[#EEF2FF] text-3xl font-black text-[#6366F1] shadow-lg">
              {store.logo ? <img src={store.logo} alt={store.nom} className="h-full w-full object-cover" /> : store.nom.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">{store.nom}</h1>
                {store.statut === 'validee' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> {language === 'ar' ? 'موثقة' : 'Verifiee'}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{language === 'ar' ? 'قيد التحقق' : 'Verification en cours'}</span>
                )}
              </div>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{store.description || (language === 'ar' ? 'متجر تونسي' : 'Boutique tunisienne')}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-1"><Package size={14} /> {store.nombreProduits || 0} produits</span>{store.Gouvernorat?.nom && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {store.Gouvernorat.nom}</span>}<span className="inline-flex items-center gap-1"><Truck size={14} /> Livraison nationale</span></div>
            </div>
          </div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200">
          {[['products', language === 'ar' ? 'المنتجات' : 'Produits'], ['about', language === 'ar' ? 'حول المتجر' : 'A propos'], ['reviews', language === 'ar' ? 'التقييمات' : 'Avis']].map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${tab === value ? 'border-[#6366F1] text-[#6366F1]' : 'border-transparent text-slate-500'}`}>{label}</button>)}
        </div>

        {tab === 'products' && <section className="mt-6 space-y-5"><div className="relative max-w-md"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === 'ar' ? 'ابحث في منتجات المتجر' : 'Rechercher dans la boutique'} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none" /></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft"><button onClick={() => onOpenProduct(product.id)} className="block w-full text-left"><div className="h-44 bg-slate-100">{product.image ? <img src={product.image} alt={product.nom} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><Store size={35} /></div>}</div><div className="space-y-2 p-4"><h3 className="truncate text-sm font-extrabold text-slate-900">{product.nom}</h3><p className="line-clamp-2 text-xs text-slate-500">{product.description}</p><div className="flex items-center justify-between"><strong className="text-lg text-[#6366F1]">{Number(product.prix).toFixed(3)} TND</strong><span className="text-xs font-semibold text-slate-500">Stock {product.stock}</span></div></div></button><button onClick={() => onAddToCart({ id: product.id, nom: product.nom, prix: product.prix, boutiqueId: store.id, boutiqueNom: store.nom, image: product.image, stock: product.stock, varianteId: null })} disabled={product.stock < 1} className="m-4 mt-0 w-[calc(100%-2rem)] rounded-xl bg-[#6366F1] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#4F46E5] disabled:opacity-40">{language === 'ar' ? 'أضف إلى السلة' : 'Ajouter au panier'}</button></article>)}</div>{products.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">{language === 'ar' ? 'لا توجد منتجات.' : 'Aucun produit dans cette boutique.'}</p>}</section>}
        {tab === 'about' && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6"><h2 className="text-xl font-extrabold text-slate-900">{language === 'ar' ? 'حول المتجر' : 'A propos de la boutique'}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{store.description || (language === 'ar' ? 'متجر تونسي موثوق على منصة here.tn.' : 'Cette boutique presente ses produits sur here.tn avec une livraison disponible en Tunisie.')}</p></section>}
        {tab === 'reviews' && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6"><div className="flex items-center gap-2"><Star className="fill-amber-400 text-amber-400" size={20} /><h2 className="text-xl font-extrabold text-slate-900">{language === 'ar' ? 'تقييمات المتجر' : 'Avis de la boutique'}</h2></div><p className="mt-3 text-sm text-slate-600">{language === 'ar' ? 'ستظهر تقييمات المشترين الموثقة هنا.' : 'Les avis acheteurs verifies seront affiches ici au fur et a mesure des commandes livrees.'}</p></section>}
      </main>
    </div>
  );
}
