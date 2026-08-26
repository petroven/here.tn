import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Heart, MessageSquare, PackageCheck, ShieldCheck, Star, Store,
  Truck, ShoppingCart, Zap, ChevronLeft, ChevronRight, RotateCcw,
} from 'lucide-react';
import ProductCard from '../components/ProductCard';

function Avatar({ nom, prenom }) {
  const initials = `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase() || '?';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-200 to-blue-200 text-xs font-black text-[#7C3AED]">
      {initials}
    </span>
  );
}

export default function ProductPage({ productId, language = 'fr', onBack, onOpenStore, onOpenProduct, onAddToCart, onStartChat }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [product, setProduct] = useState(null);
  const [variant, setVariant] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gouvernorats, setGouvernorats] = useState([]);
  const [selectedGouvernoratId, setSelectedGouvernoratId] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [similar, setSimilar] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);

  const tabsRef = useRef({});
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/produits/${productId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setProduct(data.data);
          setVariant(data.data.variantes?.[0] || null);
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    setActiveTab('description');
    setImageIndex(0);
  }, [productId]);

  useEffect(() => {
    fetch('/api/gouvernorats')
      .then((response) => response.json())
      .then((data) => { if (data.success) setGouvernorats(data.data); })
      .catch(() => setGouvernorats([]));
  }, []);

  useEffect(() => {
    if (!product?.categorie?.id) return;
    fetch(`/api/produits?categoryId=${product.categorie.id}&limit=8`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setSimilar(data.data.filter((p) => p.id !== product.id)); })
      .catch(() => setSimilar([]));
  }, [product]);

  useLayoutEffect(() => {
    const el = tabsRef.current[activeTab];
    if (el) setUnderline({ left: el.offsetLeft, width: el.offsetWidth });
  }, [activeTab, loading]);

  const shippingFees = gouvernorats.map((g) => Number(g.fraisLivraison));
  const minFee = shippingFees.length ? Math.min(...shippingFees) : null;
  const maxFee = shippingFees.length ? Math.max(...shippingFees) : null;
  const selectedFee = selectedGouvernoratId
    ? gouvernorats.find((g) => String(g.id) === String(selectedGouvernoratId))?.fraisLivraison
    : null;
  const isTunis = (nom) => /tunis/i.test(nom || '');
  const estimatedDelay = (nom) => (isTunis(nom) ? '24-48h' : '48-72h');

  const images = useMemo(() => [product?.image, ...(product?.images || [])].filter(Boolean), [product]);
  const price = Number(product?.prix || 0) + Number(variant?.prixSupplement || 0);
  const rating = Number(product?.note || 0);
  const reviews = product?.Avis || [];
  const hasPromo = product?.prixAvant && product.prixAvant > product.prix;
  // Le vendeur ne peut que resserrer la fenêtre de retour de sa catégorie,
  // jamais l'élargir — voir server/src/utils/returnPolicy.js (même règle).
  const delaiRetourJours = useMemo(() => {
    if (!product) return null;
    const base = Number.isFinite(product.categorie?.delaiRetourJours) ? product.categorie.delaiRetourJours : 14;
    const override = product.delaiRetourJoursOverride;
    return Number.isFinite(override) ? Math.max(0, Math.min(base, override)) : base;
  }, [product]);

  if (loading) return <div className="min-h-screen animate-pulse bg-slate-50 p-8"><div className="mx-auto h-96 max-w-6xl rounded-3xl bg-slate-200" /></div>;
  if (!product) return <div className="p-10 text-center text-slate-600">{tr('Produit introuvable.', 'المنتج غير موجود.')}</div>;

  const addToCart = () => onAddToCart({ id: product.id, nom: product.nom, prix: price, boutiqueId: product.boutiqueId, boutiqueNom: product.boutique?.nom || tr('Boutique locale', 'متجر محلي'), image: product.image, stock: variant ? variant.stock : product.stock, varianteId: variant?.id || null, selectedVariantName: variant ? [variant.taille, variant.couleur, variant.pointure].filter(Boolean).join(' / ') : null });

  const tabs = [
    { key: 'description', label: tr('Description', 'الوصف') },
    { key: 'avis', label: tr('Avis', 'التقييمات') },
    { key: 'livraison', label: tr('Livraison', 'التوصيل') },
  ];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 pb-24 pt-7 sm:px-6 md:pb-7">
      <main className="mx-auto max-w-6xl space-y-6">
        <button onClick={onBack} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-white">
          <ArrowLeft size={16} className="rtl:rotate-180" /> {tr('Retour aux produits', 'رجوع إلى المنتجات')}
        </button>

        <section className="grid gap-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft lg:grid-cols-[1fr_1fr] lg:p-8">
          {/* Gallery */}
          <div className="space-y-3">
            <div
              className="relative h-[360px] cursor-zoom-in overflow-hidden rounded-3xl bg-slate-100 sm:h-[450px]"
              onMouseEnter={() => setZoomed(true)}
              onMouseLeave={() => setZoomed(false)}
            >
              {hasPromo && (
                <span className="absolute left-3 top-3 z-10 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 px-2.5 py-1 text-xs font-black text-white shadow-md rtl:left-auto rtl:right-3">
                  -{Math.round((1 - product.prix / product.prixAvant) * 100)}%
                </span>
              )}
              {images[imageIndex] ? (
                <img
                  src={images[imageIndex]}
                  alt={product.nom}
                  className={`h-full w-full object-cover transition-transform duration-500 ${zoomed ? 'scale-125' : 'scale-100'}`}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300"><PackageCheck size={56} /></div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={image}
                    onClick={() => setImageIndex(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${index === imageIndex ? 'border-[#7C3AED]' : 'border-transparent hover:border-slate-200'}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => onOpenStore(product.boutique?.id)} className="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-3 py-2 text-left transition hover:bg-slate-100">
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-100 to-blue-100 text-xs font-black text-[#7C3AED]">
                  {product.boutique?.logo ? <img src={product.boutique.logo} alt="" className="h-full w-full object-cover" /> : (product.boutique?.nom || 'B').slice(0, 1)}
                </span>
                <span>
                  <span className="block text-xs font-bold text-slate-800">{product.boutique?.nom || tr('Boutique locale', 'متجر محلي')}</span>
                  <span className="text-[10px] font-semibold text-[#7C3AED]">{tr('Voir la boutique', 'زيارة المتجر')} →</span>
                </span>
              </button>
              <button
                onClick={() => setIsFavorite((v) => !v)}
                aria-label={tr('Ajouter aux favoris', 'أضف إلى المفضلة')}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:text-rose-500"
              >
                <Heart size={19} className={isFavorite ? 'fill-rose-500 text-rose-500' : ''} />
              </button>
            </div>

            <div>
              <h1 className="text-3xl font-black leading-tight text-slate-900">{product.nom}</h1>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 font-bold text-amber-600"><Star size={16} className="fill-amber-400 text-amber-400" /> {rating ? rating.toFixed(1) : tr('Nouveau', 'جديد')}</span>
                <span className="text-slate-500">({product.nombreAvis || reviews.length} {tr('avis', 'تقييم')})</span>
              </div>
            </div>

            <div className="border-y border-slate-100 py-5">
              <strong className="text-gradient-brand text-3xl font-black sm:text-4xl">{price.toFixed(3)} TND</strong>
              {hasPromo && <div className="mt-1 text-sm text-slate-400 line-through">{Number(product.prixAvant).toFixed(3)} TND</div>}
              <p className="mt-2 text-xs font-bold text-emerald-700">
                {(variant ? variant.stock : product.stock) > 0 ? `${variant ? variant.stock : product.stock} ${tr('en stock', 'متوفر')}` : tr('Rupture de stock', 'نفذ المخزون')}
              </p>
              <p className={`mt-2 flex items-center gap-1.5 text-xs font-bold ${delaiRetourJours > 0 ? 'text-slate-500' : 'text-amber-600'}`}>
                <RotateCcw size={14} />
                {delaiRetourJours > 0
                  ? tr(`Retour possible sous ${delaiRetourJours} jours`, `الإرجاع ممكن خلال ${delaiRetourJours} يومًا`)
                  : tr('Produit non retournable', 'منتج غير قابل للإرجاع')}
              </p>
            </div>

            {product.variantes?.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">{tr('Choisir une variante', 'اختر الخيار')}</label>
                <div className="flex flex-wrap gap-2">
                  {product.variantes.map((item) => {
                    const label = [item.taille, item.couleur, item.pointure].filter(Boolean).join(' / ') || `Option ${item.id}`;
                    const active = variant?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setVariant(item)}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 ${active ? 'gradient-brand text-white shadow-md' : 'border border-slate-200 text-slate-700 hover:border-[#7C3AED]'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={addToCart}
                disabled={(variant ? variant.stock : product.stock) < 1 || (product.variantes?.length > 0 && !variant)}
                className="btn-primary-premium flex flex-1 items-center justify-center gap-2 py-3.5 text-sm"
              >
                <ShoppingCart size={17} /> {tr('Ajouter au panier', 'أضف إلى السلة')}
              </button>
              <button
                onClick={addToCart}
                disabled={(variant ? variant.stock : product.stock) < 1}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                <Zap size={16} /> {tr('Acheter maintenant', 'اشتر الآن')}
              </button>
            </div>

            {product.boutique?.vendeurId && onStartChat && (
              <button onClick={() => onStartChat(product.boutique.vendeurId, `Produit: ${product.nom}`)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                <MessageSquare size={16} /> {tr('Contacter le vendeur', 'تواصل مع البائع')}
              </button>
            )}
          </div>
        </section>

        {/* Tabs */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-soft">
          <div className="relative flex gap-6 border-b border-slate-100 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                ref={(el) => { tabsRef.current[tab.key] = el; }}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 text-sm font-bold transition-colors ${activeTab === tab.key ? 'text-[#7C3AED]' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab.label}
              </button>
            ))}
            <span
              className="absolute bottom-0 h-0.5 rounded-full gradient-brand transition-all duration-300"
              style={{ left: underline.left, width: underline.width }}
            />
          </div>

          <div className="p-6">
            {activeTab === 'description' && (
              <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{product.description}</p>
            )}

            {activeTab === 'avis' && (
              reviews.length === 0 ? (
                <p className="text-sm text-slate-500">{tr('Aucun avis publié pour le moment.', 'لا يوجد تقييم بعد.')}</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {reviews.map((review) => (
                    <article key={review.id} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                      <Avatar nom={review.auteur?.nom} prenom={review.auteur?.prenom} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-sm text-slate-800">{review.auteur?.prenom} {review.auteur?.nom}</strong>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-600"><Star size={13} className="fill-amber-400 text-amber-400" /> {review.note}/5</span>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-600">{review.commentaire || tr('Avis sans commentaire.', 'بدون تعليق.')}</p>
                        <p className="mt-2 text-[11px] text-emerald-700">{tr('Avis vérifié', 'تقييم موثق')} · {new Date(review.createdAt || Date.now()).toLocaleDateString(isAr ? 'ar-TN' : 'fr-TN')}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )
            )}

            {activeTab === 'livraison' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <Truck className="shrink-0 text-[#7C3AED]" size={20} />
                    <div className="w-full">
                      <h3 className="text-sm font-extrabold">{tr('Livraison en Tunisie', 'التوصيل في تونس')}</h3>
                      {minFee !== null && (
                        <p className="mt-1 text-xs text-slate-600">
                          {minFee === maxFee ? `${minFee.toFixed(3)} TND` : `${minFee.toFixed(3)} - ${maxFee.toFixed(3)} TND`} {tr('selon votre gouvernorat · livraison sous 24-72h', 'حسب ولايتك · التوصيل خلال 24-72 ساعة')}
                        </p>
                      )}
                      <select
                        value={selectedGouvernoratId}
                        onChange={(e) => setSelectedGouvernoratId(e.target.value)}
                        className="input-premium mt-2 w-full px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none"
                      >
                        <option value="">{tr('Vérifier les frais pour mon gouvernorat', 'تحقق من الرسوم حسب ولايتك')}</option>
                        {gouvernorats.map((g) => <option key={g.id} value={g.id}>{isAr ? g.nomAr : g.nom}</option>)}
                      </select>
                      {selectedFee !== null && selectedFee !== undefined && (
                        <p className="mt-2 rounded-lg bg-[#F5F3FF] px-2.5 py-1.5 text-xs font-bold text-[#7C3AED]">
                          {Number(selectedFee).toFixed(3)} TND · {tr('livraison estimée sous', 'التوصيل خلال')} {estimatedDelay(gouvernorats.find((g) => String(g.id) === String(selectedGouvernoratId))?.nom)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="text-emerald-700" size={20} />
                    <div>
                      <h3 className="text-sm font-extrabold">{tr('Protection acheteur', 'حماية المشتري')}</h3>
                      <p className="mt-1 text-xs text-slate-600">{tr('Retours et suivi selon la politique du vendeur.', 'إرجاع وتتبع حسب سياسة البائع.')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Similar products */}
        {similar.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-slate-900">{tr('Produits similaires', 'منتجات مشابهة')}</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {similar.map((p) => (
                <div key={p.id} className="w-44 shrink-0 sm:w-52">
                  <ProductCard
                    product={p}
                    language={language}
                    onOpen={onOpenProduct}
                    onAddToCart={() => onAddToCart({ id: p.id, nom: p.nom, prix: p.prix, boutiqueId: p.boutiqueId, image: p.image, stock: p.stock, varianteId: null })}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
