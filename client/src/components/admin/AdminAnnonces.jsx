import { useEffect, useState } from 'react';
import { BellRing, Send, Smartphone, Users } from 'lucide-react';
import { API_URL } from '../../config/api.js';

// « 1 client », « 3 clients ».
const pluriel = (n, un, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;

const TITRE_MAX = 65;
const MESSAGE_MAX = 240;

// Pages qu'une annonce peut ouvrir — mêmes chemins courts que l'app mobile
// (navigation/linking.ts) et la cloche du site.
const LIENS = [
  { value: '', fr: 'Aucun (ouvre seulement l’app)', ar: 'بدون رابط' },
  { value: 'coupons', fr: 'Codes promo', ar: 'رموز التخفيض' },
  { value: 'boutiques', fr: 'Liste des boutiques', ar: 'قائمة المتاجر' },
  { value: 'produit', fr: 'Un produit précis', ar: 'منتج محدد', avecId: true },
  { value: 'boutique', fr: 'Une boutique précise', ar: 'متجر محدد', avecId: true },
];

/**
 * Annonce à tous les clients : notification push sur leurs téléphones (app
 * BuyHere) et notification dans la cloche du site. GET /admin/annonces/audience
 * donne le nombre de destinataires, POST /admin/annonces envoie.
 */
export default function AdminAnnonces({ token, language = 'fr' }) {
  const tr = (fr, ar) => (language === 'ar' ? ar : fr);
  const [audience, setAudience] = useState(null);
  const [audienceErreur, setAudienceErreur] = useState(null);
  const [titre, setTitre] = useState('');
  const [message, setMessage] = useState('');
  const [typeLien, setTypeLien] = useState('');
  const [idLien, setIdLien] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState(null);

  const chargerAudience = () => {
    setAudienceErreur(null);
    fetch(`${API_URL}/admin/annonces/audience`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAudience(data.data);
        else setAudienceErreur(data.message || tr('Audience indisponible.', 'تعذر تحميل الجمهور.'));
      })
      .catch(() => setAudienceErreur(tr('Audience indisponible.', 'تعذر تحميل الجمهور.')));
  };

  useEffect(() => { chargerAudience(); }, []);

  const lienChoisi = LIENS.find((l) => l.value === typeLien);
  const lien = lienChoisi?.avecId ? (/^\d+$/.test(idLien) ? `${typeLien}/${idLien}` : null) : typeLien || null;
  const lienIncomplet = Boolean(lienChoisi?.avecId) && !lien;
  const pret = titre.trim() && message.trim() && !lienIncomplet;

  const envoyer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const response = await fetch(`${API_URL}/admin/annonces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ titre: titre.trim(), message: message.trim(), lien }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || tr('L’envoi a échoué.', 'فشل الإرسال.'));
      setResultat(data.data);
      setTitre('');
      setMessage('');
      setTypeLien('');
      setIdLien('');
      chargerAudience();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
      setConfirmation(false);
    }
  };

  const champ = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#C4532C] focus:ring-2 focus:ring-[#C4532C]/15';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-slate-900">{tr('Annonce à tous les clients', 'إعلان لكل العملاء')}</h2>
        <p className="text-sm text-slate-500">
          {tr(
            'Le message part en notification push sur le téléphone des clients qui ont l’app BuyHere, et s’affiche dans la cloche du site pour tous les clients.',
            'تُرسل الرسالة كإشعار على هواتف العملاء الذين لديهم تطبيق BuyHere، وتظهر في جرس الموقع لكل العملاء.',
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8E4DE] text-[#C4532C]"><Users size={18} /></span>
          <div>
            <p className="text-xl font-black text-slate-900">{audience ? audience.clients : '…'}</p>
            <p className="text-xs text-slate-500">{tr('clients recevront l’annonce dans la cloche', 'عميل سيتلقى الإعلان في الجرس')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8E4DE] text-[#C4532C]"><Smartphone size={18} /></span>
          <div>
            <p className="text-xl font-black text-slate-900">{audience ? audience.appareils : '…'}</p>
            <p className="text-xs text-slate-500">{tr('téléphones recevront la notification push', 'هاتف سيتلقى الإشعار')}</p>
          </div>
        </div>
      </div>
      {audienceErreur && <p className="text-sm font-semibold text-rose-600">{audienceErreur}</p>}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5" onSubmit={(e) => { e.preventDefault(); if (pret) setConfirmation(true); }}>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor="annonce-titre" className="text-xs font-bold text-slate-600">{tr('Titre', 'العنوان')}</label>
              <span className={`text-[11px] ${titre.length > TITRE_MAX ? 'text-rose-600' : 'text-slate-400'}`}>{titre.length}/{TITRE_MAX}</span>
            </div>
            <input id="annonce-titre" className={champ} maxLength={TITRE_MAX} value={titre} onChange={(e) => { setTitre(e.target.value); setResultat(null); }} placeholder={tr('Ex. : Soldes d’automne', 'مثال: تخفيضات الخريف')} />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <label htmlFor="annonce-message" className="text-xs font-bold text-slate-600">{tr('Message', 'الرسالة')}</label>
              <span className={`text-[11px] ${message.length > MESSAGE_MAX ? 'text-rose-600' : 'text-slate-400'}`}>{message.length}/{MESSAGE_MAX}</span>
            </div>
            <textarea id="annonce-message" rows={4} className={champ} maxLength={MESSAGE_MAX} value={message} onChange={(e) => { setMessage(e.target.value); setResultat(null); }} placeholder={tr('Ex. : Jusqu’à -30 % ce week-end dans toutes les boutiques.', 'مثال: تخفيضات حتى 30% هذا الأسبوع.')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="annonce-lien" className="mb-1 block text-xs font-bold text-slate-600">{tr('Page ouverte au toucher', 'الصفحة عند الضغط')}</label>
              <select id="annonce-lien" className={champ} value={typeLien} onChange={(e) => { setTypeLien(e.target.value); setIdLien(''); }}>
                {LIENS.map((l) => <option key={l.value} value={l.value}>{tr(l.fr, l.ar)}</option>)}
              </select>
            </div>
            {lienChoisi?.avecId && (
              <div>
                <label htmlFor="annonce-lien-id" className="mb-1 block text-xs font-bold text-slate-600">{tr('Numéro (ID)', 'الرقم')}</label>
                <input id="annonce-lien-id" inputMode="numeric" className={`${champ} sm:w-28`} value={idLien} onChange={(e) => setIdLien(e.target.value.replace(/\D/g, ''))} placeholder="12" />
              </div>
            )}
          </div>

          {erreur && <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-700">{erreur}</p>}
          {resultat && (
            <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-700">
              {tr(
                `Annonce envoyée à ${pluriel(resultat.clients, 'client')}. ${pluriel(resultat.envoyes, 'notification push acceptée', 'notifications push acceptées')} sur ${pluriel(resultat.appareils, 'téléphone')}.`,
                `تم إرسال الإعلان إلى ${resultat.clients} عميل. ${resultat.envoyes} إشعار مقبول من ${resultat.appareils} هاتف.`,
              )}
            </p>
          )}

          {confirmation ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">
                {tr(
                  `Envoyer à ${audience?.clients ?? 'tous les'} clients ? Une notification envoyée ne peut pas être retirée.`,
                  `إرسال إلى ${audience?.clients ?? 'كل'} العملاء؟ لا يمكن سحب الإشعار بعد إرساله.`,
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={envoyer} disabled={envoi} className="btn-primary-premium flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60">
                  <Send size={15} /> {envoi ? tr('Envoi…', 'جارٍ الإرسال…') : tr('Oui, envoyer', 'نعم، أرسل')}
                </button>
                <button type="button" onClick={() => setConfirmation(false)} disabled={envoi} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {tr('Annuler', 'إلغاء')}
                </button>
              </div>
            </div>
          ) : (
            <button type="submit" disabled={!pret} className="btn-primary-premium flex items-center gap-2 px-5 py-3 text-sm disabled:opacity-50">
              <Send size={15} /> {tr('Envoyer à tous les clients', 'أرسل لكل العملاء')}
            </button>
          )}
        </form>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{tr('Aperçu sur le téléphone', 'معاينة على الهاتف')}</p>
          <div className="rounded-3xl bg-[#1E1B18] p-4">
            <div className="flex gap-3 rounded-2xl bg-white/95 p-3.5 shadow">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C4532C] text-white"><BellRing size={17} /></span>
              <div className="min-w-0">
                <p className="flex items-baseline justify-between gap-2 text-[11px] text-stone-500"><span className="font-bold">BuyHere</span><span>{tr('maintenant', 'الآن')}</span></p>
                <p className="truncate text-sm font-bold text-stone-900">{titre.trim() || tr('Titre de l’annonce', 'عنوان الإعلان')}</p>
                <p className="line-clamp-3 text-xs text-stone-600">{message.trim() || tr('Votre message apparaîtra ici.', 'ستظهر رسالتك هنا.')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
