import React, { useEffect, useState } from 'react';
import { API_URL } from '../config/api.js';
import {
  X, Heart, Ticket, ChevronRight, Store, HelpCircle,
  Sparkles, Shirt, Watch, Home as HomeIcon, Smartphone,
  Laptop, ShoppingBasket, Dumbbell, Tv, Baby, Car, Gamepad2, Tag,
} from 'lucide-react';

const ICON_BY_KEYWORD = [
  [/beaut|sant|parapharm/i, Sparkles],
  [/mode|v[êe]tement|chaussure/i, Shirt],
  [/accessoire.*mode|bijou/i, Watch],
  [/maison|d[ée]co|bricolage/i, HomeIcon],
  [/t[ée]l[ée]phon|mobile|objets connect/i, Smartphone],
  [/informatique|ordinateur/i, Laptop],
  [/supermarch|alimentation|terroir|artisanat/i, ShoppingBasket],
  [/sport|loisir|voyage/i, Dumbbell],
  [/image|son|[ée]lectrom[ée]nager|tv|hi-tech/i, Tv],
  [/b[ée]b[ée]|enfant|jouet/i, Baby],
  [/auto|moto/i, Car],
  [/jeux vid[ée]o|console|gaming/i, Gamepad2],
];

function iconForCategory(nom = '') {
  const match = ICON_BY_KEYWORD.find(([pattern]) => pattern.test(nom));
  return match ? match[1] : Tag;
}

export default function CategoryDrawer({
  open,
  onClose,
  language = 'fr',
  onSelectCategory,
  onOpenFavorites,
  onOpenCoupons,
  onBecomeVendor,
  onOpenSupport,
}) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${API_URL}/categories`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setCategories(data.data); })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const side = isAr ? 'right' : 'left';

  return (
    <div className="fixed inset-0 z-[80] font-sans" role="dialog" aria-modal="true">
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />

      {/* Panel */}
      <div
        className={`absolute top-0 ${side === 'left' ? 'left-0' : 'right-0'} h-full w-[85%] max-w-sm overflow-y-auto bg-white shadow-2xl animate-fadeIn`}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <span className="text-sm font-black text-slate-900">here.tn</span>
          <button onClick={onClose} aria-label={tr('Fermer', 'إغلاق')} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        {/* Quick links */}
        <div className="p-3">
          <button
            onClick={() => { onOpenFavorites?.(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-slate-50"
          >
            <Heart size={22} className="text-slate-700" strokeWidth={1.75} />
            <span className="text-base text-slate-900">{tr('Favoris', 'المفضلة')}</span>
          </button>
          <button
            onClick={() => { onOpenCoupons?.(); onClose(); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left hover:bg-slate-50"
          >
            <Ticket size={22} className="text-slate-700" strokeWidth={1.75} />
            <span className="text-base text-slate-900">{tr("Bons d'achat", 'قسائم الشراء')}</span>
          </button>
        </div>

        <div className="mx-4 border-t border-slate-100" />

        {/* Categories */}
        <div className="p-3">
          <div className="flex items-center justify-between px-3 pb-2 pt-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{tr('Nos catégories', 'فئاتنا')}</h2>
            <button
              onClick={() => { onSelectCategory?.(null); onClose(); }}
              className="text-xs font-bold text-amber-600 hover:text-amber-700"
            >
              {tr('Voir plus', 'عرض المزيد')}
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 px-3 py-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />)}
            </div>
          ) : (
            <nav>
              {categories.map((cat) => {
                const Icon = iconForCategory(cat.nom);
                return (
                  <button
                    key={cat.id}
                    onClick={() => { onSelectCategory?.(cat); onClose(); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-4 text-left hover:bg-slate-50"
                  >
                    <Icon size={24} className="shrink-0 text-slate-800" strokeWidth={1.5} />
                    <span className="text-[15px] text-slate-900">{cat.nom}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <div className="mx-4 border-t border-slate-100" />

        {/* Simple links */}
        <div className="p-3 pb-6">
          <button
            onClick={() => { onBecomeVendor?.(); onClose(); }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left hover:bg-slate-50"
          >
            <span className="text-base font-semibold text-slate-800">{tr('Devenez vendeur', 'كن بائعًا')}</span>
            <ChevronRight size={16} className="text-slate-400 rtl:rotate-180" />
          </button>
          <button
            onClick={() => { onOpenSupport?.(); onClose(); }}
            className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left hover:bg-slate-50"
          >
            <span className="text-base font-semibold text-slate-800">{tr("Centre d'assistance", 'مركز المساعدة')}</span>
            <ChevronRight size={16} className="text-slate-400 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
