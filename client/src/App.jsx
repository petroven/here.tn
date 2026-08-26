import { useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Menu,
  MessageSquare,
  Search,
  ShoppingCart,
  Star,
  Store,
  ShieldCheck,
  PackageCheck,
  Sparkles,
  Truck,
  TrendingUp,
  LogOut,
  Home,
  User,
  AlertCircle,
  X,
  Languages,
} from 'lucide-react';
import CheckoutPage from './pages/CheckoutPage';
import AdminDashboard from './pages/AdminDashboard';
import VendorDashboard from './pages/VendorDashboard';
import VendorRegistration from './pages/VendorRegistration';
import Marketplace from './pages/Marketplace';
import TrackingPage from './pages/TrackingPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ClientOrdersPage from './pages/ClientOrdersPage';
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
import PolicyConsentModal from './components/PolicyConsentModal';
import CategoryDrawer from './components/CategoryDrawer';
import { useTranslation } from './i18n';
import { API_URL } from './config/api.js';

function App() {
  const [language, setLanguage] = useState('fr');
  const { t } = useTranslation(language);
  const [view, setView] = useState('home');
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [legalPage, setLegalPage] = useState(null);
  const [confirmationToken, setConfirmationToken] = useState(null);
  
  const [cart, setCart] = useState([]);
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

  // Detect URL parameter-based routing on load
  useEffect(() => {
    const checkRouting = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token');
      const path = window.location.pathname;

      if (path.startsWith('/oauth/callback')) {
        setView('oauth-callback');
      } else if (path.startsWith('/payment/return')) {
        setView('payment-return');
      } else if (token) {
        setView('reset-password');
      } else if (path.startsWith('/boutiques/')) {
        setSelectedStoreId(path.split('/')[2]);
        setView('store');
      } else if (path.startsWith('/produits/')) {
        setSelectedProductId(path.split('/')[2]);
        setView('product');
      } else if (path.startsWith('/confirmer-commande/')) {
        setConfirmationToken(path.split('/')[2]);
        setView('confirm-order');
      }
    };

    checkRouting();
    
    // Auth init from token
    const savedToken = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    
    if (savedToken && userId) {
      setUser({ id: userId, role: userRole });
      
      // Auto-route admins to control panel
      if (['administrateur', 'super_admin'].includes(userRole)) {
        setView('admin');
      } else if (['vendeur', 'admin_boutique'].includes(userRole)) {
        setView('vendor-dashboard');
      } else if (userRole === 'livreur') {
        setView('livreur-dashboard');
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('adminToken');
    setUser(null);
    setView('home');
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
        setView('admin');
      } else if (['vendeur', 'admin_boutique'].includes(data.user.role)) {
        setView('vendor-dashboard');
      } else if (data.user.role === 'livreur') {
        setView('livreur-dashboard');
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
    setView('orders');
  };

  const handleStartChat = (vendeurId, sujet) => {
    setChatParams({ vendeurId, sujet });
  };

  const openStore = (storeId) => {
    setSelectedStoreId(storeId);
    setView('store');
  };

  const openProduct = (productId) => {
    setSelectedProductId(productId);
    setView('product');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen font-black text-slate-500">Chargement de here.tn...</div>;
  }

  // --- VIEWS ROUTING ---

  // Admin Panel
  if (view === 'admin') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  // Vendor Dashboard
  if (view === 'vendor-dashboard') {
    return (
      <div>
        <nav className="bg-white border-b border-slate-200 p-4 flex flex-wrap justify-between items-center gap-3 font-sans shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-teal-100 bg-teal-50 p-1">
              <img src="/logo-icon.png" alt="here.tn" className="h-full w-full object-contain" />
            </span>
            <h1 className="text-md font-black text-slate-800">Espace Vendeur</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setView('home')}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition"
            >
              Accueil Marketplace
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        </nav>
        <VendorDashboard />
      </div>
    );
  }

  // Vendor Registration
  if (view === 'vendor-registration') {
    return (
      <VendorRegistration
        onClose={() => setView('home')}
        onSuccess={(newUser) => {
          setUser(newUser);
          setView('vendor-dashboard');
        }}
        onOpenTerms={() => { setLegalPage('vendorTerms'); setView('legal'); }}
      />
    );
  }

  // Password reset page (ephemeral token)
  if (view === 'reset-password') {
    return <ResetPasswordPage />;
  }

  if (view === 'legal') {
    return <LegalPage type={legalPage || 'cgu'} language={language} onBack={() => setView('home')} />;
  }

  if (view === 'help-center') {
    return <HelpCenterPage language={language} onBack={() => setView('home')} />;
  }

  // Order confirmation page (public link sent by SMS)
  if (view === 'confirm-order') {
    return <ConfirmOrderPage token={confirmationToken} />;
  }

  // Livreur login (separate auth endpoint/response shape from client/vendor login)
  if (view === 'livreur-login') {
    return (
      <LivreurLoginPage
        onBack={() => setView('home')}
        onLoginSuccess={() => setView('livreur-dashboard')}
        onRegister={() => setView('livreur-registration')}
      />
    );
  }

  // Livreur self-registration (public application form)
  if (view === 'livreur-registration') {
    return (
      <LivreurRegistrationPage
        onBack={() => setView('livreur-login')}
        onSuccess={() => setView('livreur-dashboard')}
      />
    );
  }

  // Livreur dashboard (owns its own full-screen chrome, mobile-first)
  if (view === 'livreur-dashboard') {
    return <LivreurDashboardPage onLogout={handleLogout} />;
  }

  // OAuth redirect landing (Google/Facebook) — reads the one-time token, then routes by role
  if (view === 'oauth-callback') {
    return (
      <OAuthCallbackPage
        onSuccess={({ id, role }) => {
          setUser({ id, role });
          if (['administrateur', 'super_admin'].includes(role)) setView('admin');
          else if (['vendeur', 'admin_boutique'].includes(role)) setView('vendor-dashboard');
          else if (role === 'livreur') setView('livreur-dashboard');
          else setView('marketplace');
        }}
      />
    );
  }

  // Landing page after a real Konnect/Flouci redirect (never used in sandbox mode)
  if (view === 'payment-return') {
    return (
      <PaymentReturnPage
        onDone={() => {
          window.history.replaceState({}, '', '/');
          setCart([]);
          setView(user ? 'orders' : 'home');
        }}
      />
    );
  }

  // Main UI Shell (Home, Marketplace, Checkout, Tracking, Orders)
  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className={`marketplace-shell min-h-screen flex flex-col justify-between font-sans ${language === 'ar' ? 'rtl' : 'ltr'}`}>

      {/* Navigation */}
      <nav className="mp-header backdrop-blur border-b border-white/10 sticky top-0 z-50 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryDrawer(true)}
              aria-label={language === 'ar' ? 'فتح القائمة' : 'Ouvrir le menu'}
              className="rounded-xl p-2 text-slate-700 hover:bg-[#EEF2FF] hover:text-[#6366F1]"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('home')}>
              <img src="/logo-header.png" alt="here.tn" className="h-12 sm:h-14 w-auto" />
              <p className="hidden sm:block text-[10px] text-slate-300 font-semibold border-l border-slate-200 pl-2.5 ml-0.5">Marketplace multi-boutiques tunisienne</p>
            </div>
          </div>

          <div className="hidden lg:flex flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-3.5 text-slate-500" size={16} />
            <input
              type="text"
              readOnly
              onClick={() => setView('marketplace')}
              placeholder={language === 'ar' ? 'ماذا تبحث؟' : 'Que recherchez-vous ?'}
              className="w-full h-11 rounded-xl border border-white bg-white pl-10 pr-4 text-sm text-slate-800 outline-none cursor-pointer"
            />
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-700">
            <button onClick={() => setView('home')} className="px-3 py-2 rounded-xl hover:bg-[#EEF2FF] hover:text-[#6366F1]">Accueil</button>
            <button onClick={() => setView('marketplace')} className="px-3 py-2 rounded-xl hover:bg-[#EEF2FF] hover:text-[#6366F1]">Catalogue</button>
            <button onClick={() => setView('stores')} className="px-3 py-2 rounded-xl hover:bg-[#EEF2FF] hover:text-[#6366F1]">Boutiques</button>
            <button onClick={() => setView('tracking')} className="px-3 py-2 rounded-xl hover:bg-[#EEF2FF] hover:text-[#6366F1]">Suivi</button>
            <button
              onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-[#EEF2FF]"
            >
              FR | العربية
            </button>

            {user ? (
              <>
                <button
                  onClick={() => setView('orders')}
                  className="px-3 py-2 rounded-xl hover:bg-[#EEF2FF] hover:text-[#6366F1]"
                >
                  Mes Commandes
                </button>
                {['vendeur', 'admin_boutique'].includes(user.role) && (
                  <button
                    onClick={() => setView('vendor-dashboard')}
                    className="px-3 py-2 rounded-xl bg-[#6366F1] text-white hover:bg-[#4F46E5]"
                  >
                    Ma Boutique
                  </button>
                )}
                <button onClick={handleLogout} className="px-3 py-2 rounded-xl text-slate-700 hover:bg-[#EEF2FF] hover:text-[#6366F1]">Déconnexion</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setAuthForm({ email: '', password: '', nom: '', prenom: '', telephone: '', isRegister: false });
                    setAuthError('');
                    setShowLoginModal(true);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-[#EEF2FF]"
                >
                  Compte
                </button>
                <button onClick={() => setView('vendor-registration')} className="px-3 py-2 rounded-xl bg-[#6366F1] text-white hover:bg-[#4F46E5]">Devenir vendeur</button>
              </>
            )}

            <button
              onClick={() => setView('checkout')}
              className="relative text-[#6366F1] hover:text-[#4F46E5] p-2"
              aria-label="Panier"
            >
              <ShoppingCart size={20} />
              {cart.length > 0 && (
                <span className="absolute top-0 right-0 bg-[#6366F1] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-black">
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden text-slate-700" aria-label="Ouvrir le menu mobile">
            <Menu size={24} />
          </button>
        </div>

        {showMobileMenu && (
          <div className="md:hidden bg-white border-t border-slate-200 p-4 space-y-2 text-sm font-semibold text-slate-700">
            <button onClick={() => { setView('home'); setShowMobileMenu(false); }} className="block w-full text-left py-2">Accueil</button>
            <button onClick={() => { setView('marketplace'); setShowMobileMenu(false); }} className="block w-full text-left py-2">Catalogue</button>
            <button onClick={() => { setView('stores'); setShowMobileMenu(false); }} className="block w-full text-left py-2">Boutiques</button>
            <button onClick={() => { setView('tracking'); setShowMobileMenu(false); }} className="block w-full text-left py-2">Suivi colis</button>
            <button onClick={() => { setView('checkout'); setShowMobileMenu(false); }} className="block w-full text-left py-2">Panier ({cart.length})</button>
            {user && (
              <button onClick={() => { setView('orders'); setShowMobileMenu(false); }} className="block w-full text-left py-2">Mes Commandes</button>
            )}
            <button onClick={() => { setLanguage(language === 'fr' ? 'ar' : 'fr'); }} className="block w-full text-left py-2">FR | العربية</button>
            <div className="pt-2 border-t border-slate-200 flex gap-2">
              {user ? (
                <button onClick={() => { handleLogout(); setShowMobileMenu(false); }} className="w-full text-center py-2 text-red-600 bg-red-50 rounded-xl">Déconnexion</button>
              ) : (
                <>
                  <button onClick={() => { setShowLoginModal(true); setShowMobileMenu(false); }} className="flex-1 text-center py-2 border rounded-xl bg-white">Connexion</button>
                  <button onClick={() => { setView('vendor-registration'); setShowMobileMenu(false); }} className="flex-1 text-center py-2 bg-[#6366F1] text-white rounded-xl">Vendeur</button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Main View rendering */}
      <main className="flex-1">
        {view === 'home' && (
          <div className="space-y-10 pb-20 md:pb-10">
            <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
              <div className="premium-gradient rounded-[20px] border border-indigo-200 text-white p-7 sm:p-10 shadow-soft">
                <div className="max-w-2xl space-y-4">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
                    <Sparkles size={14} />
                    Plateforme tunisienne multi-boutiques
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight">
                    Tout ce que vous cherchez, au meme endroit.
                  </h2>
                  <p className="text-sm sm:text-base text-slate-200 max-w-xl">
                    Decouvrez des milliers de produits proposes par des boutiques tunisiennes. Un seul compte, un seul panier, plusieurs boutiques.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button onClick={() => setView('marketplace')} className="px-5 py-3 rounded-xl bg-white text-[#4F46E5] hover:bg-indigo-50 font-bold text-sm transition">
                      Decouvrir les produits
                    </button>
                    <button onClick={() => setView('vendor-registration')} className="px-5 py-3 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 transition">
                      Devenir vendeur
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex items-end justify-between mb-4">
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">Categories principales</h3>
                <button onClick={() => setView('marketplace')} className="text-sm font-bold text-[#6366F1] hover:text-[#4F46E5]">Voir tout</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['Informatique & Gaming', 'Téléphonie', 'Image & Électroménager', 'Mode', 'Bébé & Enfants', 'Beauté & Santé', 'Maison & Bricolage', 'Artisanat Tunisien', 'Alimentation', 'Sports & Voyage', 'Auto & Moto', 'Livres & Bureau'].map((category) => (
                  <button
                    key={category}
                    onClick={() => setView('marketplace')}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-indigo-300 hover:bg-[#EEF2FF] transition"
                  >
                    <p className="text-sm font-bold text-slate-800">{category}</p>
                    <p className="text-xs text-slate-500 mt-1">Boutiques tunisiennes</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  { icon: ShieldCheck, title: 'Paiement securise', text: 'COD, Konnect et Flouci (sandbox) avec verification des commandes.' },
                  { icon: PackageCheck, title: 'Protection acheteur', text: 'Retours et suivi des colis avec historique transparent.' },
                  { icon: Store, title: 'Boutiques verifiees', text: 'Validation des vendeurs et controle des boutiques.' },
                  { icon: Truck, title: 'Livraison nationale', text: 'Couverture des 24 gouvernorats avec frais lisibles.' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                      <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#6366F1] flex items-center justify-center mb-3">
                        <Icon size={20} />
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-600 mt-1">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <h4 className="text-lg font-extrabold text-slate-900">Les produits populaires</h4>
                  <p className="text-sm text-slate-600 mt-1">Explorez les meilleures ventes des boutiques locales.</p>
                  <button onClick={() => setView('marketplace')} className="mt-4 px-4 py-2 rounded-xl mp-secondary-button font-bold text-sm">Voir les produits</button>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6">
                  <h4 className="text-lg font-extrabold text-slate-900">Les meilleures boutiques</h4>
                  <p className="text-sm text-slate-600 mt-1">Parcourez des vitrines professionnelles et trouvez votre commerçant favori.</p>
                  <button onClick={() => setView('stores')} className="mt-4 px-4 py-2 rounded-xl mp-secondary-button font-bold text-sm">Voir les boutiques</button>
                </div>
              </div>
            </section>
          </div>
        )}

        {view === 'marketplace' && (
          <Marketplace
            cartItems={cart}
            onUpdateCart={handleAddToCart}
            onStartChat={handleStartChat}
            onViewCart={() => setView('checkout')}
            language={language}
            onViewProduct={openProduct}
            onViewStores={() => setView('stores')}
            initialCategoryId={selectedCategoryId}
          />
        )}

        {view === 'favorites' && (
          <FavoritesPage
            language={language}
            onBack={() => setView('home')}
            onOpenProduct={openProduct}
            onAddToCart={handleAddToCart}
          />
        )}

        {view === 'coupons' && (
          <CouponsPage language={language} onBack={() => setView('home')} />
        )}

        {view === 'stores' && <StoresPage language={language} onOpenStore={openStore} />}

        {view === 'store' && selectedStoreId && (
          <StorePage
            storeId={selectedStoreId}
            language={language}
            onBack={() => setView('stores')}
            onOpenProduct={openProduct}
            onAddToCart={handleAddToCart}
          />
        )}

        {view === 'product' && selectedProductId && (
          <ProductPage
            productId={selectedProductId}
            language={language}
            onBack={() => setView('marketplace')}
            onOpenStore={openStore}
            onOpenProduct={openProduct}
            onAddToCart={handleAddToCart}
            onStartChat={handleStartChat}
          />
        )}

        {view === 'checkout' && (
          <CheckoutPage
            cartItems={cart}
            onOrderPlaced={handleOrderPlaced}
            onBack={() => setView('marketplace')}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveFromCart}
            onRequireLogin={() => {
              setAuthForm({ email: '', password: '', nom: '', prenom: '', telephone: '', isRegister: false });
              setAuthError('');
              setShowLoginModal(true);
            }}
            language={language}
          />
        )}

        {view === 'tracking' && <TrackingPage language={language} />}

        {view === 'orders' && <ClientOrdersPage onStartChat={handleStartChat} language={language} />}
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2">
        <div className="grid grid-cols-5 gap-1 text-[11px] font-semibold text-slate-600">
          <button onClick={() => setView('home')} className="flex flex-col items-center py-1.5 hover:text-[#6366F1]">
            <Home size={16} />
            <span>Accueil</span>
          </button>
          <button onClick={() => setView('marketplace')} className="flex flex-col items-center py-1.5 hover:text-[#6366F1]">
            <Search size={16} />
            <span>Categories</span>
          </button>
          <button onClick={() => setView('marketplace')} className="flex flex-col items-center py-1.5 hover:text-[#6366F1]">
            <Store size={16} />
            <span>Recherche</span>
          </button>
          <button onClick={() => setView('checkout')} className="flex flex-col items-center py-1.5 hover:text-[#6366F1] relative">
            <ShoppingCart size={16} />
            <span>Panier</span>
            {cart.length > 0 && (
              <span className="absolute top-0 right-4 bg-[#6366F1] text-white rounded-full text-[9px] min-w-[14px] h-[14px] px-1 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
          <button onClick={() => (user ? setView('orders') : setShowLoginModal(true))} className="flex flex-col items-center py-1.5 hover:text-[#6366F1]">
            <User size={16} />
            <span>Compte</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-white py-12 mt-12 font-sans border-t border-[#1E293B] mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-xs font-medium text-slate-400">
          <div className="space-y-3">
            <h4 className="font-bold text-white text-sm">À propos de here.tn</h4>
            <p>La première plateforme e-commerce tunisienne bilingue avec gestion de stock avancée, logistique intégrée et paiement sandbox.</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm">Liens Utiles</h4>
            <button onClick={() => setView('marketplace')} className="block hover:text-white">Catalogue produits</button>
            <button onClick={() => setView('tracking')} className="block hover:text-white">Suivre mon colis</button>
            <button onClick={() => setView('vendor-registration')} className="block hover:text-white">Devenir vendeur indépendant</button>
            <button onClick={() => setView('livreur-login')} className="block hover:text-white">Espace Livreur</button>
            <button onClick={() => { setLegalPage('cgu'); setView('legal'); }} className="block text-left hover:text-[#818CF8]">Conditions générales</button>
            <button onClick={() => { setLegalPage('privacy'); setView('legal'); }} className="block text-left hover:text-[#818CF8]">Confidentialité</button>
            <button onClick={() => { setLegalPage('returns'); setView('legal'); }} className="block text-left hover:text-[#818CF8]">Retours</button>
            <button onClick={() => { setLegalPage('shipping'); setView('legal'); }} className="block text-left hover:text-[#818CF8]">Livraison</button>
            <button onClick={() => { setLegalPage('vendorTerms'); setView('legal'); }} className="block text-left hover:text-[#818CF8]">Conditions vendeur</button>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-white text-sm">Contact & Support</h4>
            <p>Email: yassingasmi75@gmail.com</p>
            <p>Téléphone: +216 27 991 953</p>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 text-center text-xs text-slate-500 font-bold">
          <p>&copy; {new Date().getFullYear()} here.tn. Tous droits réservés. Produit tunisien.</p>
        </div>
      </footer>

      <CategoryDrawer
        open={showCategoryDrawer}
        onClose={() => setShowCategoryDrawer(false)}
        language={language}
        onSelectCategory={(category) => {
          setSelectedCategoryId(category ? category.id : null);
          setView('marketplace');
        }}
        onOpenFavorites={() => setView('favorites')}
        onOpenCoupons={() => setView('coupons')}
        onBecomeVendor={() => setView('vendor-registration')}
        onOpenSupport={() => setView('help-center')}
      />

      {/* Floating Chat Widget */}
      {chatParams && (
        <ChatWidget
          defaultVendeurId={chatParams.vendeurId}
          defaultSujet={chatParams.sujet}
          onClose={() => setChatParams(null)}
        />
      )}

      {/* Global generic chat trigger */}
      {user && !chatParams && (
        <ChatWidget />
      )}

      {/* Login & Register Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fadeIn">
          <div className="relative grid max-h-[90vh] w-full max-w-3xl overflow-y-auto overflow-x-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-2">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-slate-400 backdrop-blur transition hover:text-slate-600 rtl:right-auto rtl:left-4"
            >
              <X size={20} />
            </button>

            {/* Form side */}
            <div className="p-6 sm:p-8 font-sans">
              <h2 className="mb-2 text-2xl font-black text-slate-900">
                {authForm.isRegister ? 'Créer un compte' : 'Bienvenue chez here.tn'}
              </h2>
              <p className="mb-6 text-xs text-slate-500">
                {authForm.isRegister
                  ? 'Profitez des favoris, des avis et du suivi de commande en Tunisie.'
                  : 'Connectez-vous pour finaliser votre commande.'}
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
                      placeholder="Prénom"
                      value={authForm.prenom}
                      onChange={(e) => setAuthForm({ ...authForm, prenom: e.target.value })}
                      className="input-premium p-3 text-xs outline-none"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Nom"
                      value={authForm.nom}
                      onChange={(e) => setAuthForm({ ...authForm, nom: e.target.value })}
                      className="input-premium p-3 text-xs outline-none"
                      required
                    />
                  </div>
                )}

                <input
                  type="email"
                  placeholder="Adresse email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="input-premium w-full p-3 text-xs outline-none"
                  required
                />

                {authForm.isRegister && (
                  <input
                    type="text"
                    placeholder="Téléphone tunisien"
                    value={authForm.telephone}
                    onChange={(e) => setAuthForm({ ...authForm, telephone: e.target.value })}
                    className="input-premium w-full p-3 text-xs outline-none"
                    required
                  />
                )}

                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="input-premium w-full p-3 text-xs outline-none"
                  required
                />

                {!authForm.isRegister && (
                  <div className="text-right rtl:text-left">
                    <button
                      type="button"
                      onClick={() => { setShowLoginModal(false); setView('reset-password'); }}
                      className="text-[10px] font-semibold text-slate-400 hover:text-[#7C3AED]"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                <button type="submit" className="btn-primary-premium w-full py-3 text-xs">
                  {authForm.isRegister ? "S'inscrire" : 'Continuer'}
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setAuthForm({ ...authForm, isRegister: !authForm.isRegister })}
                    className="text-xs font-semibold text-slate-500 transition hover:text-[#7C3AED]"
                  >
                    {authForm.isRegister ? 'Déjà un compte ? Se connecter' : 'Créer un compte client'}
                  </button>
                </div>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-semibold text-slate-400">Ou connectez-vous avec</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div className="flex justify-center gap-4">
                <a
                  href={`${API_URL}/auth/google`}
                  aria-label="Continuer avec Google"
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
                  aria-label="Continuer avec Facebook"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white transition hover:shadow-md"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
                  </svg>
                </a>
              </div>

              <p className="mt-5 text-center text-[10px] text-slate-400">
                En continuant, vous acceptez les{' '}
                <button
                  type="button"
                  onClick={() => { setShowLoginModal(false); setLegalPage('cgu'); setView('legal'); }}
                  className="font-semibold text-slate-500 underline hover:text-[#7C3AED]"
                >
                  conditions d'utilisation
                </button>
              </p>
            </div>

            {/* Illustration side — desktop only */}
            <div className="relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center gradient-brand p-10 text-white">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
              <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10" />
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl glass">
                <Store size={30} />
              </div>
              <h3 className="relative z-10 mt-6 text-center text-xl font-black">Le marketplace 100% tunisien</h3>
              <p className="relative z-10 mt-2 max-w-[240px] text-center text-sm text-white/80">
                Des milliers de produits, des boutiques vérifiées, une livraison partout en Tunisie.
              </p>
            </div>
          </div>
        </div>
      )}

      <PolicyConsentModal
        open={showPolicyConsent}
        language={language}
        onAccept={() => { setShowPolicyConsent(false); performAuthSubmit(); }}
        onRefuse={() => { setShowPolicyConsent(false); setAuthError("Vous devez accepter les conditions de vente et de retour pour créer un compte."); }}
      />
    </div>
  );
}

export default App;
