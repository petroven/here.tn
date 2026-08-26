import React, { useMemo, useState, useEffect } from 'react';
import {
  Truck, CreditCard, CheckCircle, AlertCircle, Sparkles, Wallet,
  ShoppingBag, Minus, Plus, Trash2, Check, MapPin, Lock, ShieldCheck, Landmark, Clock, ArrowLeft,
} from 'lucide-react';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { API_URL } from '../config/api.js';

const STEPS = [
  { key: 'panier', labelFr: 'Panier', labelAr: 'السلة' },
  { key: 'livraison', labelFr: 'Livraison & Paiement', labelAr: 'التوصيل والدفع' },
  { key: 'confirmation', labelFr: 'Confirmation', labelAr: 'التأكيد' },
];

function StepIndicator({ activeIndex, isAr }) {
  return (
    <div className="flex items-center">
      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition-all duration-300 ${
                  done ? 'bg-emerald-500 text-white' : active ? 'gradient-brand text-white shadow-md' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <Check size={15} /> : index + 1}
              </div>
              <span className={`hidden text-[11px] font-bold sm:block ${active ? 'text-[#7C3AED]' : done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {isAr ? step.labelAr : step.labelFr}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 w-10 flex-1 sm:w-20 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function CheckoutPage({ cartItems = [], onOrderPlaced, onBack, onUpdateQuantity, onRemoveItem, onRequireLogin, language = 'fr' }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [gouvernorats, setGouvernorats] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [virementConfig, setVirementConfig] = useState(null); // { virementDisponible, platformBank }
  const [virementRefInput, setVirementRefInput] = useState('');
  const [virementResult, setVirementResult] = useState(null); // instructions returned after order creation

  const [form, setForm] = useState({ nom: '', prenom: '', adresse: '', gouvernoratId: '', delegationId: '', telephone: '' });
  const [shippingFee, setShippingFee] = useState(0);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline card payment (Konnect/Flouci) — never redirects off-site
  const [pendingPayment, setPendingPayment] = useState(null); // { paymentRef, amount, provider }
  const [cardForm, setCardForm] = useState({ name: '', number: '', expiry: '', cvv: '' });
  const [cardSubmitting, setCardSubmitting] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardFieldError, setCardFieldError] = useState('');
  const [cardFlipped, setCardFlipped] = useState(false);

  const [walletSolde, setWalletSolde] = useState(0);
  const [useWallet, setUseWallet] = useState(false);
  const [walletAmountInput, setWalletAmountInput] = useState('');

  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((data) => { if (data.success) setWalletSolde(data.data.solde); })
      .catch(() => setWalletSolde(0));
  }, [token]);

  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + (item.prix * item.quantity), 0), [cartItems]);

  const cartByStore = useMemo(() => cartItems.reduce((acc, item) => {
    const storeKey = item.boutiqueId || 'unknown';
    const storeName = item.boutiqueNom || tr('Boutique locale', 'متجر محلي');
    if (!acc[storeKey]) acc[storeKey] = { boutiqueId: storeKey, boutiqueNom: storeName, items: [], subtotal: 0 };
    acc[storeKey].items.push(item);
    acc[storeKey].subtotal += item.prix * item.quantity;
    return acc;
  }, {}), [cartItems, language]);

  const groupedStores = useMemo(() => Object.values(cartByStore), [cartByStore]);

  useEffect(() => { fetchGouvernorats(); }, []);

  useEffect(() => {
    fetch(`${API_URL}/config/payment-methods`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setVirementConfig(data.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (form.gouvernoratId) {
      fetchDelegations(form.gouvernoratId);
      const selectedGov = gouvernorats.find((g) => Number(g.id) === Number(form.gouvernoratId));
      if (selectedGov) setShippingFee(selectedGov.fraisLivraison);
    } else {
      setDelegations([]);
      setShippingFee(0);
    }
  }, [form.gouvernoratId, gouvernorats]);

  const fetchGouvernorats = async () => {
    try {
      const response = await fetch(`${API_URL}/gouvernorats`);
      const data = await response.json();
      if (data.success) setGouvernorats(data.data);
    } catch (err) { console.error('Error fetching gouvernorats:', err); }
  };

  const fetchDelegations = async (govId) => {
    setLoadingGeo(true);
    try {
      const response = await fetch(`${API_URL}/gouvernorats/${govId}/delegations`);
      const data = await response.json();
      if (data.success) setDelegations(data.data);
    } catch (err) { console.error('Error fetching delegations:', err); } finally { setLoadingGeo(false); }
  };

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const response = await fetch(`${API_URL}/coupons/valider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: couponCode.trim(), sousTotal: subtotal }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || tr('Coupon invalide.', 'كوبون غير صالح.'));
      setAppliedCoupon({ code: data.data.code, remise: data.data.remise });
      setCouponError('');
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message);
    } finally {
      setCouponLoading(false);
    }
  };

  const shippingTotal = shippingFee * Math.max(groupedStores.length, 1);
  const remiseCoupon = appliedCoupon ? appliedCoupon.remise : 0;
  const plafondWalletProduits = Math.max(0, subtotal - remiseCoupon);
  const walletMontantApplique = useWallet ? Math.min(Number(walletAmountInput) || 0, walletSolde, plafondWalletProduits) : 0;
  const finalTotal = subtotal + shippingTotal - remiseCoupon - walletMontantApplique;

  const handleToggleWallet = () => {
    const next = !useWallet;
    setUseWallet(next);
    if (next) setWalletAmountInput(String(Math.min(walletSolde, plafondWalletProduits).toFixed(3)));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setStatus({
        type: 'login-required',
        message: tr('Vous devez être connecté à votre compte here.tn pour valider la commande — ce n\'est pas un problème de réseau.', 'يجب تسجيل الدخول إلى حسابك في here.tn لتأكيد الطلب — لا علاقة للأمر بمشكلة في الشبكة.'),
      });
      return;
    }
    if (!cartItems.length) { setStatus({ type: 'error', message: tr('Votre panier est vide.', 'سلتك فارغة.') }); return; }
    if (!form.gouvernoratId || !form.delegationId || !form.adresse) { setStatus({ type: 'error', message: tr('Veuillez renseigner toutes les informations de livraison.', 'يرجى إدخال جميع معلومات التوصيل.') }); return; }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });
    try {
      const payload = {
        clientId: Number(userId),
        lignes: cartItems.map((item) => ({ produitId: item.id, varianteId: item.varianteId || null, quantite: item.quantity })),
        adresseLivraison: `${form.adresse}, ${form.telephone}`,
        gouvernoratId: Number(form.gouvernoratId),
        delegationId: Number(form.delegationId),
        methodePaiement: selectedPayment,
        referenceVirement: selectedPayment === 'virement' ? virementRefInput : undefined,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        walletMontant: walletMontantApplique,
      };
      const response = await fetch(`${API_URL}/commandes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.message || tr('Erreur lors de la validation.', 'حدث خطأ أثناء تأكيد الطلب.'));

      const redirect = data.data.paymentRedirect;
      if (data.data.virementInstructions) {
        setVirementResult(data.data.virementInstructions);
        setStatus({ type: '', message: '' });
      } else if (redirect?.sandbox && redirect?.paymentRef) {
        // Sandbox/dev : simulateur affiché directement ici, aucune carte
        // réelle n'est jamais collectée par notre serveur.
        setPendingPayment({ paymentRef: redirect.paymentRef, amount: finalTotal, provider: selectedPayment });
        setStatus({ type: '', message: '' });
      } else if (redirect?.paymentUrl) {
        // Vrai paiement : la saisie de carte doit se faire chez le
        // prestataire (Konnect/Flouci), jamais sur notre propre serveur —
        // c'est une exigence de conformité (PCI-DSS), pas un choix de design.
        setStatus({ type: 'success', message: tr('Redirection vers le paiement sécurisé...', 'إعادة التوجيه إلى الدفع الآمن...') });
        setTimeout(() => { window.location.href = redirect.paymentUrl; }, 800);
      } else {
        setStatus({ type: 'success', message: tr('Commande créée avec succès!', 'تم إنشاء الطلب بنجاح!') });
        setTimeout(() => { if (onOrderPlaced) onOrderPlaced(); }, 2000);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message || tr('La commande n’a pas pu être validée.', 'تعذر تأكيد الطلب.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCardNumber = (value) => value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const detectCardBrand = (digits) => {
    if (/^4/.test(digits)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'MASTERCARD';
    return null;
  };
  const formatExpiry = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  };

  // Luhn checksum — the standard check every real card number satisfies
  // (rejects typos/garbage without needing a live gateway to verify).
  const luhnCheck = (num) => {
    let sum = 0;
    let alternate = false;
    for (let i = num.length - 1; i >= 0; i -= 1) {
      let n = parseInt(num[i], 10);
      if (alternate) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  };

  const handleConfirmCard = async (e) => {
    e.preventDefault();
    setCardError('');
    setCardFieldError('');

    const digits = cardForm.number.replace(/\s/g, '');
    if (digits.length < 13 || digits.length > 19) { setCardFieldError('number'); setCardError(tr('Numéro de carte invalide.', 'رقم البطاقة غير صالح.')); return; }
    if (!luhnCheck(digits)) { setCardFieldError('number'); setCardError(tr('Numéro de carte invalide (échec de la vérification).', 'رقم البطاقة غير صالح (فشل التحقق).')); return; }
    if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry)) { setCardFieldError('expiry'); setCardError(tr("Date d'expiration invalide (MM/AA).", 'تاريخ الانتهاء غير صالح (MM/AA).')); return; }
    const [expMonth, expYear] = cardForm.expiry.split('/').map(Number);
    if (expMonth < 1 || expMonth > 12) { setCardFieldError('expiry'); setCardError(tr("Mois d'expiration invalide.", 'شهر الانتهاء غير صالح.')); return; }
    const expiryDate = new Date(2000 + expYear, expMonth, 0, 23, 59, 59);
    if (expiryDate < new Date()) { setCardFieldError('expiry'); setCardError(tr('Cette carte a expiré.', 'انتهت صلاحية هذه البطاقة.')); return; }
    if (!/^\d{3,4}$/.test(cardForm.cvv)) { setCardFieldError('cvv'); setCardError(tr('CVV invalide.', 'رمز CVV غير صالح.')); return; }
    if (cardForm.name.trim().length < 2) { setCardFieldError('name'); setCardError(tr('Nom du titulaire requis.', 'اسم حامل البطاقة مطلوب.')); return; }

    setCardSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/paiements/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentRef: pendingPayment.paymentRef }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || tr('Paiement refusé.', 'تم رفض الدفع.'));

      setPendingPayment(null);
      setStatus({ type: 'success', message: tr('Paiement confirmé, commande créée avec succès!', 'تم تأكيد الدفع، تم إنشاء الطلب بنجاح!') });
      setTimeout(() => { if (onOrderPlaced) onOrderPlaced(); }, 1800);
    } catch (error) {
      setCardError(error.message || tr('Le paiement a échoué.', 'فشلت عملية الدفع.'));
    } finally {
      setCardSubmitting(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center p-6 text-center font-sans">
        <img src="/logo-alt-basket.png" alt="" className="mb-6 h-28 w-28 object-contain" />
        <h1 className="text-xl font-black text-slate-900">{tr('Votre panier est vide', 'سلتك فارغة')}</h1>
        <p className="mt-2 text-sm text-slate-500">{tr('Ajoutez des produits pour commencer votre commande.', 'أضف منتجات لبدء طلبك.')}</p>
        <button onClick={onBack} className="btn-primary-premium mt-6 px-6 py-3 text-sm">
          {tr('Découvrir le catalogue', 'اكتشف الكتالوج')}
        </button>
      </div>
    );
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-5 p-4 pb-24 sm:p-6 md:pb-6 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div>
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{tr('Finaliser ma commande', 'إتمام الطلب')}</h1>
          <p className="mt-1 text-xs text-slate-500">{tr('Vérifiez votre panier puis renseignez la livraison', 'راجع سلتك ثم أدخل معلومات التوصيل')}</p>
        </div>
        <button onClick={onBack} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
          {tr('Retour au catalogue', 'العودة إلى الكتالوج')}
        </button>
      </div>

      <div className="flex justify-center rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-soft">
        <StepIndicator activeIndex={1} isAr={isAr} />
      </div>

      <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">

          {/* Cart items review */}
          <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-800">
              <ShoppingBag size={18} className="text-[#7C3AED]" /> {tr('Mon panier', 'سلتي')} ({cartItems.length})
            </h2>
            {cartItems.map((item) => (
              <div key={`${item.boutiqueId}-${item.id}-${item.varianteId || 'base'}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {item.image ? <img src={item.image} alt={item.nom} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ShoppingBag size={20} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{item.nom}</p>
                  {item.selectedVariantName && <p className="text-[11px] text-slate-400">{item.selectedVariantName}</p>}
                  <p className="mt-0.5 text-sm font-black text-[#7C3AED]">{item.prix.toFixed(3)} TND</p>
                </div>

                {onUpdateQuantity && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.varianteId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-[#7C3AED] hover:text-[#7C3AED] disabled:opacity-30"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.id, item.varianteId, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-[#7C3AED] hover:text-[#7C3AED] disabled:opacity-30"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}

                {onRemoveItem && (
                  <button type="button" onClick={() => onRemoveItem(item.id, item.varianteId)} aria-label={tr('Supprimer', 'حذف')} className="p-1.5 text-slate-300 transition hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </section>

          {/* Address */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
              <MapPin size={18} className="text-[#7C3AED]" />
              {tr('Adresse de livraison (Tunisie)', 'عنوان التوصيل (تونس)')}
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={form.prenom} onChange={updateField('prenom')} placeholder={tr('Prénom', 'الاسم الأول')} required />
              <Input value={form.nom} onChange={updateField('nom')} placeholder={tr('Nom', 'اللقب')} required />

              <select value={form.gouvernoratId} onChange={updateField('gouvernoratId')} className="input-premium p-3 text-sm outline-none" required>
                <option value="">{tr('Sélectionner Gouvernorat', 'اختر الولاية')}</option>
                {gouvernorats.map((gov) => <option key={gov.id} value={gov.id}>{isAr ? gov.nomAr : gov.nom}</option>)}
              </select>

              <select value={form.delegationId} onChange={updateField('delegationId')} className="input-premium p-3 text-sm outline-none disabled:opacity-50" disabled={!form.gouvernoratId || loadingGeo} required>
                <option value="">{loadingGeo ? tr('Chargement...', 'جارٍ التحميل...') : tr('Sélectionner Délégation', 'اختر المعتمدية')}</option>
                {delegations.map((del) => <option key={del.id} value={del.id}>{del.nom}</option>)}
              </select>

              <Input containerClassName="md:col-span-2" value={form.adresse} onChange={updateField('adresse')} placeholder={tr('Rue, Cité, Numéro de maison', 'الشارع، الحي، رقم المنزل')} required />
              <Input containerClassName="md:col-span-2" value={form.telephone} onChange={updateField('telephone')} placeholder={tr('Téléphone tunisien (Ex: 98123456)', 'رقم الهاتف التونسي')} pattern="^[2-9][0-9]{7}$" title={tr('8 chiffres, sans le 0 initial (ex: 98123456)', '8 أرقام بدون صفر في البداية')} required />
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
              <CreditCard size={18} className="text-[#7C3AED]" />
              {tr('Méthode de paiement', 'طريقة الدفع')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { key: 'cod', icon: Truck, title: tr('COD / Livraison', 'الدفع عند الاستلام'), desc: tr('Paiement en espèces à la livraison.', 'الدفع نقدًا عند الاستلام.') },
                { key: 'konnect', icon: CreditCard, title: 'Konnect', desc: tr('Cartes CIB & E-Dinar (Sandbox).', 'بطاقات بنكية (تجريبي).') },
                { key: 'flouci', icon: CreditCard, title: 'Flouci', desc: tr('Portefeuille ou carte (Sandbox).', 'محفظة أو بطاقة (تجريبي).') },
                ...(virementConfig?.virementDisponible
                  ? [{ key: 'virement', icon: Landmark, title: tr('Virement bancaire', 'تحويل بنكي'), desc: tr('Validation manuelle après réception.', 'تحقق يدوي بعد الاستلام.') }]
                  : []),
              ].map((option) => {
                const Icon = option.icon;
                const active = selectedPayment === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedPayment(option.key)}
                    className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all duration-200 ${active ? 'border-[#7C3AED] bg-[#F5F3FF] shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon size={18} className={active ? 'text-[#7C3AED]' : 'text-slate-400'} />
                      {active && <span className="flex h-4 w-4 items-center justify-center rounded-full gradient-brand text-white"><Check size={10} /></span>}
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      {option.title}
                      {(option.key === 'konnect' || option.key === 'flouci') && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
                          {tr('Test', 'تجريبي')}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">{option.desc}</span>
                  </button>
                );
              })}
            </div>
            {selectedPayment === 'virement' && (
              <div className="mt-4 rounded-2xl border border-[#E0E7FF] bg-[#F5F3FF] p-4">
                <p className="text-xs font-semibold text-slate-600">
                  {tr(
                    "Les coordonnées bancaires de la plateforme s'afficheront après validation de la commande. Votre commande restera \"en attente\" jusqu'à ce que notre équipe confirme la réception du virement.",
                    'ستظهر لك الإحداثيات البنكية للمنصة بعد تأكيد الطلب. سيبقى طلبك "قيد الانتظار" حتى يؤكد فريقنا استلام التحويل.',
                  )}
                </p>
                <Input
                  containerClassName="mt-3"
                  className="bg-white"
                  placeholder={tr('Référence du virement (optionnel)', 'مرجع التحويل (اختياري)')}
                  value={virementRefInput}
                  onChange={(e) => setVirementRefInput(e.target.value)}
                />
              </div>
            )}
          </section>
        </div>

        {/* Sticky Summary */}
        <aside className="space-y-5 self-start rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-soft lg:sticky lg:top-6">
          <h2 className="text-base font-bold text-slate-800">{tr('Résumé de commande', 'ملخص الطلب')}</h2>

          <div className="border-b border-slate-200 pb-4">
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <Input containerClassName="flex-1" type="text" placeholder={tr('Code coupon', 'رمز الكوبون')} value={couponCode} onChange={(e) => setCouponCode(e.target.value)} disabled={couponLoading || appliedCoupon} className="bg-white" />
              <button type="submit" disabled={couponLoading || appliedCoupon} className="btn-secondary-premium px-4 py-2.5 text-xs">
                {tr('Appliquer', 'تطبيق')}
              </button>
            </form>
            {couponError && <p className="mt-1 text-[10px] font-semibold text-rose-600">{couponError}</p>}
            {appliedCoupon && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                <span className="flex items-center gap-1.5 font-semibold"><Sparkles size={14} className="text-emerald-600" /> {appliedCoupon.code}</span>
                <span className="font-bold">-{appliedCoupon.remise.toFixed(3)} TND</span>
              </div>
            )}
          </div>

          {walletSolde > 0 && (
            <div className="border-b border-slate-200 pb-4">
              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Wallet size={14} className="text-amber-600" /> {tr('Utiliser mon solde', 'استخدام رصيدي')} ({walletSolde.toFixed(3)} TND)</span>
                <input type="checkbox" checked={useWallet} onChange={handleToggleWallet} className="h-4 w-4 accent-amber-600" />
              </label>
              {useWallet && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min="0" max={Math.min(walletSolde, plafondWalletProduits)} step="0.001" value={walletAmountInput} onChange={(e) => setWalletAmountInput(e.target.value)} className="input-premium flex-1 bg-white px-3 py-2 text-xs" />
                  <span className="text-[10px] font-semibold text-slate-400">TND</span>
                </div>
              )}
              <p className="mt-1.5 text-[10px] text-slate-400">{tr('Les frais de livraison restent à régler séparément.', 'تبقى مصاريف التوصيل مستحقة الدفع بشكل منفصل.')}</p>
            </div>
          )}

          <div className="space-y-2.5">
            {groupedStores.map((store) => (
              <div key={store.boutiqueId} className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span className="truncate">{store.boutiqueNom}</span>
                <span>{store.subtotal.toFixed(3)} TND</span>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
              <span className="text-slate-500">{tr('Sous-total', 'المجموع الفرعي')}</span>
              <span className="font-bold text-slate-800">{subtotal.toFixed(3)} TND</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{tr('Frais de livraison', 'مصاريف التوصيل')}</span>
              <span className="font-bold text-slate-800">{shippingTotal > 0 ? `${shippingTotal.toFixed(3)} TND` : tr('Gratuit', 'مجاني')}</span>
            </div>
            {appliedCoupon && (
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                <span>{tr('Remise coupon', 'خصم الكوبون')}</span>
                <span>-{appliedCoupon.remise.toFixed(3)} TND</span>
              </div>
            )}
            {walletMontantApplique > 0 && (
              <div className="flex items-center justify-between text-xs font-semibold text-amber-700">
                <span>{tr('Solde utilisé', 'الرصيد المستخدم')}</span>
                <span>-{walletMontantApplique.toFixed(3)} TND</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm font-black text-slate-900">
              <span>{tr('Total', 'المجموع')}</span>
              <span className="text-gradient-brand text-lg">{finalTotal.toFixed(3)} TND</span>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting || cartItems.length === 0} className="btn-primary-premium w-full py-3.5 text-xs">
            {isSubmitting ? tr('Validation...', 'جارٍ التأكيد...') : tr('Passer commande', 'تأكيد الطلب')}
          </button>

          {status.type === 'login-required' && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
              <div className="flex gap-2">
                <AlertCircle size={16} className="flex-shrink-0 text-amber-600" />
                <span>{status.message}</span>
              </div>
              {onRequireLogin && (
                <button
                  type="button"
                  onClick={onRequireLogin}
                  className="btn-primary-premium w-full py-2.5 text-xs"
                >
                  {tr('Se connecter', 'تسجيل الدخول')}
                </button>
              )}
            </div>
          )}

          {status.message && status.type !== 'login-required' && (
            <div className={`flex gap-2 rounded-xl border p-3.5 text-xs ${
              status.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : status.type === 'pending'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
            >
              {status.type === 'success'
                ? <CheckCircle size={16} className="flex-shrink-0 text-emerald-600" />
                : status.type === 'pending'
                  ? <Clock size={16} className="flex-shrink-0 text-amber-600" />
                  : <AlertCircle size={16} className="flex-shrink-0 text-rose-600" />}
              <span>{status.message}</span>
            </div>
          )}
        </aside>
      </form>

      {/* Inline card payment form — appears directly, no redirection off-site */}
      <Modal open={!!pendingPayment} onClose={() => {}} maxWidth="max-w-sm">
        {pendingPayment && (
          <form onSubmit={handleConfirmCard} className="space-y-4">
            <button
              type="button"
              onClick={() => setPendingPayment(null)}
              disabled={cardSubmitting}
              className="-mt-1 -ms-1 flex items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-600"
            >
              <ArrowLeft size={14} className="rtl:rotate-180" /> {tr('Retour à la commande', 'العودة إلى الطلب')}
            </button>

            {/* Live card preview */}
            <div className="[perspective:1000px]">
              <div
                className="relative h-44 w-full transition-transform duration-500 [transform-style:preserve-3d]"
                style={{ transform: cardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
              >
                {/* Front */}
                <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl gradient-brand p-5 text-white shadow-lg [backface-visibility:hidden]">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-9 rounded bg-white/25" />
                    <span className="text-xs font-black italic tracking-wide opacity-90">
                      {detectCardBrand(cardForm.number.replace(/\s/g, '')) || (pendingPayment.provider === 'flouci' ? 'FLOUCI' : 'KONNECT')}
                    </span>
                  </div>
                  <p className="relative z-10 font-mono text-lg tracking-[0.15em]">
                    {cardForm.number || '•••• •••• •••• ••••'}
                  </p>
                  <div className="relative z-10 flex items-end justify-between text-[11px]">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase opacity-60">{tr('Titulaire', 'الحامل')}</p>
                      <p className="truncate font-bold uppercase tracking-wide">{cardForm.name || tr('NOM PRÉNOM', 'الاسم')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase opacity-60">Exp</p>
                      <p className="font-bold">{cardForm.expiry || 'MM/AA'}</p>
                    </div>
                  </div>
                </div>
                {/* Back (CVV strip) */}
                <div className="absolute inset-0 overflow-hidden rounded-2xl gradient-brand text-white shadow-lg [backface-visibility:hidden] [transform:rotateY(180deg)]">
                  <div className="mt-5 h-10 w-full bg-slate-900/70" />
                  <div className="mt-4 px-5">
                    <div className="flex h-8 items-center justify-end rounded bg-white/90 px-3">
                      <span className="font-mono text-sm font-bold text-slate-800">{cardForm.cvv || '•••'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5F3FF] text-[#7C3AED]">
                <CreditCard size={20} />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">{tr('Paiement par carte', 'الدفع بالبطاقة')}</h2>
                <p className="text-xs text-slate-400">{pendingPayment.provider === 'flouci' ? 'Flouci' : 'Konnect'} · {pendingPayment.amount.toFixed(3)} TND</p>
              </div>
            </div>

            {cardError && (
              <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <AlertCircle size={15} className="flex-shrink-0" /> {cardError}
              </div>
            )}

            <Input
              placeholder={tr('Nom du titulaire', 'اسم حامل البطاقة')}
              value={cardForm.name}
              onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })}
              style={cardFieldError === 'name' ? { borderColor: '#fb7185' } : undefined}
              required
            />
            <Input
              placeholder="4000 0000 0000 0000"
              value={cardForm.number}
              onChange={(e) => setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })}
              inputMode="numeric"
              style={cardFieldError === 'number' ? { borderColor: '#fb7185' } : undefined}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="MM/AA"
                value={cardForm.expiry}
                onChange={(e) => setCardForm({ ...cardForm, expiry: formatExpiry(e.target.value) })}
                inputMode="numeric"
                style={cardFieldError === 'expiry' ? { borderColor: '#fb7185' } : undefined}
                required
              />
              <Input
                placeholder="CVV"
                type="password"
                value={cardForm.cvv}
                onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                onFocus={() => setCardFlipped(true)}
                onBlur={() => setCardFlipped(false)}
                inputMode="numeric"
                style={cardFieldError === 'cvv' ? { borderColor: '#fb7185' } : undefined}
                required
              />
            </div>

            <button type="submit" disabled={cardSubmitting} className="btn-primary-premium flex w-full items-center justify-center gap-2 py-3.5 text-sm">
              <Lock size={15} /> {cardSubmitting ? tr('Paiement...', 'جارٍ الدفع...') : tr('Payer', 'ادفع')} {pendingPayment.amount.toFixed(3)} TND
            </button>

            <button
              type="button"
              onClick={() => { setPendingPayment(null); setStatus({ type: 'pending', message: tr('Paiement annulé — commande enregistrée mais NON payée. Vous pourrez régler plus tard depuis "Mes commandes".', 'تم إلغاء الدفع — تم تسجيل الطلب لكنه غير مدفوع. يمكنك الدفع لاحقًا من "طلباتي".') }); setTimeout(() => { if (onOrderPlaced) onOrderPlaced(); }, 1800); }}
              disabled={cardSubmitting}
              className="w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              {tr('Annuler et payer plus tard', 'إلغاء والدفع لاحقًا')}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck size={12} /> {tr('Paiement sandbox — aucune donnée réelle transmise.', 'دفع تجريبي — لا يتم إرسال بيانات حقيقية.')}
            </p>
          </form>
        )}
      </Modal>

      {/* Instructions de virement bancaire — la commande est déjà créée,
          "en attente de validation" jusqu'à confirmation admin du virement. */}
      <Modal open={!!virementResult} onClose={() => {}} maxWidth="max-w-sm">
        {virementResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5F3FF] text-[#7C3AED]">
                <Landmark size={20} />
              </span>
              <div>
                <h2 className="text-base font-black text-slate-900">{tr('Virement bancaire', 'تحويل بنكي')}</h2>
                <p className="text-xs text-slate-400">{tr('Commande enregistrée — en attente de validation', 'تم تسجيل الطلب — في انتظار التحقق')}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tr('Titulaire', 'صاحب الحساب')}</span>
                <span className="font-bold text-slate-800">{virementResult.titulaire}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tr('Banque', 'البنك')}</span>
                <span className="font-bold text-slate-800">{virementResult.banque}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">RIB</span>
                <span className="font-mono text-xs font-bold text-slate-800">{virementResult.rib}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500">{tr('Montant à virer', 'المبلغ الواجب تحويله')}</span>
                <span className="font-black text-[#7C3AED]">{virementResult.montant.toFixed(3)} TND</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{tr('Référence à indiquer', 'المرجع الواجب ذكره')}</span>
                <span className="font-bold text-slate-800">{virementResult.reference}</span>
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
              {tr(
                "Indiquez impérativement cette référence lors du virement pour un rapprochement rapide. Votre commande passera au statut \"payée\" dès validation par notre équipe.",
                'يرجى ذكر هذا المرجع عند التحويل لتسريع المطابقة. سينتقل طلبك إلى حالة "مدفوع" فور تحقق فريقنا من العملية.',
              )}
            </p>

            <button
              type="button"
              onClick={() => { setVirementResult(null); setStatus({ type: 'success', message: tr('Commande enregistrée, en attente de validation du virement.', 'تم تسجيل الطلب، في انتظار التحقق من التحويل.') }); setTimeout(() => { if (onOrderPlaced) onOrderPlaced(); }, 1500); }}
              className="btn-primary-premium w-full py-3.5 text-sm"
            >
              {tr("J'ai compris, terminer", 'فهمت، إنهاء')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
