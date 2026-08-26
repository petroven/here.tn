import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

export default function PolicyConsentModal({ open, onAccept, onRefuse, language = 'fr' }) {
  if (!open) return null;
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 font-sans">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 gradient-brand p-5 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl glass"><ShieldCheck size={22} /></span>
          <div>
            <h2 className="text-base font-black">{tr('Conditions de vente et de retour', 'شروط البيع والإرجاع')}</h2>
            <p className="text-[11px] text-white/80">{tr('À lire avant de créer votre compte', 'يرجى القراءة قبل إنشاء حسابكم')}</p>
          </div>
          <button onClick={onRefuse} aria-label={tr('Fermer', 'إغلاق')} className="ms-auto rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-600">
          <ul className="space-y-3">
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6366F1]" />
              <span>{tr(
                'Fenêtre de retour selon la catégorie du produit (généralement 7 à 14 jours après livraison) — certains produits (alimentaire, cosmétique ouvert, sur-mesure) sont non retournables. Le délai exact est affiché sur chaque fiche produit.',
                'مهلة الإرجاع تعتمد على فئة المنتج (عادة 7 إلى 14 يومًا بعد التسليم) — بعض المنتجات (غذائية، مستحضرات تجميل مفتوحة، مصنوعة حسب الطلب) غير قابلة للإرجاع. يظهر الأجل الدقيق في بطاقة كل منتج.',
              )}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6366F1]" />
              <span>{tr(
                "Le paiement du vendeur reste bloqué par la plateforme jusqu'à la fin de la fenêtre de retour (ou confirmation de réception) — la commande n'est pas contestée.",
                'يبقى دفع البائع محجوزًا من طرف المنصة إلى غاية انتهاء مهلة الإرجاع (أو تأكيد الاستلام) دون أي نزاع على الطلب.',
              )}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6366F1]" />
              <span>{tr(
                'Toute demande de retour nécessite des photos à l\'appui. Le vendeur dispose de 48h pour répondre ; sans réponse ou en cas de désaccord, la plateforme tranche.',
                'يتطلب أي طلب إرجاع صورًا داعمة. لدى البائع 48 ساعة للرد؛ في حال غياب الرد أو الخلاف، تفصل المنصة في الأمر.',
              )}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6366F1]" />
              <span>{tr(
                "Frais de retour : à la charge du vendeur en cas de défaut/non-conformité, à la charge du client en cas de simple changement d'avis.",
                'مصاريف الإرجاع: على عاتق البائع في حالة عيب/عدم مطابقة، وعلى عاتق العميل في حالة تغيير الرأي.',
              )}</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#6366F1]" />
              <span>{tr(
                "Tout retour approuvé est remboursé rapidement en solde here.tn (jamais vers le moyen de paiement d'origine), utilisable immédiatement sur vos prochaines commandes.",
                'كل عملية إرجاع تتم الموافقة عليها تُسترد بسرعة كرصيد here.tn (وليس أبدًا إلى وسيلة الدفع الأصلية)، قابل للاستخدام فورًا في طلباتكم القادمة.',
              )}</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-3 border-t border-slate-100 p-5">
          <button onClick={onRefuse} className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50">
            {tr('Je refuse', 'أرفض')}
          </button>
          <button onClick={onAccept} className="btn-primary-premium flex-1 py-3 text-sm">
            {tr("J'accepte", 'أوافق')}
          </button>
        </div>
      </div>
    </div>
  );
}
