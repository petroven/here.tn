import React, { useEffect, useState } from 'react';
import { ArrowLeft, X, ShoppingCart, Star, GitCompare } from 'lucide-react';
import { API_URL } from '../config/api.js';
import { useCompare } from '../utils/compare.js';
import { returnDays } from '../utils/returnPolicy.js';

export default function ComparePage({ language = 'fr', onBack, onOpenProduct, onAddToCart }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const compare = useCompare();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const idsKey = compare.ids.join(',');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(compare.ids.map((id) => fetch(`${API_URL}/produits/${id}`)
      .then((response) => response.json())
      .then((data) => (data.success ? data.data : null))
      .catch(() => null)))
      .then((list) => {
        if (cancelled) return;
        setProducts(list.filter(Boolean));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [idsKey]);

  const money = (value) => `${Number(value).toFixed(3)} TND`;
  const rows = [
    { label: tr('Prix', 'السعر'), value: (p) => <strong className="text-[#C4532C]">{money(p.prix)}</strong> },
    { label: tr('Prix avant promotion', 'السعر قبل التخفيض'), value: (p) => (p.prixAvant > p.prix ? <span className="text-slate-400 line-through">{money(p.prixAvant)}</span> : '—') },
    { label: tr('Boutique', 'المتجر'), value: (p) => p.boutique?.nom || '—' },
    { label: tr('Catégorie', 'الفئة'), value: (p) => p.categorie?.nom || '—' },
    {
      label: tr('Note', 'التقييم'),
      value: (p) => (Number(p.note) > 0
        ? <span className="inline-flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" />{Number(p.note).toFixed(1)} ({p.nombreAvis})</span>
        : tr('Pas encore d’avis', 'لا توجد تقييمات بعد')),
    },
    { label: tr('Stock', 'المخزون'), value: (p) => (p.stock > 0 ? tr(`${p.stock} en stock`, `${p.stock} متوفر`) : <span className="text-rose-600">{tr('Rupture', 'نفد')}</span>) },
    {
      label: tr('Retour', 'الإرجاع'),
      value: (p) => {
        const days = returnDays(p);
        return days > 0 ? tr(`Sous ${days} jours`, `خلال ${days} يومًا`) : tr('Non retournable', 'غير قابل للإرجاع');
      },
    },
    {
      label: tr('Options', 'الخيارات'),
      value: (p) => {
        const options = (p.variantes || []).map((v) => [v.taille, v.couleur, v.pointure].filter(Boolean).join(' / ')).filter(Boolean);
        return options.length ? options.join(', ') : '—';
      },
    },
  ];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 pb-24 font-sans">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} className={isAr ? 'rotate-180' : ''} /> {tr('Retour au catalogue', 'العودة إلى الكتالوج')}
        </button>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900"><GitCompare size={22} className="text-[#C4532C]" /> {tr('Comparer les produits', 'مقارنة المنتجات')}</h1>
          {products.length > 0 && (
            <button onClick={compare.clear} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
              {tr('Tout retirer', 'حذف الكل')}
            </button>
          )}
        </div>

        {!loading && products.length === 0 && (
          <div className="card-premium p-10 text-center">
            <p className="text-sm text-slate-600">{tr('Aucun produit à comparer.', 'لا توجد منتجات للمقارنة.')}</p>
            <p className="mt-1 text-xs text-slate-400">{tr('Dans le catalogue, touchez l’icône de comparaison sur 2 ou 3 produits.', 'في الكتالوج، اضغط على أيقونة المقارنة في منتجين أو ثلاثة.')}</p>
            <button onClick={onBack} className="btn-primary-premium mt-5 px-5 py-2.5 text-xs">{tr('Aller au catalogue', 'الذهاب إلى الكتالوج')}</button>
          </div>
        )}

        {products.length > 0 && (
          <div className="card-premium overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-xs">
              <thead>
                <tr>
                  <th className="w-36 p-4" />
                  {products.map((product) => (
                    <th key={product.id} className="p-4 align-top font-normal">
                      <div className="relative">
                        <button
                          onClick={() => compare.toggle(product.id)}
                          aria-label={tr('Retirer', 'حذف')}
                          className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow hover:text-rose-600 rtl:left-1 rtl:right-auto"
                        >
                          <X size={14} />
                        </button>
                        <button onClick={() => onOpenProduct(product.id)} className="block w-full text-left">
                          <div className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                            {product.image && <img src={product.image} alt={product.nom} className="h-full w-full object-cover" />}
                          </div>
                          <p className="mt-2 text-sm font-bold text-slate-900">{product.nom}</p>
                        </button>
                        <button
                          onClick={() => onAddToCart({
                            id: product.id,
                            nom: product.nom,
                            prix: product.prix,
                            boutiqueId: product.boutiqueId,
                            boutiqueNom: product.boutique?.nom,
                            image: product.image,
                            stock: product.stock,
                            varianteId: null,
                          })}
                          disabled={product.stock < 1}
                          className="btn-primary-premium mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-xs disabled:opacity-40"
                        >
                          <ShoppingCart size={14} /> {tr('Ajouter au panier', 'أضف إلى السلة')}
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-slate-100">
                    <th scope="row" className="p-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">{row.label}</th>
                    {products.map((product) => (
                      <td key={product.id} className="p-4 font-semibold text-slate-700">{row.value(product)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
