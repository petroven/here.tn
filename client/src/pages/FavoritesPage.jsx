import React, { useEffect, useState } from 'react';
import { Heart, ShoppingBag, ArrowLeft, PackageCheck } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function FavoritesPage({ language = 'fr', onBack, onOpenProduct, onAddToCart }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API_URL}/wishlist`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => { if (data.success) setItems(data.data); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token]);

  const handleRemove = async (produitId) => {
    setItems((current) => current.filter((item) => item.produitId !== produitId));
    try {
      await fetch(`${API_URL}/wishlist/${produitId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50">
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <Heart size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{tr('Mes Favoris', 'المفضلة')}</h1>
          <p className="text-sm text-slate-500">{tr('Les produits que vous avez enregistrés', 'المنتجات التي حفظتها')}</p>
        </div>
      </div>

      {!token ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-soft">
          <p className="text-slate-500">{tr('Connectez-vous pour voir vos favoris.', 'سجّل الدخول لعرض مفضلتك.')}</p>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-soft">
          <p className="text-slate-500">{tr("Vous n'avez aucun favori pour le moment.", 'ليس لديك أي منتج مفضل بعد.')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ produit, produitId }) => {
            if (!produit) return null;
            return (
              <article key={produitId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                <button onClick={() => onOpenProduct(produitId)} className="block w-full text-left">
                  <div className="h-40 bg-slate-100">
                    {produit.image ? (
                      <img src={produit.image} alt={produit.nom} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300"><PackageCheck size={32} /></div>
                    )}
                  </div>
                  <div className="space-y-1 p-3">
                    <h3 className="truncate text-sm font-extrabold text-slate-900">{produit.nom}</h3>
                    <strong className="text-base text-[#6366F1]">{Number(produit.prix).toFixed(3)} TND</strong>
                  </div>
                </button>
                <div className="flex gap-2 p-3 pt-0">
                  <button
                    onClick={() => onAddToCart({ id: produit.id, nom: produit.nom, prix: produit.prix, boutiqueId: produit.boutiqueId, image: produit.image, stock: produit.stock, varianteId: null })}
                    disabled={produit.stock < 1}
                    className="flex-1 rounded-xl bg-[#6366F1] px-3 py-2 text-xs font-bold text-white hover:bg-[#4F46E5] disabled:opacity-40"
                  >
                    <ShoppingBag size={13} className="inline -mt-0.5 mr-1 rtl:ml-1 rtl:mr-0" />
                    {tr('Ajouter', 'إضافة')}
                  </button>
                  <button
                    onClick={() => handleRemove(produitId)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
                  >
                    {tr('Retirer', 'إزالة')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
