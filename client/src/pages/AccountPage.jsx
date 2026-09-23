import React, { useEffect, useState } from 'react';
import {
  User, Phone, MapPin, Lock, ShoppingBag, Heart, Tag, Truck, Wallet,
  Pencil, Check, X, ShieldCheck, ChevronRight,
} from 'lucide-react';
import Input from '../components/ui/Input';
import { API_URL } from '../config/api.js';

// Hub "Mon compte" (/compte) — profil éditable + accès rapide aux espaces déjà
// existants (commandes/retours, favoris, coupons, suivi). Volontairement ne
// duplique pas ces pages : elles restent leurs propres routes dédiées, ce hub
// ne fait qu'ajouter ce qui manquait vraiment — la gestion du profil lui-même.
export default function AccountPage({ language = 'fr', navigate }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const token = localStorage.getItem('token');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '', adresse: '', gouvernoratId: '', delegationId: '' });
  const [gouvernorats, setGouvernorats] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState({ type: '', message: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchProfile();
    fetch(`${API_URL}/gouvernorats`).then((r) => r.json()).then((d) => d.success && setGouvernorats(d.data)).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!form.gouvernoratId) { setDelegations([]); return; }
    fetch(`${API_URL}/gouvernorats/${form.gouvernoratId}/delegations`)
      .then((r) => r.json())
      .then((d) => d.success && setDelegations(d.data))
      .catch(() => {});
  }, [form.gouvernoratId]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
        setForm({
          nom: data.data.nom || '',
          prenom: data.data.prenom || '',
          telephone: data.data.telephone || '',
          adresse: data.data.adresse || '',
          gouvernoratId: data.data.gouvernoratId || '',
          delegationId: data.data.delegationId || '',
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value, ...(field === 'gouvernoratId' ? { delegationId: '' } : {}) });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileStatus({ type: '', message: '' });
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone,
          adresse: form.adresse,
          gouvernoratId: form.gouvernoratId ? Number(form.gouvernoratId) : null,
          delegationId: form.delegationId ? Number(form.delegationId) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || tr('Erreur lors de la mise à jour.', 'خطأ أثناء التحديث.'));
      setProfile(data.data);
      setEditing(false);
      setProfileStatus({ type: 'success', message: tr('Profil mis à jour avec succès.', 'تم تحديث الملف الشخصي بنجاح.') });
    } catch (err) {
      setProfileStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordStatus({ type: '', message: '' });
    if (passwordForm.newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: tr('Le nouveau mot de passe doit contenir au moins 6 caractères.', 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.') });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: 'error', message: tr('Les mots de passe ne correspondent pas.', 'كلمتا المرور غير متطابقتين.') });
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch(`${API_URL}/users/me/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || tr('Erreur lors du changement de mot de passe.', 'خطأ أثناء تغيير كلمة المرور.'));
      setPasswordStatus({ type: 'success', message: tr('Mot de passe modifié avec succès.', 'تم تغيير كلمة المرور بنجاح.') });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setShowPasswordForm(false), 1500);
    } catch (err) {
      setPasswordStatus({ type: 'error', message: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  const quickLinks = [
    { key: 'commandes', label: tr('Mes commandes & retours', 'طلباتي والمرتجعات'), icon: ShoppingBag, path: '/commandes' },
    { key: 'favoris', label: tr('Mes favoris', 'المفضلة'), icon: Heart, path: '/favoris' },
    { key: 'coupons', label: tr('Mes coupons', 'كوبوناتي'), icon: Tag, path: '/coupons' },
    { key: 'suivi', label: tr('Suivi de colis', 'تتبع الطرد'), icon: Truck, path: '/suivi' },
  ];

  if (!token) {
    return (
      <div className="mx-auto max-w-3xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-soft">
          <p className="text-slate-500">{tr('Connectez-vous pour accéder à votre compte.', 'يرجى تسجيل الدخول للوصول إلى حسابك.')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-lg bg-slate-100" />
          <div className="h-48 rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8E4DE] text-[#C4532C]">
          <User size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{tr('Mon compte', 'حسابي')}</h1>
          <p className="text-sm text-slate-500">{tr('Gérez vos informations personnelles', 'أدر معلوماتك الشخصية')}</p>
        </div>
      </div>

      {/* Résumé + portefeuille */}
      <div className="mb-5 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div>
          <p className="text-lg font-black text-slate-900">{profile.prenom} {profile.nom}</p>
          <p className="text-sm text-slate-500">{profile.email}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-amber-700">
          <Wallet size={16} />
          <span className="text-sm font-bold">{Number(profile.soldeWallet || 0).toFixed(3)} TND</span>
        </div>
      </div>

      {/* Profil */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">{tr('Informations personnelles', 'المعلومات الشخصية')}</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-bold text-[#C4532C] hover:text-[#994122]">
              <Pencil size={14} /> {tr('Modifier', 'تعديل')}
            </button>
          )}
        </div>

        {profileStatus.message && (
          <div className={`mb-4 rounded-xl p-3 text-xs font-semibold ${profileStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {profileStatus.message}
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input icon={User} placeholder={tr('Prénom', 'الاسم')} value={form.prenom} onChange={updateField('prenom')} required />
              <Input icon={User} placeholder={tr('Nom', 'اللقب')} value={form.nom} onChange={updateField('nom')} required />
            </div>
            <Input icon={Phone} placeholder={tr('Téléphone (ex: 20123456)', 'الهاتف')} value={form.telephone} onChange={updateField('telephone')} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select value={form.gouvernoratId} onChange={updateField('gouvernoratId')} className="input-premium p-3 text-sm outline-none">
                <option value="">{tr('Gouvernorat', 'الولاية')}</option>
                {gouvernorats.map((g) => <option key={g.id} value={g.id}>{isAr ? g.nomAr : g.nom}</option>)}
              </select>
              <select value={form.delegationId} onChange={updateField('delegationId')} className="input-premium p-3 text-sm outline-none disabled:opacity-50" disabled={!form.gouvernoratId}>
                <option value="">{tr('Délégation', 'المعتمدية')}</option>
                {delegations.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </div>
            <Input icon={MapPin} placeholder={tr('Adresse (rue, numéro...)', 'العنوان')} value={form.adresse} onChange={updateField('adresse')} />
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="btn-primary-premium flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold disabled:opacity-60">
                <Check size={14} /> {saving ? tr('Enregistrement...', 'جارٍ الحفظ...') : tr('Enregistrer', 'حفظ')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setForm({
                    nom: profile.nom || '', prenom: profile.prenom || '', telephone: profile.telephone || '',
                    adresse: profile.adresse || '', gouvernoratId: profile.gouvernoratId || '', delegationId: profile.delegationId || '',
                  });
                }}
                className="btn-secondary-premium flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold"
              >
                <X size={14} /> {tr('Annuler', 'إلغاء')}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-400">{tr('Téléphone', 'الهاتف')}</p>
              <p className="font-semibold text-slate-800">{profile.telephone || tr('Non renseigné', 'غير محدد')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">{tr('Gouvernorat', 'الولاية')}</p>
              <p className="font-semibold text-slate-800">{profile.Gouvernorat ? (isAr ? profile.Gouvernorat.nomAr : profile.Gouvernorat.nom) : tr('Non renseigné', 'غير محدد')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">{tr('Délégation', 'المعتمدية')}</p>
              <p className="font-semibold text-slate-800">{profile.Delegation ? profile.Delegation.nom : tr('Non renseigné', 'غير محدد')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400">{tr('Adresse', 'العنوان')}</p>
              <p className="font-semibold text-slate-800">{profile.adresse || tr('Non renseignée', 'غير محدد')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Mot de passe (comptes locaux uniquement) */}
      {(!profile.provider || profile.provider === 'local') && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <Lock size={16} className="text-slate-400" /> {tr('Mot de passe', 'كلمة المرور')}
            </h2>
            {!showPasswordForm && (
              <button onClick={() => setShowPasswordForm(true)} className="text-xs font-bold text-[#C4532C] hover:text-[#994122]">
                {tr('Changer', 'تغيير')}
              </button>
            )}
          </div>

          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
              {passwordStatus.message && (
                <div className={`rounded-xl p-3 text-xs font-semibold ${passwordStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {passwordStatus.message}
                </div>
              )}
              <Input icon={Lock} type="password" placeholder={tr('Mot de passe actuel', 'كلمة المرور الحالية')} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
              <Input icon={Lock} type="password" placeholder={tr('Nouveau mot de passe', 'كلمة المرور الجديدة')} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required />
              <Input icon={Lock} type="password" placeholder={tr('Confirmer le nouveau mot de passe', 'تأكيد كلمة المرور الجديدة')} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required />
              <div className="flex gap-2">
                <button type="submit" disabled={savingPassword} className="btn-primary-premium px-5 py-2.5 text-xs font-bold disabled:opacity-60">
                  {savingPassword ? tr('Enregistrement...', 'جارٍ الحفظ...') : tr('Mettre à jour', 'تحديث')}
                </button>
                <button type="button" onClick={() => { setShowPasswordForm(false); setPasswordStatus({ type: '', message: '' }); }} className="btn-secondary-premium px-5 py-2.5 text-xs font-bold">
                  {tr('Annuler', 'إلغاء')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Accès rapide */}
      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-soft">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <button
              key={link.key}
              onClick={() => navigate(link.path)}
              className="flex w-full items-center justify-between rounded-xl p-3.5 text-left transition hover:bg-[#F8E4DE] rtl:text-right"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F8E4DE] text-[#C4532C]">
                  <Icon size={16} />
                </span>
                <span className="text-sm font-bold text-slate-800">{link.label}</span>
              </span>
              <ChevronRight size={16} className="text-slate-300 rtl:rotate-180" />
            </button>
          );
        })}
      </div>

      {profile.role === 'client' && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck size={13} /> {tr('Vos informations ne sont jamais partagées avec des tiers.', 'معلوماتك لا تُشارك أبدًا مع أطراف ثالثة.')}
        </p>
      )}
    </div>
  );
}
