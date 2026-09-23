import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Menu,
  Search,
  ShoppingCart,
  Store,
  ShieldCheck,
  PackageCheck,
  Sparkles,
  Truck,
  LogOut,
  Home,
  User,
  AlertCircle,
  X,
  ArrowRight,
  Mail,
} from 'lucide-react';
import CheckoutPage from './pages/CheckoutPage';
import AdminDashboard from './pages/AdminDashboard';
import VendorDashboard from './pages/VendorDashboard';
import VendorRegistration from './pages/VendorRegistration';
import Marketplace from './pages/Marketplace';
import TrackingPage from './pages/TrackingPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ClientOrdersPage from './pages/ClientOrdersPage';
import AccountPage from './pages/AccountPage';
import StoresPage from './pages/StoresPage';
import StorePage from './pages/StorePage';
import ProductPage from './pages/ProductPage';
import LegalPage from './pages/LegalPage';
import HelpCenterPage from './pages/HelpCenterPage';
import ConfirmOrderPage from './pages/ConfirmOrderPage';
import LivreurLoginPage from './pages/LivreurLoginPage';
import LivreurRegistrationPage from './pages/LivreurRegistrationPage';
import LivreurDashboardPage from './pages/LivreurDashboardPage';
import FavoritesPage from './pages/FavoritesPage';
import CouponsPage from './pages/CouponsPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import PaymentReturnPage from './pages/PaymentReturnPage';
import ChatWidget from './components/ChatWidget';
import MessagesPage from './pages/MessagesPage';
import PolicyConsentModal from './components/PolicyConsentModal';
import CategoryDrawer from './components/CategoryDrawer';
import ProductCard from './components/ProductCard';
import BoutiqueCard from './components/BoutiqueCard';
import Avatar from './components/ui/Avatar';
import Logo from './components/ui/Logo.jsx';
import ToastHost from './components/ui/Toast.jsx';
import { iconForCategory } from './utils/categoryIcons.js';
import { useTranslation } from './i18n';
import { API_URL } from './config/api.js';

// --- Petits wrappers de route : lisent le paramètre d'URL et le passent en
// prop aux pages existantes, qui n'ont pas besoin de connaître react-router.
function StoreRoute(props) {
  const { id } = useParams();
  return <StorePage storeId={id} {...props} />;
}

function ProductRoute(props) {
  const { id } = useParams();
  return <ProductPage productId={id} {...props} />;
}

function ConfirmOrderRoute() {
  const { token } = useParams();
  return <ConfirmOrderPage token={token} />;
}

