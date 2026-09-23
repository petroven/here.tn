import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, MessageSquare, Package, Search, Star, Store, Truck } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function StoreRatingStars({ note, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(note) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
      ))}
    </span>
  );
}

export default function StorePage({ storeId, language = 'fr', onBack, onOpenProduct, onAddToCart, onStartChat }) {
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState('products');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  useDocumentTitle(
    store ? `${store.nom} — BuyHere` : undefined,
    store?.description ? store.description.slice(0, 160) : undefined,
  );

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
  const avisBoutique = store?.avisBoutique || { moyenne: 0, nombre: 0, avis: [] };

  if (loading) return <div className="min-h-screen animate-pulse bg-slate-100 p-8"><div className="mx-auto h-56 max-w-7xl rounded-lg bg-slate-200" /></div>;
  if (!store) return <div className="p-10 text-center text-slate-600">{tr('Boutique introuvable.', 'المتجر غير موجود.')}</div>;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 pb-24 md:pb-10">
      <div className="relative h-52 overflow-hidden bg-slate-900 sm:h-64">
        {store.bannière ? <img src={store.bannière} alt="" className="h-full w-full object-cover opacity-70" /> : <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-terre-900" />}
        <button onClick={onBack} className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-slate-800"><ArrowLeft size={15} /> {tr('Retour', 'رجوع')}</button>
      </div>

      <main className="mx-auto -mt-10 max-w-7xl px-4 sm:px-6">
        <section className="relative rounded-lg border border-slate-200 bg-white p-5 shadow-soft sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-4 border-white bg-[#F8E4DE] text-3xl font-black text-[#C4532C] shadow-lg">
              {store.logo ? <img src={store.logo} alt={store.nom} className="h-full w-full object-cover" /> : store.nom.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">{store.nom}</h1>
                {store.kycStatut === 'valide' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> {tr('Vérifiée', 'موثقة')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{tr('Boutique active', 'متجر نشط')}</span>
                )}
                {avisBoutique.nombre > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <StoreRatingStars note={avisBoutique.moyenne} size={12} />
                    {avisBoutique.moyenne} · {avisBoutique.nombre} {tr('avis', 'تقييم')}
                  </span>
                )}
              </div>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">{store.description || tr('Boutique tunisienne', 'متجر تونسي')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1"><Package size={14} /> {store.nombreProduits || 0} {tr('produits', 'منتج')}</span>
                {store.Gouvernorat?.nom && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {store.Gouvernorat.nom}</span>}
                <span className="inline-flex items-center gap-1"><Truck size={14} /> {tr('Livraison nationale', 'توصيل وطني')}</span>
                {store.vendeurId && onStartChat && (
                  <button
                    onClick={() => onStartChat(store.vendeurId, `${tr('Boutique', 'المتجر')}: ${store.nom}`)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-terre-200 px-3 py-1.5 text-xs font-bold text-terre-700 transition hover:bg-terre-50 rtl:ml-0 rtl:mr-auto"
                  >
                    <MessageSquare size={14} /> {tr('Contacter le vendeur', 'تواصل مع البائع')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-200">
          {[
            ['products', tr('Produits', 'المنتجات')],
            ['about', tr('A propos', 'حول المتجر')],
            ['reviews', `${tr('Avis', 'التقييمات')}${avisBoutique.nombre > 0 ? ` (${avisBoutique.nombre})` : ''}`],
          ].map(([value, label]) => (
            <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold ${tab === value ? 'border-[#C4532C] text-[#C4532C]' : 'border-transparent text-slate-500'}`}>{label}</button>
          ))}
        </div>

        {tab === 'products' && (
          <section className="mt-6 space-y-5">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr('Rechercher dans la boutique', 'ابحث في منتجات المتجر')} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
                  <button onClick={() => onOpenProduct(product.id)} className="block w-full text-left">
                    <div className="h-44 bg-slate-100">{product.image ? <img src={product.image} alt={product.nom} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><Store size={35} /></div>}</div>
                    <div className="space-y-2 p-4">
                      <h3 className="truncate text-sm font-extrabold text-slate-900">{product.nom}</h3>
                      <p className="line-clamp-2 text-xs text-slate-500">{product.description}</p>
                      <div className="flex items-center justify-between"><strong className="text-lg text-[#C4532C]">{Number(product.prix).toFixed(3)} TND</strong><span className="text-xs font-semibold text-slate-500">Stock {product.stock}</span></div>
                    </div>
                  </button>
                  <button onClick={() => onAddToCart({ id: product.id, nom: product.nom, prix: product.prix, boutiqueId: store.id, boutiqueNom: store.nom, image: product.image, stock: product.stock, varianteId: null })} disabled={product.stock < 1} className="m-4 mt-0 w-[calc(100%-2rem)] rounded-xl bg-[#C4532C] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#994122] disabled:opacity-40">{tr('Ajouter au panier', 'أضف إلى السلة')}</button>
                </article>
              ))}
            </div>
            {products.length === 0 && <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">{tr('Aucun produit dans cette boutique.', 'لا توجد منتجات.')}</p>}
          </section>
        )}

        {tab === 'about' && (
          <section className="mt-6 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-extrabold text-slate-900">{tr('A propos de la boutique', 'حول المتجر')}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{store.description || tr('Cette boutique présente ses produits sur here.tn avec une livraison disponible en Tunisie.', 'يعرض هذا المتجر منتجاته على here.tn مع إمكانية التوصيل في تونس.')}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tr('Note moyenne', 'التقييم المتوسط')}</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-black text-slate-900">
                  {avisBoutique.nombre > 0 ? avisBoutique.moyenne : '—'}
                  {avisBoutique.nombre > 0 && <StoreRatingStars note={avisBoutique.moyenne} />}
                </p>
                <p className="text-[11px] text-slate-400">{avisBoutique.nombre} {tr('avis vérifiés', 'تقييم موثق')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tr('Adresse', 'العنوان')}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{store.adresse || tr('Non renseignée', 'غير محدد')}</p>
                <p className="text-[11px] text-slate-400">{store.Gouvernorat?.nom || ''}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tr('Vérification', 'التحقق')}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  {store.kycStatut === 'valide' ? tr('Identité vérifiée', 'تم التحقق من الهوية') : tr('Identité non vérifiée', 'لم يتم التحقق من الهوية')}
                </p>
                <p className="text-[11px] text-slate-400">{tr('Politique de retour affichée sur chaque produit', 'سياسة الإرجاع معروضة في كل منتج')}</p>
              </div>
            </div>
          </section>
        )}

        {tab === 'reviews' && (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <Star className="fill-amber-400 text-amber-400" size={20} />
              <h2 className="text-xl font-extrabold text-slate-900">{tr('Avis de la boutique', 'تقييمات المتجر')}</h2>
            </div>
            {avisBoutique.nombre === 0 ? (
              <p className="mt-3 text-sm text-slate-600">{tr('Les avis acheteurs vérifiés seront affichés ici au fur et à mesure des commandes livrées.', 'ستظهر تقييمات المشترين الموثقة هنا مع تسليم الطلبات.')}</p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                  <span className="text-3xl font-black text-slate-900">{avisBoutique.moyenne}</span>
                  <div>
                    <StoreRatingStars note={avisBoutique.moyenne} size={16} />
                    <p className="text-xs text-slate-500">{avisBoutique.nombre} {tr('avis vérifiés (commandes livrées)', 'تقييم موثق (طلبات تم تسليمها)')}</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {avisBoutique.avis.map((a) => (
                    <div key={a.id} className="py-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-800">{a.auteur?.prenom} {a.auteur?.nom?.[0]}.</p>
                        <StoreRatingStars note={a.note} size={13} />
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-[#C4532C]">{a.produit?.nom}</p>
                      {a.commentaire && <p className="mt-1.5 text-sm text-slate-600">{a.commentaire}</p>}
                      <p className="mt-1 text-[10px] text-slate-400">{new Date(a.createdAt).toLocaleDateString(isAr ? 'ar-TN' : 'fr-TN')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
