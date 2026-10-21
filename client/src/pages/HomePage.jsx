import { useEffect, useState } from 'react';
import {
  Search, Store, ShieldCheck, PackageCheck, Truck, ArrowRight, Sparkles, TicketPercent, Bike, BadgeCheck, MapPin,
} from 'lucide-react';
import HomeDashboard from '../components/home/HomeDashboard.jsx';
import ProductCard from '../components/ProductCard';
import BoutiqueCard from '../components/BoutiqueCard';
import Avatar from '../components/ui/Avatar';
import { iconForCategory } from '../utils/categoryIcons.js';
import { API_URL, absoluteImageUrl } from '../config/api.js';
import { regionsFromBoutiques } from '../utils/regions.js';

// Photo de repli du hero quand aucun produit n'a encore d'image.
const HERO_FALLBACK = 'https://images.unsplash.com/photo-1781455816406-c3dead3a643e?fm=jpg&q=80&w=1200&auto=format&fit=crop';

function SectionHeader({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-ink sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>
      {onAction && (
        <button onClick={onAction} className="group inline-flex shrink-0 items-center gap-1 text-sm font-bold text-terre-700 hover:text-terre-800">
          {actionLabel}
          <ArrowRight size={15} className="transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

// Rangée défilante sur téléphone, grille sur grand écran (comme l'app).
function ProductRow({ products, loading, language, onOpenProduct, onAddToCart }) {
  const items = loading ? Array.from({ length: 4 }, (_, i) => ({ id: `s${i}` })) : products;
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] max-sm:[&>*]:w-[44%] max-sm:[&>*]:shrink-0 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {items.map((product) => (loading ? (
        <div key={product.id} aria-hidden="true" className="animate-pulse overflow-hidden rounded-lg border border-border-neutral bg-white">
          <div className="aspect-square bg-cream" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 rounded bg-cream" />
            <div className="h-3 w-1/3 rounded bg-cream" />
          </div>
        </div>
      ) : (
        <ProductCard key={product.id} product={product} language={language} onOpen={onOpenProduct} onAddToCart={onAddToCart} />
      )))}
    </div>
  );
}

export default function HomePage({ navigate, language = 'fr', user, cartCount = 0, setSelectedCategoryId, onOpenProduct, onOpenStore, onAddToCart }) {
  const isAr = language === 'ar';
  const isClient = user?.role === 'client';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [categories, setCategories] = useState([]);
  const [categoryPhotos, setCategoryPhotos] = useState({}); // { [categoryId]: imageUrl }
  const [populaires, setPopulaires] = useState([]);
  const [nouveautes, setNouveautes] = useState([]);
  const [meilleuresVentes, setMeilleuresVentes] = useState([]);
  const [promos, setPromos] = useState({ count: 0, maxPercent: 0 });
  const [boutiques, setBoutiques] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then((response) => response.json())
      .then(async (data) => {
        if (!data.success) return;
        setCategories(data.data);
        // Photo de la catégorie (choisie par l'admin), sinon une vraie photo
        // produit de la catégorie plutôt qu'une icône générique.
        const entries = await Promise.all(
          data.data.slice(0, 12).map(async (cat) => {
            if (cat.image) return [cat.id, absoluteImageUrl(cat.image)];
            try {
              const res = await fetch(`${API_URL}/produits?categoryId=${cat.id}&limit=1`);
              const productData = await res.json();
              return [cat.id, productData.data?.[0]?.image || null];
            } catch {
              return [cat.id, null];
            }
          }),
        );
        setCategoryPhotos(Object.fromEntries(entries.filter(([, url]) => url)));
      })
      .catch(() => setCategories([]));
    Promise.all([
      fetch(`${API_URL}/produits?limit=8&sort=rating`)
        .then((response) => response.json())
        .then((data) => { if (data.success) setPopulaires(data.data); })
        .catch(() => setPopulaires([])),
      fetch(`${API_URL}/produits?limit=8`)
        .then((response) => response.json())
        .then((data) => { if (data.success) setNouveautes(data.data); })
        .catch(() => setNouveautes([])),
    ]).finally(() => setLoadingProducts(false));
    // « Meilleures ventes » n'apparaît qu'une fois des ventes enregistrées :
    // sans commande, ce tri ne serait qu'un ordre arbitraire.
    fetch(`${API_URL}/produits?limit=8&sort=best_sellers`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setMeilleuresVentes(data.data.filter((product) => Number(product.ventes) > 0)); })
      .catch(() => setMeilleuresVentes([]));
    fetch(`${API_URL}/produits?limit=60&promotion=true`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) return;
        const percents = data.data.map((product) => Math.round((1 - product.prix / product.prixAvant) * 100));
        setPromos({ count: data.count ?? data.data.length, maxPercent: Math.max(0, ...percents) });
      })
      .catch(() => {});
    fetch(`${API_URL}/boutiques`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setBoutiques(data.data); })
      .catch(() => setBoutiques([]));
  }, []);

  const regions = regionsFromBoutiques(boutiques);

  const goToCategory = (categoryId) => {
    setSelectedCategoryId?.(categoryId);
    navigate('/catalogue');
  };

  const lancerRecherche = (e) => {
    e.preventDefault();
    const q = recherche.trim();
    navigate(q ? `/catalogue?q=${encodeURIComponent(q)}` : '/catalogue');
  };

  // Collage du hero : de vraies photos de produits de la marketplace.
  const photosHero = [...populaires, ...nouveautes]
    .map((p) => p.image && absoluteImageUrl(p.image))
    .filter((url, i, all) => url && all.indexOf(url) === i)
    .slice(0, 3);
  const vendeurs = boutiques.filter((b) => b.vendeur).slice(0, 6);

  const confiance = [
    { icon: ShieldCheck, title: tr('Paiement sécurisé', 'دفع آمن'), text: tr('À la livraison, Konnect, Flouci ou virement', 'عند الاستلام أو Konnect أو Flouci أو تحويل') },
    { icon: Truck, title: tr('24 gouvernorats', '24 ولاية'), text: tr('Livraison partout en Tunisie', 'توصيل في كامل تونس') },
    { icon: PackageCheck, title: tr('Retours simples', 'إرجاع سهل'), text: tr('Suivi transparent de chaque colis', 'تتبع شفاف لكل طرد') },
    { icon: BadgeCheck, title: tr('Boutiques vérifiées', 'متاجر موثّقة'), text: tr('Chaque vendeur est validé', 'التحقق من كل بائع') },
  ];

  return (
    <div className="space-y-10 pb-24 sm:space-y-14 md:pb-12">
      {isClient ? (
        // Client connecté : tableau de bord personnel à la place du bandeau marketing.
        <HomeDashboard language={language} navigate={navigate} cartCount={cartCount} onOpenProduct={onOpenProduct} />
      ) : (
        <section className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-terre-700 via-terre-800 to-terre-900 text-white lg:grid lg:min-h-[440px] lg:grid-cols-[1.1fr_0.9fr]">
            {/* Motif discret (zellige stylisé) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1.2px, transparent 0)', backgroundSize: '22px 22px' }}
            />
            <div className="relative z-10 flex flex-col justify-center gap-4 p-6 sm:gap-5 sm:p-10 lg:p-14">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-white/15 sm:text-xs">
                <Sparkles size={13} />
                {tr('Shop local · Boutiques tunisiennes', 'تسوق محلي · متاجر تونسية')}
              </span>
              <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                {tr('Les bonnes choses', 'الأشياء الجيدة')}
                <br />
                <span className="text-terre-200">{tr('sont ici.', 'هنا.')}</span>
              </h1>
              <p className="max-w-lg text-sm leading-relaxed text-white/80 sm:text-base">
                {tr(
                  'Des créateurs, artisans et commerçants de toute la Tunisie. Un seul compte, un seul panier, plusieurs boutiques.',
                  'مبدعون وحرفيون وتجار من كامل تونس. حساب واحد، سلة واحدة، عدة متاجر.',
                )}
              </p>

              <form onSubmit={lancerRecherche} role="search" className="flex w-full max-w-lg items-center gap-2 rounded-xl bg-white p-1.5 shadow-lg">
                <Search size={18} className="ms-2.5 shrink-0 text-slate-400" />
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder={tr('Chéchia, huile d’olive, céramique…', 'شاشية، زيت زيتون، فخار…')}
                  aria-label={tr('Rechercher un produit', 'ابحث عن منتج')}
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-slate-400"
                />
                <button type="submit" className="shrink-0 rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-black">
                  {tr('Rechercher', 'بحث')}
                </button>
              </form>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 4).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => goToCategory(cat.id)}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20 transition hover:bg-white/20"
                    >
                      {cat.nom}
                    </button>
                  ))}
                </div>
              )}

              {boutiques.length > 0 && (
                <dl className="flex gap-6 border-t border-white/15 pt-4 text-white/70">
                  <div><dt className="text-[11px] uppercase tracking-wide">{tr('Boutiques', 'متاجر')}</dt><dd className="text-xl font-extrabold text-white">{boutiques.length}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide">{tr('Gouvernorats', 'ولايات')}</dt><dd className="text-xl font-extrabold text-white">24</dd></div>
                </dl>
              )}
            </div>

            {/* Grand écran : collage de produits réels */}
            <div className="relative hidden lg:block">
              {photosHero.length >= 3 ? (
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-3 p-6 ps-0">
                  <img src={photosHero[0]} alt="" className="row-span-2 h-full w-full rounded-xl object-cover shadow-2xl" />
                  <img src={photosHero[1]} alt="" className="h-full w-full rounded-xl object-cover shadow-2xl" />
                  <img src={photosHero[2]} alt="" className="h-full w-full rounded-xl object-cover shadow-2xl" />
                </div>
              ) : (
                <img src={HERO_FALLBACK} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ filter: 'sepia(22%) saturate(140%)' }} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Confiance — juste sous le hero, là où le visiteur décide. */}
      {!isClient && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-xl border border-border-neutral bg-white px-5 py-5 lg:grid-cols-4 lg:divide-x lg:divide-border-neutral lg:px-2 rtl:lg:divide-x-reverse">
            {confiance.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 lg:px-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terre-50 text-terre-700"><Icon size={18} /></span>
                <span>
                  <span className="block text-sm font-bold text-ink">{title}</span>
                  <span className="block text-xs leading-snug text-slate-500">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Catégories en tuiles photo */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            title={tr('Explorer par univers', 'تصفح حسب الفئة')}
            actionLabel={tr('Tout voir', 'عرض الكل')}
            onAction={() => navigate('/catalogue')}
          />
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {categories.slice(0, 12).map((cat) => {
              const photo = categoryPhotos[cat.id];
              const Icon = iconForCategory(cat.nom);
              return (
                <button
                  key={cat.id}
                  onClick={() => goToCategory(cat.id)}
                  className="group relative aspect-[4/5] w-[42%] shrink-0 overflow-hidden rounded-xl bg-cream text-start sm:w-auto"
                >
                  {photo ? (
                    <img loading="lazy" decoding="async" src={photo} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-terre-700"><Icon size={36} /></span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-bold leading-tight text-white">{cat.nom}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Produits populaires */}
      {(loadingProducts || populaires.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            title={isClient ? tr('Recommandés pour vous', 'مقترحة لكم') : tr('Les plus appréciés', 'الأعلى تقييمًا')}
            subtitle={tr('Les produits les mieux notés par les acheteurs', 'المنتجات الأعلى تقييمًا من المشترين')}
            actionLabel={tr('Tout voir', 'عرض الكل')}
            onAction={() => navigate('/catalogue')}
          />
          <ProductRow products={populaires} loading={loadingProducts} language={language} onOpenProduct={onOpenProduct} onAddToCart={onAddToCart} />
        </section>
      )}

      {/* Promotions — calculées depuis les produits réellement en promo */}
      {promos.count > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <button
            onClick={() => navigate('/catalogue?promo=1')}
            className="flex w-full flex-col gap-3 rounded-xl bg-ink p-5 text-start text-white transition hover:bg-[#2A2622] sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <span className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-terre-700 text-lg font-black">-{promos.maxPercent}%</span>
              <span>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-terre-300">{tr('Promotions en cours', 'تخفيضات جارية')}</span>
                <span className="mt-0.5 block text-base font-extrabold sm:text-lg">
                  {tr(`Jusqu'à -${promos.maxPercent}% sur ${promos.count} produits`, `حتى -${promos.maxPercent}% على ${promos.count} منتجات`)}
                </span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 self-start rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-ink sm:self-auto">
              {tr('Voir les promotions', 'شاهد التخفيضات')} <ArrowRight size={14} className="rtl:rotate-180" />
            </span>
          </button>
        </section>
      )}

      {/* Codes promo — une vraie page, pas un bandeau décoratif */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <button
          onClick={() => navigate('/coupons')}
          className="group flex w-full items-center gap-4 rounded-xl border border-terre-200 bg-terre-50 p-4 text-start transition hover:border-terre-300 sm:p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-terre-700 text-white"><TicketPercent size={22} /></span>
          <span className="flex-1">
            <span className="block text-sm font-extrabold text-ink sm:text-base">{tr('Codes promo du moment', 'رموز التخفيض الحالية')}</span>
            <span className="block text-xs text-slate-600 sm:text-sm">{tr('Réductions des boutiques, à appliquer au paiement.', 'تخفيضات المتاجر، تُطبّق عند الدفع.')}</span>
          </span>
          <ArrowRight size={18} className="shrink-0 text-terre-700 transition group-hover:translate-x-0.5 rtl:rotate-180" />
        </button>
      </section>

      {/* Nouveautés */}
      {(loadingProducts || nouveautes.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            title={tr('Nouveautés', 'وصل حديثًا')}
            subtitle={tr('Fraîchement ajoutés par les boutiques', 'أضافتها المتاجر مؤخرًا')}
            actionLabel={tr('Tout voir', 'عرض الكل')}
            onAction={() => navigate('/catalogue')}
          />
          <ProductRow products={nouveautes} loading={loadingProducts} language={language} onOpenProduct={onOpenProduct} onAddToCart={onAddToCart} />
        </section>
      )}

      {/* Meilleures ventes */}
      {meilleuresVentes.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            title={tr('Meilleures ventes', 'الأكثر مبيعًا')}
            subtitle={tr('Les produits les plus commandés', 'المنتجات الأكثر طلبًا')}
            actionLabel={tr('Tout voir', 'عرض الكل')}
            onAction={() => navigate('/catalogue')}
          />
          <ProductRow products={meilleuresVentes} loading={false} language={language} onOpenProduct={onOpenProduct} onAddToCart={onAddToCart} />
        </section>
      )}

      {/* Acheter par région */}
      {regions.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            title={tr('Acheter par région', 'تسوق حسب الجهة')}
            subtitle={tr('Les boutiques près de chez vous', 'المتاجر القريبة منكم')}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {regions.map((region) => (
              <button
                key={region.id}
                onClick={() => navigate(`/catalogue?region=${region.id}`)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-start transition hover:border-terre-300"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terre-100 text-terre-700"><MapPin size={18} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-slate-900">{(isAr && region.nomAr) || region.nom}</span>
                  <span className="block text-[11px] text-slate-500">
                    {tr(`${region.produits} produits · ${region.boutiques} boutique${region.boutiques > 1 ? 's' : ''}`, `${region.produits} منتج · ${region.boutiques} متجر`)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Boutiques et leurs vendeurs */}
      {boutiques.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeader
            title={tr('Boutiques à découvrir', 'متاجر تستحق الاكتشاف')}
            subtitle={tr('Derrière chaque boutique, une personne', 'وراء كل متجر، شخص')}
            actionLabel={tr('Toutes les boutiques', 'كل المتاجر')}
            onAction={() => navigate('/boutiques')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boutiques.slice(0, 3).map((store) => (
              <BoutiqueCard key={store.id} store={store} onOpen={onOpenStore} language={language} />
            ))}
          </div>
          {vendeurs.length > 0 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
              {vendeurs.map((store) => (
                <button
                  key={store.id}
                  onClick={() => onOpenStore(store.id)}
                  className="flex shrink-0 items-center gap-2.5 rounded-full border border-border-neutral bg-white py-1.5 pe-4 ps-1.5 transition hover:border-terre-200"
                >
                  <Avatar nom={store.vendeur.nom} prenom={store.vendeur.prenom} photo={store.vendeur.photo} className="h-9 w-9" />
                  <span className="text-start">
                    <span className="block text-xs font-bold text-ink">{store.vendeur.prenom}</span>
                    <span className="block text-[11px] text-slate-500">{store.nom}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Rejoindre la plateforme (actions réelles : inscription vendeur ou livreur) */}
      {!isClient && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-6 overflow-hidden rounded-2xl bg-ink p-6 text-white sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-3xl">{tr('Vous vendez en Tunisie ?', 'تبيع في تونس؟')}</h2>
              <p className="mt-2 max-w-xl text-sm text-white/70 sm:text-base">
                {tr(
                  'Ouvrez votre boutique en quelques minutes : vitrine, commandes, paiements et livraison au même endroit. Vous ne payez une commission que sur ce que vous vendez.',
                  'افتح متجرك في دقائق: واجهة وطلبات ومدفوعات وتوصيل في مكان واحد. تدفع عمولة فقط على ما تبيعه.',
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <button onClick={() => navigate('/vendeur/inscription')} className="flex items-center justify-center gap-2 rounded-xl bg-terre-700 px-5 py-3 text-sm font-bold transition hover:bg-terre-800">
                <Store size={17} /> {tr('Ouvrir ma boutique', 'افتح متجري')}
              </button>
              <button onClick={() => navigate('/livreur/inscription')} className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold ring-1 ring-white/25 transition hover:bg-white/10">
                <Bike size={17} /> {tr('Devenir livreur', 'كن موزعًا')}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
