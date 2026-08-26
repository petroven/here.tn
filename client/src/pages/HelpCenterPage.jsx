import React, { useState } from 'react';
import {
  ArrowLeft, Search, ChevronDown, ShoppingBag, Truck, Store, Bike,
  Wallet, ShieldCheck, User, MessageSquare,
} from 'lucide-react';

const CATEGORIES = [
  {
    key: 'achats',
    icon: ShoppingBag,
    title: { fr: 'Acheter sur here.tn', ar: 'الشراء عبر here.tn' },
    items: [
      {
        q: { fr: 'Comment passer une commande ?', ar: 'كيف أقوم بطلب؟' },
        a: {
          fr: "Parcourez le catalogue ou une boutique, ajoutez les produits souhaités à votre panier, puis cliquez sur \"Passer commande\". Renseignez votre adresse de livraison, choisissez un moyen de paiement, et validez. Vous recevrez une confirmation par email et, pour les commandes payées à la livraison, un SMS avec un lien à confirmer sous 48h.",
          ar: 'تصفح الكتالوج أو أحد المتاجر، أضف المنتجات إلى سلتك، ثم اضغط على "تأكيد الطلب". أدخل عنوان التوصيل، اختر طريقة الدفع، ثم أكّد. ستتلقى تأكيدًا عبر البريد الإلكتروني، وللدفع عند الاستلام رسالة نصية تحتوي رابط تأكيد صالح لمدة 48 ساعة.',
        },
      },
      {
        q: { fr: 'Quels moyens de paiement sont acceptés ?', ar: 'ما هي طرق الدفع المتاحة؟' },
        a: {
          fr: "Le paiement à la livraison (espèces), et le paiement en ligne par carte bancaire via Konnect ou Flouci. Vous pouvez aussi utiliser tout ou partie du solde de votre portefeuille pour réduire le montant à payer — les frais de livraison restent toujours à régler séparément.",
          ar: 'الدفع عند الاستلام (نقدًا)، أو الدفع الإلكتروني بالبطاقة البنكية عبر Konnect أو Flouci. يمكنك أيضًا استخدام رصيد محفظتك جزئيًا أو كليًا لتخفيض المبلغ المستحق — تبقى مصاريف التوصيل مستحقة الدفع دائمًا بشكل منفصل.',
        },
      },
      {
        q: { fr: 'Pourquoi mon numéro de téléphone est-il refusé ?', ar: 'لماذا يُرفض رقم هاتفي؟' },
        a: {
          fr: "Le format attendu est 8 chiffres tunisiens sans le 0 initial (ex: 98123456), commençant par un chiffre entre 2 et 9. N'ajoutez pas d'espace, de tiret ni l'indicatif +216.",
          ar: 'الصيغة المطلوبة هي 8 أرقام تونسية بدون الصفر في البداية (مثال: 98123456)، تبدأ برقم بين 2 و9. لا تُضف مسافات أو شرطات أو رمز +216.',
        },
      },
      {
        q: { fr: 'Puis-je suivre ma commande ?', ar: 'هل يمكنني تتبع طلبي؟' },
        a: {
          fr: "Oui, depuis \"Suivi\" dans le menu, entrez votre code de suivi (reçu par email). Vous verrez l'état en temps réel : en préparation, expédié, en cours de livraison, livré. Votre historique complet de commandes est aussi visible dans \"Mes commandes\".",
          ar: 'نعم، من "التتبع" في القائمة، أدخل رمز التتبع (المُرسل بالبريد الإلكتروني). سترى الحالة لحظيًا: قيد التحضير، تم الشحن، قيد التوصيل، تم التسليم. سجل طلباتك الكامل متوفر أيضًا في "طلباتي".',
        },
      },
    ],
  },
  {
    key: 'wallet',
    icon: Wallet,
    title: { fr: 'Portefeuille & Bons d\'achat', ar: 'المحفظة وقسائم الشراء' },
    items: [
      {
        q: { fr: 'Comment fonctionne le cashback ?', ar: 'كيف يعمل الاسترداد النقدي؟' },
        a: {
          fr: "Une partie du montant de chaque commande payée vous est automatiquement créditée sur votre portefeuille une fois le paiement confirmé. Vous pouvez consulter votre solde et l'historique complet des transactions depuis \"Mes commandes\".",
          ar: 'يُضاف تلقائيًا جزء من مبلغ كل طلب مدفوع إلى محفظتك بمجرد تأكيد الدفع. يمكنك الاطلاع على رصيدك وسجل المعاملات الكامل من "طلباتي".',
        },
      },
      {
        q: { fr: "Puis-je payer une commande entièrement avec mon solde ?", ar: 'هل يمكنني دفع طلب بالكامل من رصيدي؟' },
        a: {
          fr: "Le solde peut couvrir jusqu'à 100% du prix des produits, mais jamais les frais de livraison — ils doivent toujours être réglés par un moyen de paiement classique (espèces ou carte). Si votre solde couvre tout le reste, la commande est validée immédiatement.",
          ar: 'يمكن للرصيد تغطية ما يصل إلى 100% من سعر المنتجات، لكن ليس مصاريف التوصيل أبدًا — يجب دائمًا دفعها بوسيلة دفع تقليدية (نقدًا أو بطاقة). إذا غطّى رصيدك كل الباقي، يُؤكَّد الطلب فورًا.',
        },
      },
      {
        q: { fr: 'Où trouver les bons d\'achat disponibles ?', ar: 'أين أجد قسائم الشراء المتاحة؟' },
        a: {
          fr: 'Ouvrez le menu (icône ☰) puis "Bons d\'achat" : vous y trouverez tous les codes promo actifs, leur réduction et leur date d\'expiration. Copiez le code et collez-le dans le champ prévu au moment du paiement.',
          ar: 'افتح القائمة (أيقونة ☰) ثم "قسائم الشراء": ستجد جميع الرموز الترويجية النشطة، نسبة الخصم وتاريخ الانتهاء. انسخ الرمز والصقه في الخانة المخصصة عند الدفع.',
        },
      },
    ],
  },
  {
    key: 'retours',
    icon: ShieldCheck,
    title: { fr: 'Retours & Garantie', ar: 'الإرجاع والضمان' },
    items: [
      {
        q: { fr: 'Puis-je retourner un produit ?', ar: 'هل يمكنني إرجاع منتج؟' },
        a: {
          fr: "Une fois la commande livrée, ouvrez une demande de retour depuis \"Mes commandes\" en précisant le motif. La boutique concernée examine la demande et peut l'approuver, la refuser, ou proposer un remboursement selon l'état du produit.",
          ar: 'بمجرد تسليم الطلب، افتح طلب إرجاع من "طلباتي" مع توضيح السبب. يقوم المتجر المعني بمراجعة الطلب ويمكنه الموافقة أو الرفض أو اقتراح استرداد حسب حالة المنتج.',
        },
      },
      {
        q: { fr: 'Que couvre la garantie ?', ar: 'ما الذي يغطيه الضمان؟' },
        a: {
          fr: "Un email détaillant les conditions de livraison, de retour et de responsabilité vous est envoyé après chaque commande. La boutique vendeuse reste responsable de la conformité et de la qualité des produits vendus sur la plateforme.",
          ar: 'يُرسل إليك بريد إلكتروني يوضح شروط التوصيل والإرجاع والمسؤولية بعد كل طلب. يبقى المتجر البائع مسؤولاً عن مطابقة وجودة المنتجات المباعة عبر المنصة.',
        },
      },
    ],
  },
  {
    key: 'vendeur',
    icon: Store,
    title: { fr: 'Devenir vendeur', ar: 'كن بائعًا' },
    items: [
      {
        q: { fr: 'Comment ouvrir ma boutique ?', ar: 'كيف أفتح متجري؟' },
        a: {
          fr: "Cliquez sur \"Devenir vendeur\", créez votre compte puis renseignez les informations de votre boutique (nom, description, localisation, mode de paiement). Votre boutique est créée immédiatement mais reste \"en attente\" jusqu'à validation par notre équipe.",
          ar: 'اضغط على "كن بائعًا"، أنشئ حسابك ثم أدخل معلومات متجرك (الاسم، الوصف، الموقع، طريقة الدفع). يُنشأ متجرك فورًا لكنه يبقى "قيد الانتظار" حتى تتم الموافقة عليه من فريقنا.',
        },
      },
      {
        q: { fr: 'Comment suis-je payé ?', ar: 'كيف يتم دفع مستحقاتي؟' },
        a: {
          fr: "Au choix, par virement bancaire (IBAN) ou via Flouci. Une commission de 5% est prélevée sur chaque vente. Vous pouvez demander un retrait à tout moment depuis votre tableau de bord vendeur (montant minimum 50 TND), à traiter par notre équipe.",
          ar: 'حسب اختيارك، عبر تحويل بنكي (IBAN) أو عبر Flouci. تُخصم عمولة 5% من كل عملية بيع. يمكنك طلب سحب أموالك في أي وقت من لوحة تحكم البائع (الحد الأدنى 50 دينار)، ليتم معالجته من طرف فريقنا.',
        },
      },
      {
        q: { fr: "Je viens de m'inscrire, pourquoi ma boutique n'apparaît pas ?", ar: 'سجلت للتو، لماذا لا يظهر متجري؟' },
        a: {
          fr: "Toute nouvelle boutique passe par une validation manuelle avant d'apparaître publiquement dans le catalogue. Un email de bienvenue détaillant les règles vous est envoyé à l'inscription — vous serez notifié une fois votre boutique approuvée.",
          ar: 'يمر كل متجر جديد بمراجعة يدوية قبل أن يظهر للعموم في الكتالوج. يُرسل إليك بريد ترحيبي يوضح القواعد عند التسجيل — سيتم إعلامك بمجرد الموافقة على متجرك.',
        },
      },
    ],
  },
  {
    key: 'livreur',
    icon: Bike,
    title: { fr: 'Devenir livreur', ar: 'كن سائق توصيل' },
    items: [
      {
        q: { fr: 'Comment devenir livreur partenaire ?', ar: 'كيف أصبح سائق توصيل شريك؟' },
        a: {
          fr: 'Depuis "Espace Livreur" (lien en bas de page), créez votre compte en indiquant votre véhicule. Vous accédez ensuite à un tableau de bord mobile listant les courses disponibles près de vous.',
          ar: 'من "مساحة السائق" (رابط أسفل الصفحة)، أنشئ حسابك مع تحديد وسيلة نقلك. ستصل بعدها إلى لوحة تحكم تعرض المهمات المتاحة بالقرب منك.',
        },
      },
      {
        q: { fr: 'Comment sont attribuées les courses ?', ar: 'كيف تُوزَّع المهمات؟' },
        a: {
          fr: "Dès qu'une commande est prête, le système notifie en temps réel le livreur disponible le plus proche du point de retrait. Si aucune réponse n'arrive à temps, la course est automatiquement proposée au suivant.",
          ar: 'بمجرد أن يصبح الطلب جاهزًا، يقوم النظام فورًا بإشعار أقرب سائق متاح لنقطة الاستلام. إذا لم يصل رد في الوقت المحدد، تُعرض المهمة تلقائيًا على السائق التالي.',
        },
      },
      {
        q: { fr: 'Comment sont calculés mes gains ?', ar: 'كيف تُحتسب أرباحي؟' },
        a: {
          fr: "Vous percevez les frais de livraison de chaque course terminée. Consultez vos gains du jour et de la semaine, ainsi que votre historique complet, depuis l'onglet \"Statistiques\" de votre espace livreur.",
          ar: 'تحصل على مصاريف التوصيل لكل مهمة منجزة. تابع أرباحك اليومية والأسبوعية، وكذلك سجلك الكامل، من قسم "الإحصائيات" في مساحتك.',
        },
      },
    ],
  },
  {
    key: 'compte',
    icon: User,
    title: { fr: 'Mon compte', ar: 'حسابي' },
    items: [
      {
        q: { fr: "J'ai oublié mon mot de passe, que faire ?", ar: 'نسيت كلمة المرور، ماذا أفعل؟' },
        a: {
          fr: 'Cliquez sur "Mot de passe oublié ?" dans la fenêtre de connexion, saisissez votre email : un lien de réinitialisation valable 1 heure vous sera envoyé.',
          ar: 'اضغط على "نسيت كلمة المرور؟" في نافذة تسجيل الدخول، أدخل بريدك الإلكتروني: سيُرسل إليك رابط لإعادة التعيين صالح لمدة ساعة واحدة.',
        },
      },
      {
        q: { fr: 'Puis-je me connecter avec Google ou Facebook ?', ar: 'هل يمكنني تسجيل الدخول بـ Google أو Facebook؟' },
        a: {
          fr: 'Oui — la première connexion via Google ou Facebook crée automatiquement votre compte, aucune inscription séparée n\'est nécessaire. Un compte créé ainsi ne peut pas se connecter ensuite avec un mot de passe classique : utilisez toujours le même bouton.',
          ar: 'نعم — أول تسجيل دخول عبر Google أو Facebook ينشئ حسابك تلقائيًا، دون الحاجة لتسجيل منفصل. الحساب المُنشأ بهذه الطريقة لا يمكنه لاحقًا تسجيل الدخول بكلمة مرور تقليدية: استخدم دائمًا نفس الزر.',
        },
      },
      {
        q: { fr: 'Comment retrouver mes produits favoris ?', ar: 'كيف أجد منتجاتي المفضلة؟' },
        a: {
          fr: 'Cliquez sur le cœur sur n\'importe quelle fiche produit pour l\'ajouter, puis retrouvez-les tous depuis le menu (icône ☰) → "Favoris".',
          ar: 'اضغط على أيقونة القلب في أي بطاقة منتج لإضافته، ثم استعرضها جميعًا من القائمة (أيقونة ☰) ← "المفضلة".',
        },
      },
    ],
  },
  {
    key: 'livraison',
    icon: Truck,
    title: { fr: 'Livraison', ar: 'التوصيل' },
    items: [
      {
        q: { fr: 'Quels sont les délais et frais de livraison ?', ar: 'ما هي مدة وتكلفة التوصيل؟' },
        a: {
          fr: "Les frais varient selon votre gouvernorat (visibles directement sur chaque fiche produit et au checkout) — comptez généralement 24 à 48h à Tunis et 48 à 72h ailleurs en Tunisie.",
          ar: 'تختلف التكلفة حسب ولايتك (تظهر مباشرة في كل بطاقة منتج وعند الدفع) — عادة من 24 إلى 48 ساعة في تونس العاصمة و48 إلى 72 ساعة في باقي الولايات.',
        },
      },
      {
        q: { fr: 'Ma commande a-t-elle besoin d\'une confirmation ?', ar: 'هل يحتاج طلبي إلى تأكيد؟' },
        a: {
          fr: "Pour les commandes payées à la livraison, un SMS avec un lien de confirmation vous est envoyé. Sans confirmation sous 48h, la commande n'est pas expédiée et peut expirer — pensez à vérifier vos SMS après l'achat.",
          ar: 'بالنسبة للطلبات المدفوعة عند الاستلام، تُرسل إليك رسالة نصية تحتوي رابط تأكيد. بدون تأكيد خلال 48 ساعة، لن يُشحن الطلب وقد ينتهي — تحقق من رسائلك بعد الشراء.',
        },
      },
    ],
  },
];

