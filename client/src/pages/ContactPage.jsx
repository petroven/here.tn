import React, { useState } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, MessageCircle, Copy, Check } from 'lucide-react';
import { CONTACT } from '../config/contact.js';

// Ligne de coordonnée : le texte reste sélectionnable et un bouton le copie,
// car les liens mailto:/tel: ne s'ouvrent pas partout (aperçu statique,
// navigateur sans client mail).
function ContactLine({ icon: Icon, label, value, href, copyLabel, copiedLabel }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers refusé : la valeur reste sélectionnable à la main.
    }
  };
  return (
    <div className="flex items-center gap-4 border-t border-slate-100 py-4 first:border-t-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8E4DE] text-[#C4532C]"><Icon size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        {href
          ? <a href={href} className="break-words text-sm font-bold text-slate-900 hover:text-[#C4532C]">{value}</a>
          : <p className="break-words text-sm font-bold text-slate-900">{value}</p>}
      </div>
      <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}

export default function ContactPage({ language = 'fr', onBack, onOpenHelp }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const [form, setForm] = useState({ name: '', subject: '', message: '' });
  const address = CONTACT.address?.[language] || CONTACT.address?.fr;

  const whatsappText = [
    form.name && `${tr('Nom', 'الاسم')} : ${form.name}`,
    form.subject && `${tr('Sujet', 'الموضوع')} : ${form.subject}`,
    form.message,
  ].filter(Boolean).join('\n');
  const whatsappUrl = `https://wa.me/${CONTACT.phoneIntl}?text=${encodeURIComponent(whatsappText)}`;

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#C4532C] focus:ring-2 focus:ring-[#C4532C]/15';

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 font-sans">
      <div className="gradient-brand p-6 text-white shadow-md sm:p-10">
        <div className="mx-auto max-w-4xl">
          <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white">
            <ArrowLeft size={14} className={isAr ? 'rotate-180' : ''} /> {tr('Retour', 'رجوع')}
          </button>
          <h1 className="text-2xl font-black sm:text-3xl">{tr('Contactez-nous', 'تواصل معنا')}</h1>
          <p className="mt-2 text-sm text-white/85">
            {tr('Une question sur une commande, une boutique ou un vendeur ? Écrivez-nous.', 'سؤال حول طلب أو متجر أو بائع؟ راسلنا.')}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="card-premium h-fit p-5 sm:p-6">
          <h2 className="mb-2 text-base font-extrabold text-slate-900">{tr('Nos coordonnées', 'معلومات الاتصال')}</h2>
          <ContactLine icon={Mail} label={tr('Email', 'البريد الإلكتروني')} value={CONTACT.email} href={`mailto:${CONTACT.email}`} copyLabel={tr('Copier', 'نسخ')} copiedLabel={tr('Copié', 'تم النسخ')} />
          <ContactLine icon={Phone} label={tr('Téléphone', 'الهاتف')} value={CONTACT.phoneDisplay} href={`tel:+${CONTACT.phoneIntl}`} copyLabel={tr('Copier', 'نسخ')} copiedLabel={tr('Copié', 'تم النسخ')} />
          {address && <ContactLine icon={MapPin} label={tr('Adresse', 'العنوان')} value={address} copyLabel={tr('Copier', 'نسخ')} copiedLabel={tr('Copié', 'تم النسخ')} />}
          <button onClick={onOpenHelp} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
            {tr("Voir les questions fréquentes", 'الأسئلة الشائعة')}
          </button>
        </section>

        <section className="card-premium p-5 sm:p-6">
          <h2 className="text-base font-extrabold text-slate-900">{tr('Envoyer un message', 'أرسل رسالة')}</h2>
          <p className="mt-1 text-xs text-slate-500">{tr('Votre message s’ouvre dans WhatsApp, prêt à être envoyé.', 'تُفتح رسالتك في واتساب جاهزة للإرسال.')}</p>
          <form className="mt-4 space-y-3" onSubmit={(event) => event.preventDefault()}>
            <div>
              <label htmlFor="contact-name" className="mb-1 block text-xs font-bold text-slate-600">{tr('Votre nom', 'اسمك')}</label>
              <input id="contact-name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="contact-subject" className="mb-1 block text-xs font-bold text-slate-600">{tr('Sujet', 'الموضوع')}</label>
              <input id="contact-subject" className={field} placeholder={tr('Ex. : suivi de ma commande', 'مثال: تتبع طلبي')} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div>
              <label htmlFor="contact-message" className="mb-1 block text-xs font-bold text-slate-600">{tr('Message', 'الرسالة')}</label>
              <textarea id="contact-message" rows={5} className={field} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
            <a
              href={form.message.trim() ? whatsappUrl : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!form.message.trim()}
              className={`btn-primary-premium flex w-full items-center justify-center gap-2 px-5 py-3 text-sm ${form.message.trim() ? '' : 'pointer-events-none opacity-50'}`}
            >
              <MessageCircle size={16} /> {tr('Écrire sur WhatsApp', 'راسلنا على واتساب')}
            </a>
          </form>
        </section>
      </div>
    </div>
  );
}
