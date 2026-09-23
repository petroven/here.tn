import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Heart, MessageSquare, PackageCheck, ShieldCheck, Star, Store,
  Truck, ShoppingCart, Zap, ChevronLeft, ChevronRight, RotateCcw, Minus, Plus, Check,
} from 'lucide-react';
import ProductCard from '../components/ProductCard';
import Avatar from '../components/ui/Avatar';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const SWATCH_COLORS = {
  noir: '#1E1B18', black: '#1E1B18',
  blanc: '#FFFFFF', white: '#FFFFFF',
  gris: '#8C8378', grey: '#8C8378', gray: '#8C8378',
  bleu: '#3B5B8C', blue: '#3B5B8C',
  rouge: '#B3402C', red: '#B3402C',
  vert: '#4C7A5A', green: '#4C7A5A',
  jaune: '#D6A93A', yellow: '#D6A93A',
  rose: '#D693A8', pink: '#D693A8',
  beige: '#E4D8C6',
  marron: '#6E4A2E', brown: '#6E4A2E',
  orange: '#C4532C',
  violet: '#7A5C9E', purple: '#7A5C9E',
};

function colorSwatch(nom = '') {
  return SWATCH_COLORS[nom.trim().toLowerCase()] || '#C4532C';
}

export default function ProductPage({ productId, language = 'fr', onBack, onOpenStore, onOpenProduct, onAddToCart, onStartChat }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [product, setProduct] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gouvernorats, setGouvernorats] = useState([]);
  const [selectedGouvernoratId, setSelectedGouvernoratId] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [similar, setSimilar] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [qty, setQty] = useState(1);
  const [selectedCouleur, setSelectedCouleur] = useState(null);
  const [selectedTaille, setSelectedTaille] = useState(null);

  const tabsRef = useRef({});
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  useDocumentTitle(
    product ? `${product.nom} — BuyHere` : undefined,
    product?.description ? product.description.slice(0, 160) : undefined,
  );

  useEffect(() => {
    setLoading(true);
    fetch(`/api/produits/${productId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setProduct(data.data);
          const firstVariant = data.data.variantes?.[0] || null;
          setSelectedCouleur(firstVariant?.couleur || null);
          setSelectedTaille(firstVariant?.taille || firstVariant?.pointure || null);
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
    setActiveTab('description');
    setImageIndex(0);
    setQty(1);
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

  // Deux axes indépendants (couleur / taille-pointure) dérivés de la liste
  // brute de variantes — un produit peut n'en avoir qu'un des deux, ou
  // aucun. La variante active est celle qui correspond aux deux sélections
  // (ou juste l'axe présent), pas un état séparé à synchroniser à la main.
  const variantAxes = useMemo(() => {
    const variantes = product?.variantes || [];
    return {
      couleurs: [...new Set(variantes.map((v) => v.couleur).filter(Boolean))],
      tailles: [...new Set(variantes.map((v) => v.taille || v.pointure).filter(Boolean))],
    };
  }, [product]);

  const variant = useMemo(() => {
    const variantes = product?.variantes || [];
    if (variantes.length === 0) return null;
    const hasCouleur = variantAxes.couleurs.length > 0;
    const hasTaille = variantAxes.tailles.length > 0;
    if (!hasCouleur && !hasTaille) return variantes[0];
    return variantes.find((v) => {
      const couleurOk = !hasCouleur || v.couleur === selectedCouleur;
      const tailleOk = !hasTaille || (v.taille || v.pointure) === selectedTaille;
      return couleurOk && tailleOk;
    }) || null;
  }, [product, variantAxes, selectedCouleur, selectedTaille]);

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

  if (loading) return <div className="min-h-screen animate-pulse bg-slate-50 p-8"><div className="mx-auto h-96 max-w-6xl rounded-lg bg-slate-200" /></div>;
  if (!product) return <div className="p-10 text-center text-slate-600">{tr('Produit introuvable.', 'المنتج غير موجود.')}</div>;

  const addToCart = () => {
    // handleAddToCart (App.jsx) ajoute 1 unité par appel et plafonne déjà au
    // stock — pas de changement à cette logique, on l'appelle qty fois.
    for (let i = 0; i < qty; i++) {
      onAddToCart({ id: product.id, nom: product.nom, prix: price, boutiqueId: product.boutiqueId, boutiqueNom: product.boutique?.nom || tr('Boutique locale', 'متجر محلي'), image: product.image, stock: variant ? variant.stock : product.stock, varianteId: variant?.id || null, selectedVariantName: variant ? [variant.taille, variant.couleur, variant.pointure].filter(Boolean).join(' / ') : null });
    }
  };

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

        <section className="grid gap-7 rounded-lg border border-slate-200 bg-white p-5 shadow-soft lg:grid-cols-[1fr_1fr] lg:p-8">
          {/* Gallery — vignettes en bande verticale à gauche de la photo principale */}
          <div className="flex gap-3">
            {images.length > 1 && (
              <div className="flex shrink-0 flex-col gap-2 overflow-y-auto">
                {images.map((image, index) => (
                  <button
                    key={image}
                    onClick={() => setImageIndex(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${index === imageIndex ? 'border-[#C4532C]' : 'border-transparent hover:border-slate-200'}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div
              className="relative h-[360px] w-full cursor-zoom-in overflow-hidden rounded-lg bg-slate-100 sm:h-[450px]"
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
          </div>

          {/* Info */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-end">
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

            {variantAxes.couleurs.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">
                  {tr('Couleur', 'اللون')}{selectedCouleur ? ` — ${selectedCouleur}` : ''}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {variantAxes.couleurs.map((couleur) => {
                    const active = selectedCouleur === couleur;
                    return (
                      <button
                        key={couleur}
                        onClick={() => setSelectedCouleur(couleur)}
                        aria-label={couleur}
                        title={couleur}
                        className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${active ? 'border-[#C4532C]' : 'border-transparent hover:border-slate-300'}`}
                      >
                        <span
                          className="h-7 w-7 rounded-full ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: colorSwatch(couleur) }}
                        />
                        {active && <Check size={13} className="absolute text-white mix-blend-difference" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {variantAxes.tailles.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-800">{tr('Taille', 'المقاس')}</label>
                <div className="flex flex-wrap gap-2">
                  {variantAxes.tailles.map((taille) => {
                    const active = selectedTaille === taille;
                    return (
                      <button
                        key={taille}
                        onClick={() => setSelectedTaille(taille)}
                        className={`min-w-[2.75rem] rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 ${active ? 'gradient-brand text-white shadow-md' : 'border border-slate-200 text-slate-700 hover:border-[#C4532C]'}`}
                      >
                        {taille}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-bold text-slate-800">{tr('Quantité', 'الكمية')}</label>
              <div className="inline-flex items-center rounded-xl border border-slate-200">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:text-[#C4532C] disabled:opacity-30"
                >
                  <Minus size={15} />
                </button>
                <span className="w-10 text-center text-sm font-bold text-slate-900">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(q + 1, variant ? variant.stock : product.stock))}
                  disabled={qty >= (variant ? variant.stock : product.stock)}
                  className="flex h-10 w-10 items-center justify-center text-slate-600 transition hover:text-[#C4532C] disabled:opacity-30"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>

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
              <button
                onClick={() => onStartChat(
                  product.boutique.vendeurId,
                  `${tr('Produit', 'المنتج')}: ${product.nom}`,
                  tr(`Bonjour, j'ai une question concernant le produit : ${product.nom}.`, `مرحبًا، لدي سؤال بخصوص المنتج: ${product.nom}.`),
                )}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <MessageSquare size={16} /> {tr('Contacter le vendeur', 'تواصل مع البائع')}
              </button>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-start">
        {/* Tabs */}
        <section className="rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="relative flex gap-6 border-b border-slate-100 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                ref={(el) => { tabsRef.current[tab.key] = el; }}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 text-sm font-bold transition-colors ${activeTab === tab.key ? 'text-[#C4532C]' : 'text-slate-400 hover:text-slate-600'}`}
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
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                          {review.verifie && <span className="font-bold text-emerald-700">{tr('✓ Achat vérifié', '✓ عملية شراء موثقة')}</span>}
                          {review.verifie && '·'}
                          {new Date(review.createdAt || Date.now()).toLocaleDateString(isAr ? 'ar-TN' : 'fr-TN')}
                        </p>
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
                    <Truck className="shrink-0 text-[#C4532C]" size={20} />
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
                        <p className="mt-2 rounded-lg bg-[#F8E4DE] px-2.5 py-1.5 text-xs font-bold text-[#C4532C]">
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

        {/* La boutique */}
        <aside className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#F8E4DE] text-sm font-black text-[#C4532C]">
              {product.boutique?.logo ? <img src={product.boutique.logo} alt="" className="h-full w-full object-cover" /> : (product.boutique?.nom || 'B').slice(0, 1)}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold text-slate-900">{product.boutique?.nom || tr('Boutique locale', 'متجر محلي')}</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><ShieldCheck size={12} /> {tr('Boutique vérifiée', 'متجر موثّق')}</span>
            </div>
          </div>
          {product.boutique?.description && (
            <p className="line-clamp-3 text-xs leading-6 text-slate-600">{product.boutique.description}</p>
          )}
          <button
            onClick={() => onOpenStore(product.boutique?.id)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 transition hover:border-[#C4532C] hover:text-[#C4532C]"
          >
            <Store size={14} /> {tr('Visiter la boutique', 'زيارة المتجر')}
          </button>
        </aside>
        </div>

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
