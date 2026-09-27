import React from 'react';
import { ArrowLeft, Store, Truck, ShieldCheck, Languages } from 'lucide-react';

const PILLARS = [
  {
    icon: Store,
    title: { fr: 'Des boutiques tunisiennes', ar: 'متاجر تونسية' },
    text: {
      fr: "Chaque boutique est indépendante et validée par notre équipe avant d'apparaître dans le catalogue.",
      ar: 'كل متجر مستقل ويتم اعتماده من طرف فريقنا قبل ظهوره في الكتالوج.',
    },
  },
  {
    icon: Truck,
    title: { fr: 'Livraison dans les 24 gouvernorats', ar: 'توصيل إلى الولايات الـ24' },
    text: {
      fr: 'Les frais sont calculés selon votre gouvernorat et chaque colis reçoit un numéro de suivi.',
      ar: 'تُحتسب المصاريف حسب ولايتك ويحصل كل طرد على رقم تتبع.',
    },
  },
  {
    icon: ShieldCheck,
    title: { fr: 'Paiement au choix', ar: 'طرق دفع متعددة' },
    text: {
      fr: 'Paiement à la livraison, ou en ligne avec Konnect et Flouci.',
      ar: 'الدفع عند الاستلام، أو عبر الإنترنت بواسطة Konnect و Flouci.',
    },
  },
  {
    icon: Languages,
    title: { fr: 'En français et en arabe', ar: 'بالعربية والفرنسية' },
    text: {
      fr: 'Tout le site, les factures et le support sont disponibles dans les deux langues.',
      ar: 'الموقع والفواتير والدعم متوفرة باللغتين.',
    },
  },
];

export default function AboutPage({ language = 'fr', onBack, onOpenCatalog, onBecomeVendor }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 font-sans">
      <div className="gradient-brand p-6 text-white shadow-md sm:p-10">
        <div className="mx-auto max-w-4xl">
          <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white">
            <ArrowLeft size={14} className={isAr ? 'rotate-180' : ''} /> {tr('Retour', 'رجوع')}
          </button>
          <h1 className="text-2xl font-black sm:text-3xl">{tr('À propos de BuyHere', 'حول BuyHere')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
            {tr(
              'BuyHere réunit des boutiques tunisiennes sur une seule marketplace : un seul compte, un seul panier, plusieurs boutiques.',
              'تجمع BuyHere المتاجر التونسية في سوق واحدة: حساب واحد، سلة واحدة، ومتاجر متعددة.',
            )}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <section className="card-premium p-6 sm:p-8">
          <h2 className="text-lg font-extrabold text-slate-900">{tr('Notre mission', 'مهمتنا')}</h2>
          <p className="mt-3 max-w-prose text-sm leading-7 text-slate-600">
            {tr(
              "Aider les artisans, commerçants et marques de toute la Tunisie à vendre en ligne sans avoir à construire leur propre site, et offrir aux clients un endroit fiable pour acheter local, de Bizerte à Tataouine.",
              'مساعدة الحرفيين والتجار والعلامات في كامل تونس على البيع عبر الإنترنت دون الحاجة إلى إنشاء موقع خاص بهم، وتوفير مكان موثوق للعملاء للشراء محليًا، من بنزرت إلى تطاوين.',
            )}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div key={pillar.title.fr} className="card-premium flex gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F8E4DE] text-[#C4532C]"><Icon size={18} /></span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">{pillar.title[language] || pillar.title.fr}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{pillar.text[language] || pillar.text.fr}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="card-premium flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{tr('Vous avez une boutique ?', 'لديك متجر؟')}</h2>
            <p className="mt-1 text-xs text-slate-500">{tr('Ouvrez votre boutique : BuyHere prélève une commission de 15 % sur chaque vente.', 'افتح متجرك: تقتطع BuyHere عمولة 15% على كل عملية بيع.')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onOpenCatalog} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
              {tr('Voir le catalogue', 'تصفح الكتالوج')}
            </button>
            <button onClick={onBecomeVendor} className="btn-primary-premium px-4 py-2.5 text-xs">
              {tr('Devenir vendeur', 'كن بائعًا')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