function AccordionItem({ item, language }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 py-4 text-left">
        <span className="text-sm font-bold text-slate-800">{item.q[language]}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className="grid overflow-hidden transition-all duration-300" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="min-h-0 overflow-hidden">
          <p className="pb-4 text-sm leading-7 text-slate-600">{item.a[language]}</p>
        </div>
      </div>
    </div>
  );
}

export default function HelpCenterPage({ language = 'fr', onBack }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].key);

  const query = search.trim().toLowerCase();
  const filteredCategories = query
    ? CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) =>
        item.q.fr.toLowerCase().includes(query) || item.q.ar.includes(query) ||
        item.a.fr.toLowerCase().includes(query)),
    })).filter((cat) => cat.items.length > 0)
    : CATEGORIES.filter((cat) => cat.key === activeCategory);

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 font-sans">
      <div className="gradient-brand p-6 text-white shadow-md sm:p-10">
        <div className="mx-auto max-w-4xl">
          <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-xs font-bold text-white/80 hover:text-white">
            <ArrowLeft size={14} className={isAr ? 'rotate-180' : ''} /> {tr('Retour', 'رجوع')}
          </button>
          <h1 className="text-2xl font-black sm:text-3xl">{tr("Centre d'assistance", 'مركز المساعدة')}</h1>
          <p className="mt-2 text-sm text-white/80">{tr('Toutes les réponses à vos questions sur here.tn.', 'كل الإجابات على أسئلتك حول here.tn.')}</p>

          <div className="relative mt-6">
            <Search size={16} className="absolute left-4 top-3.5 text-slate-400 rtl:left-auto rtl:right-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('Rechercher une question...', 'ابحث عن سؤال...')}
              className="w-full rounded-2xl border-none bg-white py-3 pl-11 pr-4 text-sm text-slate-800 shadow-lg outline-none rtl:pl-4 rtl:pr-11"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          {!query && (
            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(cat.key)}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold transition ${
                      active ? 'bg-[#F5F3FF] text-[#7C3AED]' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={16} /> {cat.title[language]}
                  </button>
                );
              })}
            </nav>
          )}

          <div className="space-y-5">
            {filteredCategories.length === 0 && (
              <div className="card-premium p-8 text-center text-sm text-slate-500">
                {tr('Aucun résultat. Essayez un autre mot-clé, ou contactez-nous directement.', 'لا توجد نتائج. جرّب كلمة أخرى أو تواصل معنا مباشرة.')}
              </div>
            )}

            {filteredCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.key} className="card-premium p-5 sm:p-6">
                  <div className="mb-1 flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5F3FF] text-[#7C3AED]"><Icon size={17} /></span>
                    <h2 className="text-base font-extrabold text-slate-900">{cat.title[language]}</h2>
                  </div>
                  <div className="mt-2">
                    {cat.items.map((item) => (
                      <AccordionItem key={item.q.fr} item={item} language={language} />
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="card-premium flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{tr('Vous ne trouvez pas votre réponse ?', 'لم تجد إجابتك؟')}</h3>
                <p className="mt-1 text-xs text-slate-500">{tr('Notre équipe vous répond directement.', 'فريقنا يجيبك مباشرة.')}</p>
              </div>
              <a href="mailto:support@here.tn" className="btn-primary-premium flex items-center gap-2 px-5 py-2.5 text-xs">
                <MessageSquare size={15} /> {tr('Nous contacter', 'تواصل معنا')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
