import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Star, ShoppingCart, Store, X, AlertCircle, Sparkles,
  ChevronDown, SlidersHorizontal, LayoutGrid, List, ChevronLeft, ChevronRight, MapPin, GitCompare,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import ProductCard from '../components/ProductCard';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { useCompare, MAX_COMPARE } from '../utils/compare.js';
import { regionsFromBoutiques } from '../utils/regions.js';

function FilterSection({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-slate-100 py-4 last:border-b-0">
      <button onClick={onToggle} className="flex w-full items-center justify-between text-left">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className="grid overflow-hidden transition-all duration-300"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Marketplace({ cartItems = [], onUpdateCart, onStartChat, onViewCart, onViewProduct, onViewStores, language = 'fr', initialCategoryId = null }) {
  const { t } = useTranslation(language);
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [products, setProducts] = useState([]);
  const [boutiques, setBoutiques] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  // Liens depuis l'accueil : /catalogue?promo=1, /catalogue?region=<id>.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [promoOnly, setPromoOnly] = useState(searchParams.get('promo') === '1');
  const [regionId, setRegionId] = useState(Number(searchParams.get('region')) || null);
  const [selectedStore, setSelectedStore] = useState(null);
  const compare = useCompare();
  const [compareNotice, setCompareNotice] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [openSections, setOpenSections] = useState({ category: true, price: true, availability: true, region: true, store: false, rating: true });
  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchMarketplaceData();
  }, [currentPage, searchTerm, selectedStore, minPrice, maxPrice, inStockOnly, promoOnly, regionId, sort, selectedCategory]);

  useEffect(() => {
    if (token && products.length > 0) fetchWishlistStatus();
  }, [token, products]);

  const fetchMarketplaceData = async () => {
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '24', sort });
      if (Number(minPrice) > 0) params.set('minPrice', String(Number(minPrice)));
      if (Number(maxPrice) > 0) params.set('maxPrice', String(Number(maxPrice)));
      if (inStockOnly) params.set('inStock', 'true');
      if (promoOnly) params.set('promotion', 'true');
      if (regionId) params.set('gouvernoratId', String(regionId));
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (selectedCategory?.id) params.set('categoryId', String(selectedCategory.id));
      if (selectedStore) params.set('storeId', String(selectedStore.id));
      const [productsRes, boutiquesRes] = await Promise.all([
        fetch(`/api/produits?${params.toString()}`),
        fetch('/api/boutiques'),
      ]);
      const productsData = await productsRes.json();
      const boutiquesData = await boutiquesRes.json();
      if (productsData.success) {
        setProducts(productsData.data);
        setTotalPages(productsData.pagination?.totalPages || 1);
      }
      if (boutiquesData.success) setBoutiques(boutiquesData.data);
    } catch (error) {
      console.error('Error fetching marketplace data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/categories')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setCategories(data.data);
          if (initialCategoryId) {
            const match = data.data.find((c) => c.id === initialCategoryId);
            if (match) setSelectedCategory(match);
          }
        }
      })
      .catch(() => {});
  }, [initialCategoryId]);

  const fetchWishlistStatus = async () => {
    const ids = products.map((p) => p.id).join(',');
    if (!ids) return;
    try {
      const response = await fetch(`/api/wishlist/check?ids=${ids}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (data.success) setWishlistIds(data.data);
    } catch (err) {
      console.error('Error checking wishlist status:', err);
    }
  };

  const toggleWishlist = async (productId) => {
    if (!token) {
      alert(tr('Veuillez vous connecter pour ajouter des favoris.', 'يرجى تسجيل الدخول لإضافة المفضلة.'));
      return;
    }
    const inWishlist = wishlistIds.includes(productId);
    try {
      if (inWishlist) {
        const response = await fetch(`/api/wishlist/${productId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) setWishlistIds(wishlistIds.filter((id) => id !== productId));
      } else {
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ produitId: productId }),
        });
        const data = await response.json();
        if (data.success) setWishlistIds([...wishlistIds, productId]);
      }
    } catch (err) {
      console.error('Error toggling wishlist:', err);
    }
  };

  const handleAddToCart = (product, variant) => {
    onUpdateCart({
      id: product.id,
      nom: product.nom,
      prix: product.prix + (variant?.prixSupplement || 0),
      boutiqueId: product.boutiqueId,
      boutiqueNom: product.boutique?.nom || tr('Boutique locale', 'متجر محلي'),
      image: product.image,
      stock: variant ? variant.stock : product.stock,
      varianteId: variant ? variant.id : null,
      selectedVariantName: variant ? [variant.taille, variant.couleur, variant.pointure].filter(Boolean).join(' / ') : null,
    });
  };

  const filteredProducts = useMemo(() => products.filter((product) => (
    minRating === 0 || Number(product.note || 0) >= minRating
  )), [products, minRating]);

  const regions = useMemo(() => regionsFromBoutiques(boutiques), [boutiques]);
  const selectedRegion = regions.find((region) => region.id === regionId);
  const regionName = (region) => (isAr && region.nomAr) || region.nom;

  const toggleCompare = (productId) => {
    if (!compare.toggle(productId)) setCompareNotice(true);
    else setCompareNotice(false);
  };

  const priceLabel = [
    Number(minPrice) > 0 && `≥ ${Number(minPrice)}`,
    Number(maxPrice) > 0 && `≤ ${Number(maxPrice)}`,
  ].filter(Boolean).join(' · ');

  const activeChips = [
    selectedCategory && { key: 'category', label: selectedCategory.nom, clear: () => setSelectedCategory(null) },
    selectedStore && { key: 'store', label: selectedStore.nom, clear: () => setSelectedStore(null) },
    selectedRegion && { key: 'region', label: regionName(selectedRegion), clear: () => setRegionId(null) },
    priceLabel && { key: 'price', label: `${priceLabel} TND`, clear: () => { setMinPrice(''); setMaxPrice(''); } },
    inStockOnly && { key: 'stock', label: tr('En stock', 'متوفر'), clear: () => setInStockOnly(false) },
    promoOnly && { key: 'promo', label: tr('En promotion', 'في التخفيض'), clear: () => setPromoOnly(false) },
    minRating > 0 && { key: 'rating', label: `${minRating}+ ★`, clear: () => setMinRating(0) },
  ].filter(Boolean);

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-slate-600">{t('loading')}</div>;
  }

  const FiltersPanel = (
    <>
      <FilterSection title={tr('Catégorie', 'الفئة')} open={openSections.category} onToggle={() => toggleSection('category')}>
        <div className="space-y-1">
          <button
            onClick={() => { setCurrentPage(1); setSelectedCategory(null); }}
            className={`w-full rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${!selectedCategory ? 'bg-[#F8E4DE] font-bold text-[#C4532C]' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {tr('Toutes', 'الكل')}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => { setCurrentPage(1); setSelectedCategory(category); }}
              className={`w-full rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${selectedCategory?.id === category.id ? 'bg-[#F8E4DE] font-bold text-[#C4532C]' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {category.nom}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={`${tr('Prix', 'السعر')} (TND)`} open={openSections.price} onToggle={() => toggleSection('price')}>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-[11px] font-bold text-slate-400">{tr('Min', 'من')}</span>
            <input
              id="filter-min-price"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="0"
              value={minPrice}
              onChange={(e) => { setCurrentPage(1); setMinPrice(e.target.value); }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#C4532C]"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-[11px] font-bold text-slate-400">{tr('Max', 'إلى')}</span>
            <input
              id="filter-max-price"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={tr('Sans limite', 'بدون حد')}
              value={maxPrice}
              onChange={(e) => { setCurrentPage(1); setMaxPrice(e.target.value); }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#C4532C]"
            />
          </label>
        </div>
      </FilterSection>

      <FilterSection title={tr('Disponibilité', 'التوفر')} open={openSections.availability} onToggle={() => toggleSection('availability')}>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-600">
            <input id="filter-in-stock" type="checkbox" checked={inStockOnly} onChange={(e) => { setCurrentPage(1); setInStockOnly(e.target.checked); }} className="h-4 w-4 accent-[#C4532C]" />
            {tr('En stock uniquement', 'المتوفر فقط')}
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slate-600">
            <input id="filter-promo" type="checkbox" checked={promoOnly} onChange={(e) => { setCurrentPage(1); setPromoOnly(e.target.checked); }} className="h-4 w-4 accent-[#C4532C]" />
            {tr('En promotion', 'في التخفيض')}
          </label>
        </div>
      </FilterSection>

      {regions.length > 0 && (
        <FilterSection title={tr('Région', 'الجهة')} open={openSections.region} onToggle={() => toggleSection('region')}>
          <div className="space-y-1">
            <button
              onClick={() => { setCurrentPage(1); setRegionId(null); }}
              className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${!regionId ? 'bg-[#F8E4DE] font-bold text-[#C4532C]' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <MapPin size={14} /> {tr('Toute la Tunisie', 'كل تونس')}
            </button>
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => { setCurrentPage(1); setRegionId(region.id); }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${regionId === region.id ? 'bg-[#F8E4DE] font-bold text-[#C4532C]' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <span className="flex items-center gap-2"><MapPin size={14} /> {regionName(region)}</span>
                <span className="text-[11px] text-slate-400">{region.produits}</span>
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title={tr('Note minimale', 'التقييم الأدنى')} open={openSections.rating} onToggle={() => toggleSection('rating')}>
        <div className="flex flex-wrap gap-2">
          {[4, 3, 2].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(minRating === r ? 0 : r)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${minRating === r ? 'gradient-brand text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {r}+ <Star size={11} className="fill-current" />
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={tr('Boutique', 'المتجر')} open={openSections.store} onToggle={() => toggleSection('store')}>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setCurrentPage(1); setSelectedStore(null); }}
            className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${!selectedStore ? 'bg-[#F8E4DE] font-bold text-[#C4532C]' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Store size={14} /> {tr('Toutes les boutiques', 'كل المتاجر')}
          </button>
          {boutiques.map((boutique) => (
            <button
              key={boutique.id}
              onClick={() => { setCurrentPage(1); setSelectedStore(boutique); }}
              className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${selectedStore?.id === boutique.id ? 'bg-[#F8E4DE] font-bold text-[#C4532C]' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Store size={14} /> {boutique.nom}
            </button>
          ))}
        </div>
      </FilterSection>
    </>
  );

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 pb-20 font-sans md:pb-0">
      {/* Header Banner */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 p-5 shadow-soft backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2 text-slate-900">
            <Sparkles size={22} className="text-[#C4532C]" />
            <h1 className="text-xl font-black">{tr('Catalogue', 'الكتالوج')}</h1>
          </div>

          <Input
            icon={Search}
            containerClassName="w-full max-w-md flex-1"
            type="text"
            placeholder={tr('Rechercher un produit, une catégorie...', 'ابحث عن منتج أو فئة...')}
            value={searchTerm}
            onChange={(e) => { setCurrentPage(1); setSearchTerm(e.target.value); }}
          />

          <div className="flex items-center gap-3">
            {onViewStores && <button onClick={onViewStores} className="hidden rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:block">{tr('Toutes les boutiques', 'كل المتاجر')}</button>}
            {cartItems.length > 0 && onViewCart && (
              <button onClick={onViewCart} className="btn-primary-premium flex items-center gap-1.5 px-4 py-2 text-xs">
                <ShoppingCart size={16} />
                {tr('Panier', 'السلة')} ({cartItems.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bannière de catégorie — uniquement quand une catégorie est sélectionnée */}
      {selectedCategory && (
        <div className="relative overflow-hidden bg-[#1E1B18] text-white">
          <img
            src="https://images.unsplash.com/photo-1761090617068-f1b3257d27ad?fm=jpg&q=70&w=1600&auto=format&fit=crop"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-45"
            style={{ filter: 'sepia(20%) saturate(130%)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#1E1B18] via-[#1E1B18]/85 to-[#C4532C]/30" />
          <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <nav className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <span>{tr('Accueil', 'الرئيسية')}</span>
              <ChevronRight size={11} className="rtl:rotate-180" />
              <button onClick={() => { setCurrentPage(1); setSelectedCategory(null); }} className="hover:text-white">{tr('Catalogue', 'الكتالوج')}</button>
              <ChevronRight size={11} className="rtl:rotate-180" />
              <span className="text-white">{selectedCategory.nom}</span>
            </nav>
            <h2 className="text-2xl font-black sm:text-3xl">{selectedCategory.nom}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {filteredProducts.length} {tr('produits dans cette catégorie', 'منتج في هذه الفئة')}
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">

          {/* Filters Sidebar — desktop only */}
          <aside className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white px-5 shadow-soft">
              {FiltersPanel}
            </div>
          </aside>

          {/* Catalog */}
          <div className="lg:col-span-3">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {filteredProducts.length} {tr('produits trouvés', 'منتج')}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 lg:hidden"
                >
                  <SlidersHorizontal size={14} /> {tr('Filtres', 'الفلاتر')}
                </button>

                <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 sm:flex">
                  <button onClick={() => setViewMode('grid')} className={`rounded-lg p-1.5 transition ${viewMode === 'grid' ? 'bg-[#F8E4DE] text-[#C4532C]' : 'text-slate-400'}`}><LayoutGrid size={16} /></button>
                  <button onClick={() => setViewMode('list')} className={`rounded-lg p-1.5 transition ${viewMode === 'list' ? 'bg-[#F8E4DE] text-[#C4532C]' : 'text-slate-400'}`}><List size={16} /></button>
                </div>

                <select
                  value={sort}
                  onChange={(event) => { setCurrentPage(1); setSort(event.target.value); }}
                  className="input-premium px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="newest">{tr('Nouveautés', 'الأحدث')}</option>
                  <option value="price_asc">{tr('Prix croissant', 'السعر تصاعديًا')}</option>
                  <option value="price_desc">{tr('Prix décroissant', 'السعر تنازليًا')}</option>
                  <option value="rating">{tr('Meilleures notes', 'الأعلى تقييمًا')}</option>
                  <option value="best_sellers">{tr('Meilleures ventes', 'الأكثر مبيعًا')}</option>
                </select>
              </div>
            </div>

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {activeChips.map((chip) => (
                  <Badge key={chip.key} tone="violet" className="pl-3 pr-1.5 py-1">
                    {chip.label}
                    <button onClick={chip.clear} className="ml-1 rounded-full p-0.5 hover:bg-[#C4532C]/15 rtl:ml-0 rtl:mr-1">
                      <X size={11} />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-soft">
                <AlertCircle size={40} className="mx-auto mb-3 text-slate-300" />
                {tr('Aucun produit ne correspond à vos filtres.', 'لا يوجد منتج مطابق لهذه الفلاتر.')}
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3' : 'flex flex-col gap-3'}>
                {filteredProducts.map((product) => (
                  viewMode === 'grid' ? (
                    <ProductCard
                      key={product.id}
                      product={product}
                      language={language}
                      isFavorite={wishlistIds.includes(product.id)}
                      onToggleFavorite={toggleWishlist}
                      isCompared={compare.has(product.id)}
                      onToggleCompare={toggleCompare}
                      onOpen={onViewProduct}
                      onAddToCart={(p) => handleAddToCart(p, null)}
                    />
                  ) : (
                    <button
                      key={product.id}
                      onClick={() => onViewProduct(product.id)}
                      className="card-premium flex items-center gap-4 p-3 text-left"
                    >
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {product.image ? <img src={product.image} alt={product.nom} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ShoppingCart size={20} /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold text-slate-900">{product.nom}</h3>
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Star size={12} className="fill-amber-400 text-amber-400" /> {Number(product.note || 0).toFixed(1)}</div>
                      </div>
                      <strong className="shrink-0 text-base font-black text-[#C4532C]">{Number(product.prix).toFixed(3)} TND</strong>
                    </button>
                  )
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                >
                  <ChevronLeft size={16} className="rtl:rotate-180" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition ${p === currentPage ? 'gradient-brand text-white shadow' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                >
                  <ChevronRight size={16} className="rtl:rotate-180" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barre de comparaison — visible dès qu'un produit est sélectionné */}
      {compare.ids.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 px-4 md:bottom-4">
          <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#1E1B18] px-4 py-3 text-white shadow-lg">
            <div className="text-xs">
              <p className="font-bold">
                <GitCompare size={14} className="mr-1.5 inline rtl:ml-1.5 rtl:mr-0" />
                {compare.ids.length}/{MAX_COMPARE} {tr('produits à comparer', 'منتجات للمقارنة')}
              </p>
              {compareNotice && <p className="mt-0.5 text-[11px] text-[#E39B82]">{tr(`Maximum ${MAX_COMPARE} produits : retirez-en un d'abord.`, `الحد الأقصى ${MAX_COMPARE} منتجات: احذف واحدًا أولًا.`)}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { compare.clear(); setCompareNotice(false); }} className="rounded-xl border border-white/25 px-3 py-2 text-xs font-bold hover:bg-white/10">{tr('Vider', 'مسح')}</button>
              <button
                onClick={() => navigate('/comparer')}
                disabled={compare.ids.length < 2}
                className="btn-primary-premium px-4 py-2 text-xs disabled:opacity-50"
              >
                {compare.ids.length < 2 ? tr('Choisissez-en un autre', 'اختر منتجًا آخر') : tr('Comparer', 'قارن')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile filters drawer */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 animate-fadeIn">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">{tr('Filtres', 'الفلاتر')}</h2>
              <button onClick={() => setShowMobileFilters(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            {FiltersPanel}
            <button onClick={() => setShowMobileFilters(false)} className="btn-primary-premium mt-4 w-full py-3 text-sm">
              {tr('Voir les résultats', 'عرض النتائج')} ({filteredProducts.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Marketplace;