function LegalRoute(props) {
  const { type } = useParams();
  return <LegalPage type={type || 'cgu'} {...props} />;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [language, setLanguage] = useState('fr');
  const { t } = useTranslation(language);
  const tr = (fr, ar) => (language === 'ar' ? ar : fr);

  const [cart, setCart] = useState(() => {
    // Panier utilisable sans compte — persiste entre les visites/onglets.
    try {
      const saved = localStorage.getItem('cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  // Authentication Modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showPolicyConsent, setShowPolicyConsent] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '', nom: '', prenom: '', telephone: '', isRegister: false });
  const [authError, setAuthError] = useState('');

  // Chat Widget State
  const [chatParams, setChatParams] = useState(null); // { vendeurId, sujet }

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {
      // quota dépassé ou stockage désactivé — le panier reste utilisable en mémoire
    }
  }, [cart]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    if (savedToken && userId) {
      setUser({ id: userId, role: userRole });

      // Auto-route uniquement depuis la racine — un lien profond (ex: un
      // produit partagé) ne doit jamais être écrasé par cette redirection,
      // même pour un compte admin/vendeur/livreur déjà connecté.
      if (location.pathname === '/') {
        if (['administrateur', 'super_admin'].includes(userRole)) navigate('/admin');
        else if (['vendeur', 'admin_boutique'].includes(userRole)) navigate('/vendeur');
        else if (userRole === 'livreur') navigate('/livreur');
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('adminToken');
    setUser(null);
    navigate('/');
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setAuthError('');
    if (authForm.isRegister) {
      // L'inscription ne peut pas se soumettre directement — les conditions
      // de vente/retour doivent d'abord être explicitement acceptées via
      // l'alerte dédiée (refuser bloque totalement l'inscription).
      setShowPolicyConsent(true);
      return;
    }
    performAuthSubmit();
  };

  const performAuthSubmit = async () => {
    setAuthError('');
    const endpoint = authForm.isRegister ? '/auth/register' : '/auth/login';
    const payload = authForm.isRegister
      ? { nom: authForm.nom, prenom: authForm.prenom, email: authForm.email, password: authForm.password, telephone: authForm.telephone, accepteConditions: true }
      : { email: authForm.email, password: authForm.password };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Une erreur s\'est produite.');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userRole', data.user.role);

      setUser({ id: data.user.id, role: data.user.role });
      setShowLoginModal(false);

      // Route accordingly
      if (['administrateur', 'super_admin'].includes(data.user.role)) {
        navigate('/admin');
      } else if (['vendeur', 'admin_boutique'].includes(data.user.role)) {
        navigate('/vendeur');
      } else if (data.user.role === 'livreur') {
        navigate('/livreur');
      }
      // Client : on reste sur la page en cours (ex: checkout) plutôt que de
      // forcer une redirection vers le catalogue, pour ne pas faire perdre
      // sa place à quelqu'un qui se connectait juste pour finaliser un achat.
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleAddToCart = (productItem) => {
    setCart((current) => {
      // Find item matching product and variant
      const existing = current.find(
        (item) => item.id === productItem.id && item.varianteId === productItem.varianteId
      );
      if (existing) {
        return current.map((item) =>
          item.id === productItem.id && item.varianteId === productItem.varianteId
            ? { ...item, quantity: Math.min(item.quantity + 1, productItem.stock) }
            : item
        );
      }
      return [...current, { ...productItem, quantity: 1 }];
    });
  };

  const handleUpdateCartQuantity = (id, varianteId, nextQuantity) => {
    setCart((current) => current
      .map((item) => (item.id === id && item.varianteId === varianteId
        ? { ...item, quantity: Math.max(1, Math.min(nextQuantity, item.stock)) }
        : item))
    );
  };

  const handleRemoveFromCart = (id, varianteId) => {
    setCart((current) => current.filter((item) => !(item.id === id && item.varianteId === varianteId)));
  };

  const handleOrderPlaced = () => {
    setCart([]);
    navigate('/commandes');
  };

  // Checkout invité : la commande est passée avec succès mais il n'y a pas
  // de compte pour consulter "Mes commandes" (page authentifiée) — on vide
  // simplement le panier sans y rediriger, la confirmation reste affichée
  // sur place dans CheckoutPage.
  const handleClearCart = () => setCart([]);

  const handleStartChat = (vendeurId, sujet, message) => {
    setChatParams({ vendeurId, sujet, message });
  };

  const openStore = (storeId) => navigate(`/boutiques/${storeId}`);
  const openProduct = (productId) => navigate(`/produits/${productId}`);

  const openLoginModal = () => {
    setAuthForm({ email: '', password: '', nom: '', prenom: '', telephone: '', isRegister: false });
    setAuthError('');
    setShowLoginModal(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen font-black text-slate-500">{tr('Chargement de BuyHere...', 'جارٍ تحميل BuyHere...')}</div>;
  }

  return (
    <Routes>
      <Route path="/admin" element={<AdminDashboard onLogout={handleLogout} language={language} setLanguage={setLanguage} />} />

      <Route
        path="/vendeur"
        element={(
          <div>
            <nav className="bg-white border-b border-slate-200 p-4 flex flex-wrap justify-between items-center gap-3 font-sans shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-terre-100 bg-terre-50 p-1">
                  <Logo variant="symbole" className="h-full w-full" />
                </span>
                <h1 className="text-md font-black text-slate-800">{tr('Espace Vendeur', 'فضاء البائع')}</h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition"
                >
                  {tr('Accueil Marketplace', 'الرئيسية')}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition"
                >
                  <LogOut size={14} />
                  {tr('Déconnexion', 'تسجيل الخروج')}
                </button>
              </div>
            </nav>
            <VendorDashboard language={language} setLanguage={setLanguage} />
          </div>
        )}
      />

      <Route
        path="/vendeur/inscription"
        element={(
          <VendorRegistration
            onClose={() => navigate('/')}
            onSuccess={(newUser) => {
              setUser(newUser);
              navigate('/vendeur');
            }}
            onOpenTerms={() => navigate('/legal/vendorTerms')}
          />
        )}
      />

      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/legal" element={<Navigate to="/legal/cgu" replace />} />
      <Route path="/legal/:type" element={<LegalRoute language={language} onBack={() => navigate('/')} />} />
      <Route path="/aide" element={<HelpCenterPage language={language} onBack={() => navigate('/')} />} />
      <Route path="/confirmer-commande/:token" element={<ConfirmOrderRoute />} />

      <Route
        path="/livreur/connexion"
        element={(
          <LivreurLoginPage
            onBack={() => navigate('/')}
            onLoginSuccess={() => navigate('/livreur')}
            onRegister={() => navigate('/livreur/inscription')}
          />
        )}
      />
      <Route
        path="/livreur/inscription"
        element={(
          <LivreurRegistrationPage
            onBack={() => navigate('/livreur/connexion')}
            onSuccess={() => navigate('/livreur')}
          />
        )}
      />
      <Route path="/livreur" element={<LivreurDashboardPage onLogout={handleLogout} />} />

      <Route
        path="/oauth/callback"
        element={(
          <OAuthCallbackPage
            onSuccess={({ id, role }) => {
              setUser({ id, role });
              if (['administrateur', 'super_admin'].includes(role)) navigate('/admin');
              else if (['vendeur', 'admin_boutique'].includes(role)) navigate('/vendeur');
              else if (role === 'livreur') navigate('/livreur');
              else navigate('/catalogue');
            }}
          />
        )}
      />

      <Route
        path="/payment/return"
        element={(
          <PaymentReturnPage
            onDone={() => {
              setCart([]);
              navigate(user ? '/commandes' : '/', { replace: true });
            }}
          />
        )}
      />

      {/* Coquille principale (header, footer, nav mobile, modales) partagée
          par toutes les pages "marketplace" classiques. */}
      <Route
        element={(
          <MainShell
            language={language}
            setLanguage={setLanguage}
            user={user}
            handleLogout={handleLogout}
            cart={cart}
            showMobileMenu={showMobileMenu}
            setShowMobileMenu={setShowMobileMenu}
            showCategoryDrawer={showCategoryDrawer}
            setShowCategoryDrawer={setShowCategoryDrawer}
            setSelectedCategoryId={setSelectedCategoryId}
            showLoginModal={showLoginModal}
            setShowLoginModal={setShowLoginModal}
            openLoginModal={openLoginModal}
            authForm={authForm}
            setAuthForm={setAuthForm}
            authError={authError}
            handleLoginSubmit={handleLoginSubmit}
            chatParams={chatParams}
            setChatParams={setChatParams}
            showPolicyConsent={showPolicyConsent}
            setShowPolicyConsent={setShowPolicyConsent}
            performAuthSubmit={performAuthSubmit}
            setAuthError={setAuthError}
          />
        )}
      >
        <Route
          path="/"
          element={(
            <HomeView
              navigate={navigate}
              language={language}
              setSelectedCategoryId={setSelectedCategoryId}
              onOpenProduct={openProduct}
              onOpenStore={openStore}
              onAddToCart={handleAddToCart}
            />
          )}
        />
        <Route
          path="/catalogue"
          element={(
            <Marketplace
              cartItems={cart}
              onUpdateCart={handleAddToCart}
              onStartChat={handleStartChat}
              onViewCart={() => navigate('/checkout')}
              language={language}
              onViewProduct={openProduct}
              onViewStores={() => navigate('/boutiques')}
              initialCategoryId={selectedCategoryId}
            />
          )}
        />
        <Route
          path="/favoris"
          element={(
            <FavoritesPage
              language={language}
              onBack={() => navigate('/')}
              onOpenProduct={openProduct}
              onAddToCart={handleAddToCart}
            />
          )}
        />
        <Route path="/coupons" element={<CouponsPage language={language} onBack={() => navigate('/')} />} />
        <Route path="/boutiques" element={<StoresPage language={language} onOpenStore={openStore} />} />
        <Route
          path="/boutiques/:id"
          element={(
            <StoreRoute
              language={language}
              onBack={() => navigate('/boutiques')}
              onOpenProduct={openProduct}
              onAddToCart={handleAddToCart}
              onStartChat={handleStartChat}
            />
          )}
        />
        <Route
          path="/produits/:id"
          element={(
            <ProductRoute
              language={language}
              onBack={() => navigate('/catalogue')}
              onOpenStore={openStore}
              onOpenProduct={openProduct}
              onAddToCart={handleAddToCart}
              onStartChat={handleStartChat}
            />
          )}
        />
        <Route path="/panier" element={<Navigate to="/checkout" replace />} />
        <Route
          path="/checkout"
          element={(
            <CheckoutPage
              cartItems={cart}
              onOrderPlaced={handleOrderPlaced}
              onClearCart={handleClearCart}
              onBack={() => navigate('/catalogue')}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemoveItem={handleRemoveFromCart}
              onRequireLogin={openLoginModal}
              language={language}
            />
          )}
        />
        <Route path="/messages" element={<MessagesPage language={language} />} />
        <Route path="/suivi" element={<TrackingPage language={language} />} />
        <Route path="/compte" element={<AccountPage language={language} navigate={navigate} />} />
        <Route path="/commandes" element={<ClientOrdersPage onStartChat={handleStartChat} language={language} />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function HomeView({ navigate, language = 'fr', setSelectedCategoryId, onOpenProduct, onOpenStore, onAddToCart }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [categories, setCategories] = useState([]);
  const [categoryPhotos, setCategoryPhotos] = useState({}); // { [categoryId]: imageUrl }
  const [populaires, setPopulaires] = useState([]);
  const [nouveautes, setNouveautes] = useState([]);
  const [boutiques, setBoutiques] = useState([]);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSent, setNewsletterSent] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then((response) => response.json())
      .then(async (data) => {
        if (!data.success) return;
        setCategories(data.data);
        // Une vraie photo produit par catégorie (déjà en base, aucune
        // recherche externe nécessaire) plutôt qu'une icône générique.
        const entries = await Promise.all(
          data.data.slice(0, 12).map(async (cat) => {
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
    fetch(`${API_URL}/produits?limit=8&sort=rating`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setPopulaires(data.data); })
      .catch(() => setPopulaires([]));
    fetch(`${API_URL}/produits?limit=8`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setNouveautes(data.data); })
      .catch(() => setNouveautes([]));
    fetch(`${API_URL}/boutiques`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setBoutiques(data.data); })
      .catch(() => setBoutiques([]));
  }, []);

  const goToCategory = (categoryId) => {
    setSelectedCategoryId?.(categoryId);
    navigate('/catalogue');
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    // Pas d'endpoint newsletter côté serveur — confirmation visuelle uniquement.
    setNewsletterSent(true);
  };

  const vendeursAvecPhoto = boutiques.filter((b) => b.vendeur);

  return (
    <div className="space-y-12 pb-20 md:pb-10">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <div className="premium-gradient grid overflow-hidden rounded-lg text-white lg:grid-cols-2">
          <div className="max-w-2xl space-y-4 p-8 sm:p-12">
            <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
              <Sparkles size={14} />
              {tr('Shop local · Plateforme tunisienne multi-boutiques', 'تسوق محلي · منصة تونسية متعددة المتاجر')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">
              {tr('Les bonnes choses sont ici.', 'الأشياء الجيدة هنا.')}
            </h2>
            <p className="text-sm sm:text-base text-slate-200 max-w-xl">
              {tr('Découvrez des milliers de produits proposés par des boutiques tunisiennes. Un seul compte, un seul panier, plusieurs boutiques.', 'اكتشفوا آلاف المنتجات من متاجر تونسية. حساب واحد، سلة واحدة، عدة متاجر.')}
            </p>
            <button
              onClick={() => navigate('/catalogue')}
              className="flex w-full max-w-md items-center gap-2.5 rounded-xl bg-white/95 px-4 py-3 text-left text-slate-500 shadow-lg transition hover:bg-white sm:text-sm"
            >
              <Search size={16} />
              {tr('Que recherchez-vous ?', 'ماذا تبحثون؟')}
            </button>
            <div className="flex flex-wrap gap-3 pt-1">
              <button onClick={() => navigate('/catalogue')} className="px-5 py-3 rounded-xl bg-white text-[#994122] hover:bg-terre-50 font-bold text-sm transition">
                {tr('Découvrir les produits', 'اكتشف المنتجات')}
              </button>
              <button onClick={() => navigate('/vendeur/inscription')} className="px-5 py-3 rounded-xl border border-white/40 text-white font-bold text-sm hover:bg-white/10 transition">
                {tr('Devenir vendeur', 'كن بائعًا')}
              </button>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1781455816406-c3dead3a643e?fm=jpg&q=80&w=1200&auto=format&fit=crop"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: 'sepia(22%) saturate(140%) brightness(1.03)' }}
            />
            {/* Étalonnage chaud — la photo source est en lumière froide/matinale,
                ce calque la rapproche du ton doré recherché pour la marque. */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#C4532C]/25 via-transparent to-amber-200/15" />
          </div>
        </div>
      </section>

      {/* Catégories */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-4">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">{tr('Catégories principales', 'الفئات الرئيسية')}</h3>
            <button onClick={() => navigate('/catalogue')} className="text-sm font-bold text-[#C4532C] hover:text-[#994122]">{tr('Voir tout', 'عرض الكل')}</button>
          </div>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {categories.slice(0, 12).map((cat) => {
              const photo = categoryPhotos[cat.id];
              const Icon = iconForCategory(cat.nom);
              return (
                <button key={cat.id} onClick={() => goToCategory(cat.id)} className="flex flex-col items-center gap-2 text-center">
                  <span className="h-16 w-16 overflow-hidden rounded-full border-2 border-white shadow-soft ring-1 ring-[#E2D9CB] sm:h-20 sm:w-20">
                    {photo ? (
                      <img src={photo} alt="" className="h-full w-full object-cover transition duration-300 hover:scale-110" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#F8E4DE] text-[#C4532C]">
                        <Icon size={26} />
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-bold text-slate-700">{cat.nom}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Produits populaires */}
      {populaires.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-4">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">{tr('Produits populaires', 'المنتجات الأكثر رواجًا')}</h3>
            <button onClick={() => navigate('/catalogue')} className="text-sm font-bold text-[#C4532C] hover:text-[#994122]">{tr('Voir tout', 'عرض الكل')}</button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {populaires.map((product) => (
              <ProductCard key={product.id} product={product} language={language} onOpen={onOpenProduct} onAddToCart={onAddToCart} />
            ))}
          </div>
        </section>
      )}

      {/* Nouveaux produits */}
      {nouveautes.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-4">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">{tr('Nouveaux produits', 'منتجات جديدة')}</h3>
            <button onClick={() => navigate('/catalogue')} className="text-sm font-bold text-[#C4532C] hover:text-[#994122]">{tr('Voir tout', 'عرض الكل')}</button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {nouveautes.map((product) => (
              <ProductCard key={product.id} product={product} language={language} onOpen={onOpenProduct} onAddToCart={onAddToCart} />
            ))}
          </div>
        </section>
      )}

      {/* Découvrez nos boutiques */}
      {boutiques.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-4">
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">{tr('Découvrez nos boutiques', 'اكتشفوا متاجرنا')}</h3>
            <button onClick={() => navigate('/boutiques')} className="text-sm font-bold text-[#C4532C] hover:text-[#994122]">{tr('Voir tout', 'عرض الكل')}</button>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {boutiques.slice(0, 3).map((store) => (
              <BoutiqueCard key={store.id} store={store} onOpen={onOpenStore} language={language} />
            ))}
          </div>
        </section>
      )}

      {/* Derrière chaque boutique, une personne */}
      {vendeursAvecPhoto.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-4">{tr('Derrière chaque boutique, une personne', 'وراء كل متجر، شخص')}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {vendeursAvecPhoto.slice(0, 4).map((store) => (
              <button key={store.id} onClick={() => onOpenStore(store.id)} className="flex flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:border-terre-200">
                <Avatar nom={store.vendeur.nom} prenom={store.vendeur.prenom} photo={store.vendeur.photo} className="h-14 w-14" />
                <span className="text-xs font-bold text-slate-900">{store.vendeur.prenom}</span>
                <span className="text-[11px] text-slate-500">{store.nom}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Confiance */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { icon: ShieldCheck, title: tr('Paiement sécurisé', 'دفع آمن'), text: tr('COD, Konnect et Flouci (sandbox) avec vérification des commandes.', 'الدفع عند الاستلام، Konnect و Flouci (تجريبي) مع التحقق من الطلبات.') },
            { icon: PackageCheck, title: tr('Protection acheteur', 'حماية المشتري'), text: tr('Retours et suivi des colis avec historique transparent.', 'إرجاع وتتبع الطرود بسجل شفاف.') },
            { icon: Store, title: tr('Boutiques vérifiées', 'متاجر موثّقة'), text: tr('Validation des vendeurs et contrôle des boutiques.', 'التحقق من البائعين ومراقبة المتاجر.') },
            { icon: Truck, title: tr('Livraison nationale', 'توصيل وطني'), text: tr('Couverture des 24 gouvernorats avec frais lisibles.', 'تغطية الولايات الـ24 بأسعار واضحة.') },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                <div className="w-10 h-10 rounded-xl bg-[#F8E4DE] text-[#C4532C] flex items-center justify-center mb-3">
                  <Icon size={20} />
                </div>
                <h4 className="text-sm font-extrabold text-slate-900">{item.title}</h4>
                <p className="text-xs text-slate-600 mt-1">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="rounded-lg bg-[#1E1B18] p-8 text-center text-white sm:p-10">
          <h3 className="text-lg font-extrabold sm:text-xl">{tr('Restez informé', 'ابقوا على اطلاع')}</h3>
          <p className="mt-1.5 text-sm text-slate-300">{tr('Nouveautés, promotions et boutiques à découvrir — une fois par mois, pas plus.', 'الجديد والعروض والمتاجر التي تستحق الاكتشاف — مرة واحدة شهريًا فقط.')}</p>
          {newsletterSent ? (
            <p className="mx-auto mt-5 max-w-sm rounded-xl bg-white/10 px-4 py-3 text-sm font-bold">{tr('Merci ! Vous êtes inscrit.', 'شكرًا! تم تسجيلكم.')}</p>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className="mx-auto mt-5 flex max-w-md flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={tr('Votre email', 'بريدكم الإلكتروني')}
                  className="h-11 w-full rounded-xl bg-white pl-10 pr-4 text-sm text-slate-900 outline-none"
                />
              </div>
              <button type="submit" className="flex items-center justify-center gap-1.5 rounded-xl bg-[#C4532C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#994122]">
                {tr("S'inscrire", 'اشتراك')} <ArrowRight size={15} />
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

// Coquille partagée (header, footer, nav mobile, tiroir catégories, modales
// auth/chat) — rendue une seule fois par react-router pour toutes les routes
// "marketplace" imbriquées, qui s'affichent à la place de <Outlet/>.
function MainShell({
  language, setLanguage, user, handleLogout, cart,
  showMobileMenu, setShowMobileMenu, showCategoryDrawer, setShowCategoryDrawer, setSelectedCategoryId,
  showLoginModal, setShowLoginModal, openLoginModal, authForm, setAuthForm, authError,
  handleLoginSubmit, chatParams, setChatParams, showPolicyConsent, setShowPolicyConsent,
  performAuthSubmit, setAuthError,
}) {
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className={`marketplace-shell min-h-screen flex flex-col justify-between font-sans ${isAr ? 'rtl' : 'ltr'}`}>

      {/* Navigation */}
      <nav className="mp-header backdrop-blur border-b border-white/10 sticky top-0 z-50 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryDrawer(true)}
              aria-label={tr('Ouvrir le menu', 'فتح القائمة')}
              className="rounded-xl p-2 text-slate-700 hover:bg-[#F8E4DE] hover:text-[#C4532C]"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <Logo variant="horizontal" className="h-9 sm:h-10 w-auto" />
              <p className="hidden sm:block text-[10px] text-slate-300 font-semibold border-l border-slate-200 pl-2.5 ml-0.5">{tr('Marketplace multi-boutiques tunisienne', 'سوق تونسي متعدد المتاجر')}</p>
            </div>
          </div>

          <div className="hidden lg:flex flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-3.5 text-slate-500" size={16} />
            <input
              type="text"
              readOnly
              onClick={() => navigate('/catalogue')}
              placeholder={tr('Que recherchez-vous ?', 'ماذا تبحث؟')}
              className="w-full h-11 rounded-xl border border-white bg-white pl-10 pr-4 text-sm text-slate-800 outline-none cursor-pointer"
            />
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-700">
            <button onClick={() => navigate('/')} className="px-3 py-2 rounded-xl hover:bg-[#F8E4DE] hover:text-[#C4532C]">{tr('Accueil', 'الرئيسية')}</button>
            <button onClick={() => navigate('/catalogue')} className="px-3 py-2 rounded-xl hover:bg-[#F8E4DE] hover:text-[#C4532C]">{tr('Catalogue', 'الكتالوج')}</button>
            <button onClick={() => navigate('/boutiques')} className="px-3 py-2 rounded-xl hover:bg-[#F8E4DE] hover:text-[#C4532C]">{tr('Boutiques', 'المتاجر')}</button>
            <button onClick={() => navigate('/suivi')} className="px-3 py-2 rounded-xl hover:bg-[#F8E4DE] hover:text-[#C4532C]">{tr('Suivi', 'التتبع')}</button>
            <button
              onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-[#F8E4DE]"
            >
              FR | العربية
            </button>

            {user ? (
              <>
                {user.role === 'client' && (
                  <button
                    onClick={() => navigate('/compte')}
                    className="px-3 py-2 rounded-xl hover:bg-[#F8E4DE] hover:text-[#C4532C]"
                  >
                    {tr('Mon Compte', 'حسابي')}
                  </button>
                )}
                <button
                  onClick={() => navigate('/commandes')}
                  className="px-3 py-2 rounded-xl hover:bg-[#F8E4DE] hover:text-[#C4532C]"
                >
                  {tr('Mes Commandes', 'طلباتي')}
                </button>
                <button
                  onClick={() => navigate('/messages')}
                  className="px-3 py-2 rounded-xl hover:bg-[#F8E4DE] hover:text-[#C4532C]"
                >
                  {tr('Messagerie', 'المراسلة')}
                </button>
                {['vendeur', 'admin_boutique'].includes(user.role) && (
                  <button
                    onClick={() => navigate('/vendeur')}
                    className="px-3 py-2 rounded-xl bg-[#C4532C] text-white hover:bg-[#994122]"
                  >
                    {tr('Ma Boutique', 'متجري')}
                  </button>
                )}
                <button onClick={handleLogout} className="px-3 py-2 rounded-xl text-slate-700 hover:bg-[#F8E4DE] hover:text-[#C4532C]">{tr('Déconnexion', 'تسجيل الخروج')}</button>
              </>
            ) : (
              <>
                <button
                  onClick={openLoginModal}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-[#F8E4DE]"
                >
                  {tr('Compte', 'حسابي')}
                </button>
                <button onClick={() => navigate('/vendeur/inscription')} className="px-3 py-2 rounded-xl bg-[#C4532C] text-white hover:bg-[#994122]">{tr('Devenir vendeur', 'كن بائعًا')}</button>
              </>
            )}

            <button
              onClick={() => navigate('/checkout')}
              className="relative text-[#C4532C] hover:text-[#994122] p-2"
              aria-label={tr('Panier', 'السلة')}
            >
              <ShoppingCart size={20} />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 bg-[#C4532C] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-black">
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden text-slate-700" aria-label={tr('Ouvrir le menu mobile', 'فتح القائمة')}>
            <Menu size={24} />
          </button>
        </div>

        {showMobileMenu && (
          <div className="md:hidden bg-white border-t border-slate-200 p-4 space-y-2 text-sm font-semibold text-slate-700">
            <button onClick={() => { navigate('/'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Accueil', 'الرئيسية')}</button>
            <button onClick={() => { navigate('/catalogue'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Catalogue', 'الكتالوج')}</button>
            <button onClick={() => { navigate('/boutiques'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Boutiques', 'المتاجر')}</button>
            <button onClick={() => { navigate('/suivi'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Suivi colis', 'تتبع الطرد')}</button>
            <button onClick={() => { navigate('/checkout'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Panier', 'السلة')} ({cart.length})</button>
            {user && user.role === 'client' && (
              <button onClick={() => { navigate('/compte'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Mon Compte', 'حسابي')}</button>
            )}
            {user && (
              <button onClick={() => { navigate('/commandes'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Mes Commandes', 'طلباتي')}</button>
            )}
            {user && (
              <button onClick={() => { navigate('/messages'); setShowMobileMenu(false); }} className="block w-full text-left py-2">{tr('Messagerie', 'المراسلة')}</button>
            )}
            <button onClick={() => { setLanguage(language === 'fr' ? 'ar' : 'fr'); }} className="block w-full text-left py-2">FR | العربية</button>
            <div className="pt-2 border-t border-slate-200 flex gap-2">
              {user ? (
                <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className="w-full text-center py-2 text-red-600 bg-red-50 rounded-xl">{tr('Déconnexion', 'تسجيل الخروج')}</button>
              ) : (
                <>
                  <button onClick={() => { setShowLoginModal(true); setShowMobileMenu(false); }} className="flex-1 text-center py-2 border rounded-xl bg-white">{tr('Connexion', 'تسجيل الدخول')}</button>
                  <button onClick={() => { navigate('/vendeur/inscription'); setShowMobileMenu(false); }} className="flex-1 text-center py-2 bg-[#C4532C] text-white rounded-xl">{tr('Vendeur', 'بائع')}</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main View rendering */}
      <main className="flex-1">
        <Outlet />
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2">
        <div className="grid grid-cols-5 gap-1 text-[11px] font-semibold text-slate-600">
          <button onClick={() => navigate('/')} className="flex flex-col items-center py-1.5 hover:text-[#C4532C]">
            <Home size={16} />
            <span>{tr('Accueil', 'الرئيسية')}</span>
          </button>
          <button onClick={() => navigate('/catalogue')} className="flex flex-col items-center py-1.5 hover:text-[#C4532C]">
            <Search size={16} />
            <span>{tr('Categories', 'الفئات')}</span>
          </button>
          <button onClick={() => navigate('/catalogue')} className="flex flex-col items-center py-1.5 hover:text-[#C4532C]">
            <Store size={16} />
            <span>{tr('Recherche', 'البحث')}</span>
          </button>
          <button onClick={() => navigate('/checkout')} className="flex flex-col items-center py-1.5 hover:text-[#C4532C] relative">
            <ShoppingCart size={16} />
            <span>{tr('Panier', 'السلة')}</span>
            {cart.length > 0 && (
              <span className="absolute top-0 right-4 bg-[#C4532C] text-white rounded-full text-[9px] min-w-[14px] h-[14px] px-1 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
          <button onClick={() => (user ? navigate('/compte') : setShowLoginModal(true))} className="flex flex-col items-center py-1.5 hover:text-[#C4532C]">
            <User size={16} />
            <span>{tr('Compte', 'حسابي')}</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1E1B18] text-white py-12 mt-12 font-sans border-t border-[#2E2A26] mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-6 mb-8">
          <Logo variant="horizontal" tone="blanc" className="h-8 w-auto" />
        </div>
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-xs font-medium text-slate-400">
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm">{tr('À propos de BuyHere', 'حول BuyHere')}</h4>
            <p>{tr('La première plateforme e-commerce tunisienne bilingue avec gestion de stock avancée, logistique intégrée et paiement sandbox.', 'أول منصة تجارة إلكترونية تونسية ثنائية اللغة مع إدارة مخزون متقدمة ولوجستيك متكامل ودفع تجريبي.')}</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm">{tr('Liens Utiles', 'روابط مفيدة')}</h4>
            <button onClick={() => navigate('/catalogue')} className="block hover:text-white">{tr('Catalogue produits', 'كتالوج المنتجات')}</button>
            <button onClick={() => navigate('/suivi')} className="block hover:text-white">{tr('Suivre mon colis', 'تتبع طردي')}</button>
            <button onClick={() => navigate('/vendeur/inscription')} className="block hover:text-white">{tr('Devenir vendeur indépendant', 'كن بائعًا مستقلًا')}</button>
            <button onClick={() => navigate('/livreur/connexion')} className="block hover:text-white">{tr('Espace Livreur', 'فضاء الموصّل')}</button>
            {user && <button onClick={() => navigate('/messages')} className="block hover:text-white">{tr('Messagerie', 'المراسلة')}</button>}
            <button onClick={() => navigate('/legal/cgu')} className="block text-left hover:text-[#E39B82]">{tr('Conditions générales', 'الشروط العامة')}</button>
            <button onClick={() => navigate('/legal/privacy')} className="block text-left hover:text-[#E39B82]">{tr('Confidentialité', 'الخصوصية')}</button>
            <button onClick={() => navigate('/legal/returns')} className="block text-left hover:text-[#E39B82]">{tr('Retours', 'الإرجاع')}</button>
            <button onClick={() => navigate('/legal/shipping')} className="block text-left hover:text-[#E39B82]">{tr('Livraison', 'التوصيل')}</button>
            <button onClick={() => navigate('/legal/vendorTerms')} className="block text-left hover:text-[#E39B82]">{tr('Conditions vendeur', 'شروط البائع')}</button>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm">{tr('Contact & Support', 'التواصل والدعم')}</h4>
            <p>Email: yassingasmi75@gmail.com</p>
            <p>{tr('Téléphone', 'الهاتف')}: +216 27 991 953</p>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 text-center text-xs text-slate-500 font-bold">
          <p>&copy; {new Date().getFullYear()} BuyHere. {tr('Tous droits réservés. Produit tunisien.', 'جميع الحقوق محفوظة. منتج تونسي.')}</p>
        </div>
      </footer>

      <CategoryDrawer
        open={showCategoryDrawer}
        onClose={() => setShowCategoryDrawer(false)}
        language={language}
        onSelectCategory={(category) => {
          setSelectedCategoryId(category ? category.id : null);
          navigate('/catalogue');
        }}
        onOpenFavorites={() => navigate('/favoris')}
        onOpenCoupons={() => navigate('/coupons')}
        onBecomeVendor={() => navigate('/vendeur/inscription')}
        onOpenSupport={() => navigate('/aide')}
      />

      {/* Floating Chat Widget */}
      {chatParams && (
        <ChatWidget
          defaultVendeurId={chatParams.vendeurId}
          defaultSujet={chatParams.sujet}
          defaultMessage={chatParams.message}
          onClose={() => setChatParams(null)}
          onEmptyStateAction={() => { setChatParams(null); navigate('/boutiques'); }}
          language={language}
        />
      )}

      {/* Global generic chat trigger */}
      {user && !chatParams && (
        <ChatWidget onEmptyStateAction={() => navigate('/boutiques')} language={language} />
      )}

      <ToastHost />

      {/* Login & Register Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fadeIn">
          <div className="relative grid max-h-[90vh] w-full max-w-3xl overflow-y-auto overflow-x-hidden rounded-lg bg-white shadow-soft lg:grid-cols-2">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-slate-400 backdrop-blur transition hover:text-slate-600 rtl:right-auto rtl:left-4"
            >
              <X size={20} />
            </button>

            {/* Form side */}
            <div className="p-6 sm:p-8 font-sans">
              <Logo variant="symbole" className="mb-4 h-10 w-10" />
              <h2 className="mb-2 text-2xl font-black text-slate-900">
                {authForm.isRegister ? tr('Créer un compte', 'إنشاء حساب') : tr('Bienvenue chez BuyHere', 'مرحبًا بكم في BuyHere')}
              </h2>
              <p className="mb-6 text-xs text-slate-500">
                {authForm.isRegister
                  ? tr('Profitez des favoris, des avis et du suivi de commande en Tunisie.', 'استفيدوا من المفضلة والتقييمات وتتبع الطلبات في تونس.')
                  : tr('Connectez-vous pour finaliser votre commande.', 'سجلوا الدخول لإتمام طلبكم.')}
              </p>

              {authError && (
                <div className="mb-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
                  <AlertCircle size={16} className="flex-shrink-0 text-rose-600" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {authForm.isRegister && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={tr('Prénom', 'الاسم')}
                      value={authForm.prenom}
                      onChange={(e) => setAuthForm({ ...authForm, prenom: e.target.value })}
                      className="input-premium p-3 text-xs outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder={tr('Nom', 'اللقب')}
                      value={authForm.nom}
                      onChange={(e) => setAuthForm({ ...authForm, nom: e.target.value })}
                      className="input-premium p-3 text-xs outline-none"
                      required
                    />
                  </div>
                )}

                <input
                  type="email"
                  placeholder={tr('Adresse email', 'البريد الإلكتروني')}
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="input-premium w-full p-3 text-xs outline-none"
                  required
                />

                {authForm.isRegister && (
                  <input
                    type="text"
                    placeholder={tr('Téléphone tunisien', 'الهاتف التونسي')}
                    value={authForm.telephone}
                    onChange={(e) => setAuthForm({ ...authForm, telephone: e.target.value })}
                    className="input-premium w-full p-3 text-xs outline-none"
                    required
                  />
                )}

                <input
                  type="password"
                  placeholder={tr('Mot de passe', 'كلمة المرور')}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="input-premium w-full p-3 text-xs outline-none"
                  required
                />

                {!authForm.isRegister && (
                  <div className="text-right rtl:text-left">
                    <button
                      type="button"
                      onClick={() => { setShowLoginModal(false); navigate('/reset-password'); }}
                      className="text-[10px] font-semibold text-slate-400 hover:text-[#994122]"
                    >
                      {tr('Mot de passe oublié ?', 'نسيت كلمة المرور؟')}
                    </button>
                  </div>
                )}

                <button type="submit" className="btn-primary-premium w-full py-3 text-xs">
                  {authForm.isRegister ? tr("S'inscrire", 'التسجيل') : tr('Continuer', 'متابعة')}
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setAuthForm({ ...authForm, isRegister: !authForm.isRegister })}
                    className="text-xs font-semibold text-slate-500 transition hover:text-[#994122]"
                  >
                    {authForm.isRegister ? tr('Déjà un compte ? Se connecter', 'لديك حساب؟ تسجيل الدخول') : tr('Créer un compte client', 'إنشاء حساب عميل')}
                  </button>
                </div>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400">{tr('Ou connectez-vous avec', 'أو سجلوا الدخول عبر')}</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div className="flex justify-center gap-4">
                <a
                  href={`${API_URL}/auth/google`}
                  aria-label={tr('Continuer avec Google', 'المتابعة عبر جوجل')}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 transition hover:shadow-md"
                >
                  <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
                    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
                    <path fill="#FBBC05" d="M11.69 28.18A13.98 13.98 0 0 1 10.9 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
                    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
                  </svg>
                </a>
                <a
                  href={`${API_URL}/auth/facebook`}
                  aria-label={tr('Continuer avec Facebook', 'المتابعة عبر فيسبوك')}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white transition hover:shadow-md"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
                  </svg>
                </a>
              </div>

              <p className="mt-5 text-center text-[10px] text-slate-400">
                {tr('En continuant, vous acceptez les', 'بالمتابعة، أنتم توافقون على')}{' '}
                <button
                  type="button"
                  onClick={() => { setShowLoginModal(false); navigate('/legal/cgu'); }}
                  className="font-semibold text-slate-500 underline hover:text-[#994122]"
                >
                  {tr("conditions d'utilisation", 'شروط الاستخدام')}
                </button>
              </p>
            </div>

            {/* Illustration side — desktop only */}
            <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center gradient-brand p-10 text-white">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg glass">
                <Store size={30} />
              </div>
              <h3 className="mt-6 text-center text-xl font-black">{tr('Le marketplace 100% tunisien', 'السوق التونسي 100%')}</h3>
              <p className="mt-2 max-w-[240px] text-center text-sm text-white/80">
                {tr('Des milliers de produits, des boutiques vérifiées, une livraison partout en Tunisie.', 'آلاف المنتجات، متاجر موثّقة، وتوصيل في كامل تونس.')}
              </p>
            </div>
          </div>
        </div>
      )}

      <PolicyConsentModal
        open={showPolicyConsent}
        language={language}
        onAccept={() => { setShowPolicyConsent(false); performAuthSubmit(); }}
        onRefuse={() => { setShowPolicyConsent(false); setAuthError(tr('Vous devez accepter les conditions de vente et de retour pour créer un compte.', 'يجب عليكم قبول شروط البيع والإرجاع لإنشاء حساب.')); }}
      />
    </div>
  );
}

export default App;
