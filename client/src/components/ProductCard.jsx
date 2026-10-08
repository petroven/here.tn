import React from 'react';
import { Star, Heart, ShoppingCart } from 'lucide-react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import { absoluteImageUrl } from '../config/api.js';

export default function ProductCard({ product, isFavorite, onToggleFavorite, onOpen, onAddToCart, language = 'fr' }) {
  const isAr = language === 'ar';
  const hasPromo = product.prixAvant && product.prixAvant > product.prix;
  const promoPercent = hasPromo ? Math.round((1 - product.prix / product.prixAvant) * 100) : 0;
  const rating = Number(product.note || 0);

  return (
    <Card className="group relative overflow-hidden max-sm:!rounded-none max-sm:!border-0 max-sm:!bg-transparent max-sm:!shadow-none">
      {/* Image */}
      <button onClick={() => onOpen(product.id)} className="block w-full text-left">
        <div className="relative aspect-square overflow-hidden bg-slate-100 max-sm:aspect-[1/1.15] max-sm:rounded-2xl max-sm:bg-[#F4ECDF]">
          {product.image ? (
            <img loading="lazy" decoding="async"
              src={absoluteImageUrl(product.image)}
              alt={product.nom}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <ShoppingCart size={32} />
            </div>
          )}

          {hasPromo && (
            <span className="absolute left-2.5 top-2.5 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 px-2 py-1 text-[11px] font-black text-white shadow-md rtl:left-auto rtl:right-2.5">
              -{promoPercent}%
            </span>
          )}

          {onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(product.id, e); }}
              aria-label="Favoris"
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full glass-badge max-sm:bg-white/90 max-sm:shadow-sm text-slate-600 transition hover:text-rose-500 rtl:right-auto rtl:left-2.5"
            >
              <Heart size={15} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
            </button>
          )}

          {/* Ajout au panier : barre révélée au survol (PC). Sur téléphone, comme sur PC,
              la photo reste propre : l'ajout se fait depuis la fiche produit. */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
            disabled={product.stock < 1}
            className="absolute bottom-2.5 left-2.5 right-2.5 hidden items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white btn-primary-premium translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 disabled:opacity-40 sm:flex"
          >
            <ShoppingCart size={14} />
            {isAr ? 'أضف للسلة' : 'Ajouter'}
          </button>
        </div>

        <div className="space-y-1 p-3.5 max-sm:px-0.5 max-sm:pb-1 max-sm:pt-2">
          {product.boutique?.nom && (
            <p className="truncate text-[11px] font-semibold text-slate-400 max-sm:hidden">{product.boutique.nom}</p>
          )}
          <h3 className="truncate text-sm font-bold text-slate-900 max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:font-medium max-sm:leading-5">{product.nom}</h3>

          <div className="flex items-center gap-1 text-xs">
            <Star size={13} className="fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-600">{rating ? rating.toFixed(1) : (isAr ? 'جديد' : 'Nouveau')}</span>
            {product.nombreAvis > 0 && <span className="text-slate-400">({product.nombreAvis})</span>}
          </div>

          <div className="flex items-center gap-2">
            <strong className="text-base font-black text-[#C4532C]">{Number(product.prix).toFixed(3)} TND</strong>
            {hasPromo && (
              <span className="text-xs text-slate-400 line-through">{Number(product.prixAvant).toFixed(3)}</span>
            )}
          </div>
        </div>
      </button>
    </Card>
  );
}
