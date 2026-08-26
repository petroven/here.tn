import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Star, ShoppingCart, Store, X, AlertCircle, Sparkles,
  ChevronDown, SlidersHorizontal, LayoutGrid, List, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import ProductCard from '../components/ProductCard';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';

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
  const [priceRange, setPriceRange] = useState([0, 500]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [openSections, setOpenSections] = useState({ category: true, price: true, store: false, rating: true });
  const toggleSection = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchMarketplaceData();
  }, [currentPage, searchTerm, selectedStore, priceRange[1], sort, selectedCategory]);

  useEffect(() => {
    if (token && products.length > 0) fetchWishlistStatus();
  }, [token, products]);

  const fetchMarketplaceData = async () => {
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '24', maxPrice: String(priceRange[1]), sort });
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

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesPrice = product.prix >= priceRange[0] && product.prix <= priceRange[1];
    const matchesRating = minRating === 0 || Number(product.note || 0) >= minRating;
    return matchesPrice && matchesRating;
  }), [products, priceRange, minRating]);

  const activeChips = [
    selectedCategory && { key: 'category', label: selectedCategory.nom, clear: () => setSelectedCategory(null) },
    selectedStore && { key: 'store', label: selectedStore.nom, clear: () => setSelectedStore(null) },
    priceRange[1] < 500 && { key: 'price', label: `≤ ${priceRange[1]} TND`, clear: () => setPriceRange([0, 500]) },
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
            className={`w-full rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${!selectedCategory ? 'bg-[#F5F3FF] font-bold text-[#7C3AED]' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {tr('Toutes', 'الكل')}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => { setCurrentPage(1); setSelectedCategory(category); }}
              className={`w-full rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${selectedCategory?.id === category.id ? 'bg-[#F5F3FF] font-bold text-[#7C3AED]' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {category.nom}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={`${tr('Prix', 'السعر')} (TND)`} open={openSections.price} onToggle={() => toggleSection('price')}>
        <input
          type="range"
          min="0"
          max="500"
          value={priceRange[1]}
          onChange={(e) => { setCurrentPage(1); setPriceRange([priceRange[0], parseInt(e.target.value, 10)]); }}
          className="w-full cursor-pointer accent-[#7C3AED]"
        />
        <div className="mt-2 flex justify-between text-xs font-bold text-slate-500">
          <span>0 TND</span>
          <span className="text-[#7C3AED]">{priceRange[1]} TND</span>
        </div>
      </FilterSection>

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
            className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${!selectedStore ? 'bg-[#F5F3FF] font-bold text-[#7C3AED]' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Store size={14} /> {tr('Toutes les boutiques', 'كل المتاجر')}
          </button>
          {boutiques.map((boutique) => (
            <button
              key={boutique.id}
              onClick={() => { setCurrentPage(1); setSelectedStore(boutique); }}
              className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition ${selectedStore?.id === boutique.id ? 'bg-[#F5F3FF] font-bold text-[#7C3AED]' : 'text-slate-600 hover:bg-slate-50'}`}
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
            <Sparkles size={22} className="text-[#7C3AED]" />
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
                  <button onClick={() => setViewMode('grid')} className={`rounded-lg p-1.5 transition ${viewMode === 'grid' ? 'bg-[#F5F3FF] text-[#7C3AED]' : 'text-slate-400'}`}><LayoutGrid size={16} /></button>
                  <button onClick={() => setViewMode('list')} className={`rounded-lg p-1.5 transition ${viewMode === 'list' ? 'bg-[#F5F3FF] text-[#7C3AED]' : 'text-slate-400'}`}><List size={16} /></button>
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
                    <button onClick={chip.clear} className="ml-1 rounded-full p-0.5 hover:bg-[#7C3AED]/15 rtl:ml-0 rtl:mr-1">
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
                      <strong className="shrink-0 text-base font-black text-[#7C3AED]">{Number(product.prix).toFixed(3)} TND</strong>
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
