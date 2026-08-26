import React, { useState, useEffect } from 'react';
import { Store, ArrowLeft, CheckCircle, AlertCircle, Check, Languages } from 'lucide-react';
import { useTranslation } from '../i18n';
import { API_URL } from '../config/api.js';
import PolicyConsentModal from '../components/PolicyConsentModal';

export function VendorRegistration({ onClose, onSuccess, onOpenTerms }) {
  const [language, setLanguage] = useState('fr');
  const { t } = useTranslation(language);
  const [step, setStep] = useState(1); // 1: account setup, 2: store setup
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [gouvernorats, setGouvernorats] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const [accountData, setAccountData] = useState({ nom: '', prenom: '', email: '', password: '', confirmPassword: '' });
  const [storeData, setStoreData] = useState({ nom: '', description: '', logo: '', iban: '', modePaiement: 'iban', flouciNumero: '', gouvernoratId: '', delegationId: '', adresse: '' });
  const [showPolicyConsent, setShowPolicyConsent] = useState(false);

  useEffect(() => { fetchGouvernorats(); }, []);

  useEffect(() => {
    if (storeData.gouvernoratId) fetchDelegations(storeData.gouvernoratId);
    else setDelegations([]);
  }, [storeData.gouvernoratId]);

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

  const handleAccountChange = (e) => { setAccountData({ ...accountData, [e.target.name]: e.target.value }); setError(''); };
  const handleStoreChange = (e) => { setStoreData({ ...storeData, [e.target.name]: e.target.value }); setError(''); };

  const validateStep1 = () => {
    if (!accountData.nom || !accountData.prenom || !accountData.email || !accountData.password) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return false;
    }
    if (accountData.password !== accountData.confirmPassword) { setError(t('passwordsDontMatch')); return false; }
    if (accountData.password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!storeData.nom || !storeData.gouvernoratId || !storeData.delegationId || !storeData.adresse) {
      setError('Veuillez renseigner toutes les informations de la boutique et de localisation.');
      return false;
    }
    if (storeData.modePaiement === 'iban' && !storeData.iban) {
      setError('Veuillez renseigner votre IBAN.');
      return false;
    }
    if (storeData.modePaiement === 'flouci' && !storeData.flouciNumero) {
      setError('Veuillez renseigner votre numéro Flouci.');
      return false;
    }
    return true;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    // Les conditions ne sont plus une simple case à cocher : elles doivent
    // être explicitement acceptées via l'alerte dédiée avant toute création
    // de compte — refuser bloque totalement l'inscription.
    setShowPolicyConsent(true);
  };

  const performRegistration = async () => {
    setLoading(true);
    setError('');
    try {
      const registerResponse = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...accountData, role: 'vendeur', accepteConditions: true }),
      });
      const registerData = await registerResponse.json();
      if (!registerData.success) { setError(registerData.message || t('error')); setLoading(false); return; }

      const userId = registerData.user.id;
      localStorage.setItem('token', registerData.token);
      localStorage.setItem('userId', userId);
      localStorage.setItem('userRole', 'vendeur');

      const storeResponse = await fetch(`${API_URL}/vendor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${registerData.token}` },
        body: JSON.stringify({ vendeurId: userId, ...storeData, accepteConditionsRetour: true }),
      });
      const storeDataRes = await storeResponse.json();
      if (!storeDataRes.success) { setError(storeDataRes.message || t('error')); setLoading(false); return; }

      setSuccess('Boutique créée avec succès et en attente de validation admin!');
      setTimeout(() => onSuccess?.(registerData.user), 2000);
    } catch (err) {
      setError(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  const isAr = language === 'ar';
  const inputClass = 'input-premium w-full p-3 text-sm outline-none';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="gradient-brand p-6 text-white shadow-md">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl glass"><Store size={22} /></span>
            <h1 className="text-2xl font-black sm:text-3xl">{t('becomeVendor')}</h1>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}
              className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25"
            >
              <Languages size={14} /> {language === 'fr' ? 'عربي' : 'Français'}
            </button>
            <button onClick={onClose} className="rounded-xl p-2 text-white/90 transition hover:bg-white/15">
              <ArrowLeft size={20} className={isAr ? 'rotate-180' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto my-8 max-w-3xl p-4 sm:p-6">
        <div className="card-premium p-6 sm:p-8">
          {/* Step indicator */}
          <div className="mb-8 flex items-center justify-center">
            {[{ n: 1, label: 'Compte' }, { n: 2, label: 'Boutique' }].map((s, i, arr) => (
              <React.Fragment key={s.n}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-black transition-all duration-300 ${
                    step > s.n ? 'bg-emerald-500 text-white' : step === s.n ? 'gradient-brand text-white shadow-md' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {step > s.n ? <Check size={18} /> : s.n}
                  </div>
                  <p className={`text-xs font-bold ${step >= s.n ? 'text-[#7C3AED]' : 'text-slate-400'}`}>{s.label}</p>
                </div>
                {i < arr.length - 1 && <div className={`mx-3 h-0.5 w-16 sm:w-28 ${step > s.n ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {success && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle className="flex-shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">{success}</p>
                <p className="mt-1 text-sm text-emerald-800">Redirection en cours...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <AlertCircle className="flex-shrink-0 text-rose-600" />
              <div>
                <p className="font-semibold text-rose-900">Erreur d'inscription</p>
                <p className="mt-1 text-sm text-rose-800">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="mb-1 text-lg font-bold text-slate-800">Créer votre compte vendeur</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input type="text" name="prenom" placeholder={t('firstName')} value={accountData.prenom} onChange={handleAccountChange} className={inputClass} required />
                  <input type="text" name="nom" placeholder={t('lastName')} value={accountData.nom} onChange={handleAccountChange} className={inputClass} required />
                </div>
                <input type="email" name="email" placeholder={t('email')} value={accountData.email} onChange={handleAccountChange} className={inputClass} required />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input type="password" name="password" placeholder={t('password')} value={accountData.password} onChange={handleAccountChange} className={inputClass} required />
                  <input type="password" name="confirmPassword" placeholder={t('repeatPassword')} value={accountData.confirmPassword} onChange={handleAccountChange} className={inputClass} required />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="mb-1 text-lg font-bold text-slate-800">Informations de votre boutique</h2>
                <input type="text" name="nom" placeholder={t('storeName')} value={storeData.nom} onChange={handleStoreChange} className={inputClass} required />
                <textarea name="description" placeholder={t('storeDescription')} value={storeData.description} onChange={handleStoreChange} className={inputClass} rows="3" />
                <input type="text" name="logo" placeholder="URL du logo" value={storeData.logo} onChange={handleStoreChange} className={inputClass} />

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Comment souhaitez-vous recevoir vos paiements ?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStoreData({ ...storeData, modePaiement: 'iban' })}
                      className={`rounded-2xl border p-3.5 text-left transition-all duration-200 ${storeData.modePaiement === 'iban' ? 'border-[#7C3AED] bg-[#F5F3FF] shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <span className={`block text-sm font-bold ${storeData.modePaiement === 'iban' ? 'text-[#7C3AED]' : 'text-slate-800'}`}>Virement bancaire</span>
                      <span className="text-xs text-slate-400">IBAN tunisien</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStoreData({ ...storeData, modePaiement: 'flouci' })}
                      className={`rounded-2xl border p-3.5 text-left transition-all duration-200 ${storeData.modePaiement === 'flouci' ? 'border-[#7C3AED] bg-[#F5F3FF] shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <span className={`block text-sm font-bold ${storeData.modePaiement === 'flouci' ? 'text-[#7C3AED]' : 'text-slate-800'}`}>Flouci</span>
                      <span className="text-xs text-slate-400">Portefeuille mobile</span>
                    </button>
                  </div>
                </div>

                {storeData.modePaiement === 'iban' ? (
                  <input type="text" name="iban" placeholder={t('ibanNumber')} value={storeData.iban} onChange={handleStoreChange} className={inputClass} required />
                ) : (
                  <input type="text" name="flouciNumero" placeholder="Numéro de téléphone Flouci" value={storeData.flouciNumero} onChange={handleStoreChange} className={inputClass} required />
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select name="gouvernoratId" value={storeData.gouvernoratId} onChange={handleStoreChange} className={inputClass} required>
                    <option value="">Sélectionner Gouvernorat</option>
                    {gouvernorats.map((gov) => <option key={gov.id} value={gov.id}>{gov.nom}</option>)}
                  </select>
                  <select name="delegationId" value={storeData.delegationId} onChange={handleStoreChange} className={`${inputClass} disabled:opacity-50`} disabled={!storeData.gouvernoratId || loadingGeo} required>
                    <option value="">{loadingGeo ? 'Chargement...' : 'Sélectionner Délégation'}</option>
                    {delegations.map((del) => <option key={del.id} value={del.id}>{del.nom}</option>)}
                  </select>
                </div>

                <input type="text" name="adresse" placeholder="Adresse de la boutique (Rue, Local...)" value={storeData.adresse} onChange={handleStoreChange} className={inputClass} required />

                <div className="rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
                  <p className="text-sm text-[#5B21B6]">
                    <strong>Note :</strong> {storeData.modePaiement === 'flouci'
                      ? 'Vos virements seront versés sur votre compte Flouci.'
                      : 'Vous devez avoir un compte bancaire tunisien pour recevoir les virements.'} Une commission de 5% sera appliquée à chaque vente. Un email récapitulant les règles de la plateforme vous sera envoyé après l'inscription.
                  </p>
                  {onOpenTerms && (
                    <button type="button" onClick={onOpenTerms} className="mt-2 text-xs font-bold text-[#6D28D9] underline hover:text-[#5B21B6]">
                      Consulter les conditions vendeur complètes
                    </button>
                  )}
                  <p className="mt-2 text-xs text-[#5B21B6]">
                    En cliquant sur « {t('createStore')} », les conditions de vente et de retour vous seront présentées pour acceptation.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {step === 2 && (
                <button type="button" onClick={() => setStep(1)} className="btn-secondary-premium flex-1 py-3 text-sm" disabled={loading}>
                  Précédent
                </button>
              )}
              {step === 1 ? (
                <button type="button" onClick={handleNext} className="btn-primary-premium flex-1 py-3 text-sm" disabled={loading}>
                  Continuer
                </button>
              ) : (
                <button type="submit" className="btn-primary-premium flex-1 py-3 text-sm disabled:opacity-50" disabled={loading}>
                  {loading ? t('loading') : t('createStore')}
                </button>
              )}
            </div>
          </form>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-900">
              <strong>Avantages vendeur :</strong> Gestion complète de votre boutique, suivi des commandes en temps réel, tableau de bord analytique, retraits automatiques et support dédié.
            </p>
          </div>
        </div>
      </div>

      <PolicyConsentModal
        open={showPolicyConsent}
        language={language}
        onAccept={() => { setShowPolicyConsent(false); performRegistration(); }}
        onRefuse={() => { setShowPolicyConsent(false); setError("Vous devez accepter les conditions de vente et de retour pour créer votre boutique."); }}
      />
    </div>
  );
}

export default VendorRegistration;
