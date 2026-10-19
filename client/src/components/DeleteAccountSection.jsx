import React, { useState } from 'react';
import { TriangleAlert, UserX } from 'lucide-react';
import { API_URL } from '../config/api.js';

/**
 * « Supprimer mon compte » (même règles que l'app mobile) : données
 * personnelles effacées, commandes conservées anonymisées. Confirmation par
 * mot de passe, ou SUPPRIMER pour un compte Google / Facebook.
 */
export default function DeleteAccountSection({ language = 'fr' }) {
  const tr = (fr, ar) => (language === 'ar' ? ar : fr);
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!window.confirm(tr('Supprimer définitivement votre compte ? Cette action est irréversible.', 'حذف حسابك نهائيًا؟ هذا الإجراء لا رجعة فيه.'))) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ password: secret, confirmation: secret.trim().toUpperCase() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || tr('Suppression impossible.', 'تعذر الحذف.'));
      ['token', 'userId', 'userRole', 'adminToken'].forEach((key) => localStorage.removeItem(key));
      window.location.assign('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-6 flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-700"
      >
        <UserX size={14} aria-hidden="true" /> {tr('Supprimer mon compte', 'حذف حسابي')}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <p className="flex items-center gap-2 text-sm font-black text-rose-700">
        <TriangleAlert size={16} aria-hidden="true" /> {tr('Supprimer mon compte', 'حذف حسابي')}
      </p>
      <ul className="list-disc space-y-1 ps-5 text-xs text-slate-700">
        <li>{tr('Vos données personnelles sont effacées : nom, email, téléphone, adresse, favoris, notifications.', 'تُمسح بياناتك الشخصية: الاسم، البريد، الهاتف، العنوان، المفضلة، الإشعارات.')}</li>
        <li>{tr('Vos commandes et factures sont conservées de façon anonyme (obligations comptables).', 'تُحفظ طلباتك وفواتيرك بشكل مجهول (التزامات محاسبية).')}</li>
        <li>{tr("Impossible tant qu'une commande ou un retour est en cours, ou qu'il reste un solde.", 'غير ممكن ما دام هناك طلب أو إرجاع جارٍ، أو رصيد متبقٍ.')}</li>
      </ul>
      <input
        type="password"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        aria-label={tr('Mot de passe', 'كلمة المرور')}
        placeholder={tr('Mot de passe (ou SUPPRIMER pour un compte Google / Facebook)', 'كلمة المرور (أو SUPPRIMER لحساب Google / Facebook)')}
        autoComplete="current-password"
        className="input-premium w-full px-3.5 py-2.5 text-sm"
      />
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => { setOpen(false); setSecret(''); setError(''); }} className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700">
          {tr('Annuler', 'إلغاء')}
        </button>
        <button type="submit" disabled={!secret.trim() || loading} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {loading ? tr('Suppression…', 'جارٍ الحذف…') : tr('Supprimer définitivement', 'حذف نهائي')}
        </button>
      </div>
    </form>
  );
}
