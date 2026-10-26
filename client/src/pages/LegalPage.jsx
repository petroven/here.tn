import React from 'react';

const legalContent = {
  cgu: {
    fr: { title: 'Conditions generales d utilisation', intro: 'Les presentes conditions encadrent l utilisation de here.tn et les achats realises aupres des boutiques partenaires.', sections: [['Compte et acces', 'Chaque utilisateur doit fournir des informations exactes et proteger ses identifiants. Les visiteurs peuvent consulter le catalogue sans compte.'], ['Marketplace multi-boutiques', 'here.tn met en relation les clients et les boutiques independantes. Le vendeur reste responsable de la conformite et de la disponibilite de ses produits.'], ['Commandes et paiements', 'Une commande est confirmee apres validation par la plateforme. Les paiements en ligne reels ne sont actives qu avec une configuration marchande validee.']] },
    ar: { title: 'شروط الاستخدام', intro: 'تنظم هذه الشروط استخدام منصة here.tn والشراء من المتاجر الشريكة.', sections: [['الحساب والدخول', 'يجب على المستخدم تقديم معلومات صحيحة وحماية بيانات الدخول. يمكن للزائر تصفح المنتجات دون حساب.'], ['السوق متعدد المتاجر', 'تربط المنصة بين العملاء والمتاجر المستقلة، ويبقى البائع مسؤولا عن منتجاته وتوفرها.'], ['الطلبات والدفع', 'يتم تأكيد الطلب بعد التحقق منه. لا يتم تفعيل الدفع الإلكتروني الحقيقي إلا بعد إعداد حساب التاجر.']] },
  },
  cgv: {
    fr: {
      title: 'Conditions generales de vente',
      intro: "Ces conditions s'appliquent a tout achat effectue sur BuyHere aupres des boutiques partenaires. Chaque produit est vendu par la boutique indiquee sur sa fiche.",
      sections: [
        ['Prix', 'Les prix sont affiches en dinars tunisiens (TND). Les frais de livraison, calcules selon le gouvernorat de livraison, sont indiques avant la validation de la commande.'],
        ['Commande', "La commande est enregistree apres validation du panier et de l'adresse de livraison. Une commande regroupant plusieurs boutiques est preparee et expediee separement par chacune d'elles."],
        ['Paiement', "Le paiement se fait a la livraison ou en ligne via Konnect ou Flouci lorsque ces moyens sont actives. Une commande payee en ligne n'est confirmee qu'apres reception de la confirmation du prestataire de paiement."],
        ['Disponibilite', "Les produits sont proposes dans la limite des stocks indiques par chaque boutique. En cas d'indisponibilite apres commande, le client est informe et la commande peut etre modifiee ou annulee sans frais."],
        ['Livraison', "La livraison est assuree dans les 24 gouvernorats. Chaque colis recoit un numero de suivi consultable depuis la page Suivi. Le client verifie l'etat du colis a la reception."],
        ['Retractation et retours', "Conformement a la loi n° 2000-83 relative aux echanges et au commerce electroniques, le client dispose d'un delai de retractation de 10 jours ouvrables a compter de la reception. Le delai de retour propre a chaque produit est indique sur sa fiche. Les demandes se font depuis l'espace client."],
        ['Remboursement', 'Le remboursement est effectue apres acceptation du retour par la boutique, par le moyen de paiement initial ou selon un accord avec le client.'],
        ['Reclamations', 'Pour toute reclamation, le client peut contacter le vendeur depuis la messagerie ou le service client depuis la page Contact. BuyHere peut intervenir en mediation entre le client et la boutique.'],
      ],
    },
    ar: {
      title: 'الشروط العامة للبيع',
      intro: 'تنطبق هذه الشروط على كل عملية شراء على BuyHere من المتاجر الشريكة. يُباع كل منتج من طرف المتجر المذكور في بطاقته.',
      sections: [
        ['الأسعار', 'تُعرض الأسعار بالدينار التونسي. تُحتسب مصاريف التوصيل حسب ولاية التوصيل وتظهر قبل تأكيد الطلب.'],
        ['الطلب', 'يُسجَّل الطلب بعد تأكيد السلة وعنوان التوصيل. الطلب الذي يضم عدة متاجر يُحضَّر ويُرسَل بشكل منفصل من كل متجر.'],
        ['الدفع', 'يتم الدفع عند الاستلام أو عبر الإنترنت بواسطة Konnect أو Flouci عند تفعيلهما. لا يُؤكَّد الطلب المدفوع عبر الإنترنت إلا بعد وصول تأكيد مزود الدفع.'],
        ['التوفر', 'تُعرض المنتجات في حدود المخزون الذي يحدده كل متجر. في حال عدم التوفر بعد الطلب، يتم إعلام العميل ويمكن تعديل الطلب أو إلغاؤه دون مصاريف.'],
        ['التوصيل', 'يتوفر التوصيل في الولايات الـ24. يحصل كل طرد على رقم تتبع يمكن الاطلاع عليه من صفحة التتبع. يتحقق العميل من حالة الطرد عند الاستلام.'],
        ['العدول والإرجاع', 'طبقًا للقانون عدد 83 لسنة 2000 المتعلق بالمبادلات والتجارة الإلكترونية، للعميل أجل عدول بعشرة أيام عمل ابتداءً من الاستلام. يظهر أجل الإرجاع الخاص بكل منتج في بطاقته. تُقدَّم الطلبات من فضاء العميل.'],
        ['الاسترداد', 'يتم الاسترداد بعد قبول المتجر للإرجاع، بنفس وسيلة الدفع الأصلية أو حسب اتفاق مع العميل.'],
        ['الشكاوى', 'لأي شكوى، يمكن للعميل التواصل مع البائع عبر المراسلة أو مع خدمة العملاء عبر صفحة التواصل. يمكن لـ BuyHere التدخل للوساطة بين العميل والمتجر.'],
      ],
    },
  },
  privacy: {
    fr: { title: 'Politique de confidentialite', intro: 'Nous limitons la collecte aux informations necessaires au compte, a la livraison, au paiement et au support.', sections: [['Donnees collectees', 'Nom, email, telephone, adresse de livraison et informations de commande peuvent etre utilises pour executer le service.'], ['Utilisation', 'Les donnees servent au traitement des commandes, au suivi, a la prevention de la fraude et aux communications demandees.'], ['Vos droits', 'Vous pouvez demander la rectification ou la suppression de vos donnees via support@here.tn, sous reserve des obligations legales.']] },
    ar: { title: 'سياسة الخصوصية', intro: 'نقتصر في جمع البيانات على ما يلزم للحساب والتوصيل والدفع والدعم.', sections: [['البيانات المجمعة', 'قد نستخدم الاسم والبريد والهاتف والعنوان ومعلومات الطلب لتنفيذ الخدمة.'], ['الاستخدام', 'تستخدم البيانات لمعالجة الطلبات والتتبع ومنع الاحتيال والرسائل المطلوبة.'], ['حقوقك', 'يمكنك طلب تصحيح أو حذف بياناتك عبر support@here.tn مع مراعاة الالتزامات القانونية.']] },
  },
  returns: {
    fr: { title: 'Politique de retour', intro: 'Les retours sont geres par la boutique concernee selon l etat du produit et les delais applicables.', sections: [['Demande', 'Un client peut ouvrir une demande depuis son espace apres une commande livree.'], ['Examen', 'La boutique examine le motif et peut approuver, refuser ou valider le remboursement.'], ['Remboursement', 'Le remboursement est traite apres validation et peut dependre du moyen de paiement utilise.']] },
    ar: { title: 'سياسة الإرجاع', intro: 'تتم معالجة الإرجاع من طرف المتجر المعني حسب حالة المنتج والآجال المطبقة.', sections: [['الطلب', 'يمكن للعميل فتح طلب بعد تسليم الطلبية من مساحته.'], ['المراجعة', 'يدرس المتجر السبب ويمكنه الموافقة أو الرفض أو اعتماد الاسترداد.'], ['الاسترداد', 'يتم الاسترداد بعد الاعتماد وقد يختلف حسب طريقة الدفع.']] },
  },
  shipping: {
    fr: { title: 'Politique de livraison', intro: 'Les frais et les delais de livraison sont calcules selon le gouvernorat et les informations de la commande.', sections: [['Zones', 'here.tn prepare la livraison dans les gouvernorats tunisiens disponibles dans le formulaire.'], ['Suivi', 'Chaque commande genere un identifiant de suivi lorsque la livraison est creee.'], ['Retard', 'Un retard peut survenir selon le transporteur, la region ou la disponibilite du produit.']] },
    ar: { title: 'سياسة الشحن', intro: 'يتم احتساب تكاليف ومدة الشحن حسب الولاية ومعلومات الطلب.', sections: [['المناطق', 'تتوفر التوصيلات في الولايات التونسية الموجودة في نموذج الطلب.'], ['التتبع', 'يتم إنشاء رقم تتبع عند إنشاء عملية التوصيل.'], ['التأخير', 'قد يحدث تأخير بسبب شركة النقل أو المنطقة أو توفر المنتج.']] },
  },
  vendorTerms: {
    fr: {
      title: 'Conditions vendeur',
      intro: "Ces conditions s'appliquent a toute boutique creee sur here.tn, en complement des conditions generales d'utilisation.",
      sections: [
        ['Validation de la boutique', "Une boutique nouvellement creee reste au statut \"en attente\" et n'apparait pas dans le catalogue public tant qu'elle n'a pas ete validee par l'equipe here.tn."],
        ['Commission', "here.tn preleve une commission de 15% sur le sous-total de chaque vente (hors frais de livraison). Le montant net revenant au vendeur est calcule automatiquement sur chaque commande et visible depuis le tableau de bord vendeur."],
        ['Paiement des ventes', "Les sommes dues sont versees sur demande de retrait (montant minimum 50 TND), par virement bancaire (IBAN) ou vers un compte Flouci selon le mode choisi a l'inscription. Chaque demande est examinee par l'equipe here.tn avant versement."],
        ['Conformite des produits', "Le vendeur est seul responsable de l'exactitude des fiches produit (prix, description, images, stock) et de la conformite des articles vendus a la reglementation tunisienne en vigueur."],
        ['Preparation et delais', "Le vendeur s'engage a maintenir son stock a jour et a preparer les commandes confirmees dans un delai raisonnable pour eviter les ruptures et les annulations."],
        ['Retours et litiges', "Chaque demande de retour est transmise a la boutique concernee, qui peut l'approuver ou la refuser selon l'etat du produit recu. En cas de litige non resolu, here.tn peut intervenir en mediation."],
        ['Suspension', "here.tn peut suspendre ou desactiver une boutique en cas de non-conformite repetee, de fraude, de produits interdits ou de plaintes clients non traitees. Le vendeur en est informe par email."],
        ['Proprietaire du contenu', "Le vendeur garantit disposer des droits necessaires sur les photos, textes et marques qu'il publie sur sa boutique."],
      ],
    },
    ar: {
      title: 'شروط البائع',
      intro: 'تنطبق هذه الشروط على كل متجر يتم إنشاؤه على here.tn، بالإضافة إلى الشروط العامة للاستخدام.',
      sections: [
        ['اعتماد المتجر', 'يبقى المتجر الذي تم إنشاؤه حديثًا في حالة "قيد الانتظار" ولا يظهر في الكتالوج العام إلى أن يتم اعتماده من طرف فريق here.tn.'],
        ['العمولة', 'تقتطع here.tn عمولة 15% من المجموع الفرعي لكل عملية بيع (باستثناء مصاريف التوصيل). يتم احتساب المبلغ الصافي للبائع تلقائيًا لكل طلب ويظهر في لوحة تحكم البائع.'],
        ['دفع المبيعات', 'تُصرف المبالغ المستحقة عند طلب السحب (بحد أدنى 50 دينار)، عبر تحويل بنكي (IBAN) أو إلى حساب Flouci حسب الطريقة المختارة عند التسجيل. تتم مراجعة كل طلب من طرف فريق here.tn قبل الصرف.'],
        ['مطابقة المنتجات', 'يتحمل البائع وحده مسؤولية دقة بطاقات المنتج (السعر، الوصف، الصور، المخزون) ومطابقة المنتجات المباعة للتشريع التونسي الساري.'],
        ['التحضير والآجال', 'يلتزم البائع بتحديث مخزونه وتحضير الطلبات المؤكدة في أجل معقول لتجنب النفاد والإلغاءات.'],
        ['الإرجاع والنزاعات', 'تُحال كل طلبات الإرجاع إلى المتجر المعني الذي يمكنه الموافقة أو الرفض حسب حالة المنتج المستلم. في حال استمرار النزاع، يمكن لـ here.tn التدخل للوساطة.'],
        ['التعليق', 'يمكن لـ here.tn تعليق أو تعطيل متجر في حال تكرار عدم المطابقة أو الاحتيال أو بيع منتجات محظورة أو عدم معالجة شكاوى العملاء. يتم إخبار البائع عبر البريد الإلكتروني.'],
        ['ملكية المحتوى', 'يضمن البائع امتلاكه الحقوق اللازمة على الصور والنصوص والعلامات التي ينشرها في متجره.'],
      ],
    },
  },
};

export default function LegalPage({ type = 'cgu', language = 'fr', onBack }) {
  const content = legalContent[type] || legalContent.cgu;
  const copy = content[language] || content.fr;
  return (
    <main dir={language === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-10">
        <button onClick={onBack} className="mb-8 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{language === 'ar' ? 'رجوع' : 'Retour'}</button>
        <span className="text-sm font-bold text-[#C4532C]">BuyHere</span>
        <h1 className="mt-2 text-3xl font-black text-[#1E1B18]">{copy.title}</h1>
        <p className="mt-4 text-sm leading-7 text-[#475569]">{copy.intro}</p>
        <div className="mt-8 space-y-6">{copy.sections.map(([title, text]) => <section key={title} className="border-t border-slate-100 pt-5"><h2 className="text-lg font-extrabold text-[#1E1B18]">{title}</h2><p className="mt-2 text-sm leading-7 text-[#475569]">{text}</p></section>)}</div>
      </article>
    </main>
  );
}
