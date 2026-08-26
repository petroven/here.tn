import nodemailer from 'nodemailer';
import { generateInvoicePDF } from './pdf.js';
import { Commande, Utilisateur, Paiement } from '../models/index.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

export async function sendEmail({ to, subject, html, text, attachments }) {
  const mailOptions = {
    from: process.env.SMTP_FROM || 'here.tn <noreply@here.tn>',
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Envoyé à ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL] Erreur:', error.message);
    return { success: false, error: error.message };
  }
}

// Branded HTML layout (table-based, inline styles only) shared by the
// "premium" transactional emails below — email clients strip <style>
// blocks and ignore flexbox/grid, so this stays deliberately old-school.
function renderBrandedEmail({ lang = 'fr', badge, title, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background-color:#6366F1;background-image:linear-gradient(135deg,#7C3AED,#6366F1,#3B82F6);padding:32px;text-align:${align};">
                <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">here.tn</div>
                ${badge ? `<div style="margin-top:12px;display:inline-block;background:rgba(255,255,255,0.18);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.4px;padding:6px 14px;border-radius:999px;">${badge}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 4px;text-align:${align};direction:${dir};">
                <h1 style="margin:0 0 16px;font-size:19px;color:#0F172A;">${title}</h1>
                <div style="font-size:14px;line-height:1.75;color:#334155;">${bodyHtml}</div>
              </td>
            </tr>
            ${ctaUrl
    ? `<tr>
              <td style="padding:12px 32px 32px;text-align:center;">
                <a href="${ctaUrl}" style="background-color:#6366F1;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:14px 34px;border-radius:12px;display:inline-block;">${ctaLabel}</a>
              </td>
            </tr>`
    : '<tr><td style="padding-bottom:12px;"></td></tr>'}
            <tr>
              <td style="padding:18px 32px;background:#F8FAFC;border-top:1px solid #E2E8F0;text-align:${align};direction:${dir};">
                <p style="margin:0;font-size:11px;color:#94A3B8;line-height:1.6;">${footerNote || (isAr
    ? 'here.tn — سوقك، هنا والآن. لأي استفسار: support@here.tn'
    : 'here.tn — votre marketplace, ici et maintenant. Une question ? support@here.tn')}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function emailConfirmationCommande(commande, client, lang = 'fr') {
  const isAr = lang === 'ar';
  const subject = isAr
    ? `تأكيد الطلب ${commande.numeroCommande}`
    : `Confirmation commande ${commande.numeroCommande}`;

  const html = isAr
    ? `<div dir="rtl"><h2>شكراً ${client.prenom}!</h2><p>تم تأكيد طلبك رقم <strong>${commande.numeroCommande}</strong>.</p><p>المبلغ الإجمالي: <strong>${commande.total.toFixed(3)} TND</strong></p></div>`
    : `<h2>Merci ${client.prenom} !</h2><p>Votre commande <strong>${commande.numeroCommande}</strong> a été confirmée.</p><p>Total: <strong>${commande.total.toFixed(3)} TND</strong></p>`;

  return sendEmail({ to: client.email, subject, html });
}

export async function emailFacture(commande, client, boutique, lignes, lang = 'fr') {
  const isAr = lang === 'ar';
  const pdf = await generateInvoicePDF(commande, client, boutique, lignes, lang);

  const subject = isAr
    ? `فاتورتك للطلب ${commande.numeroCommande}`
    : `Votre facture pour la commande ${commande.numeroCommande}`;

  const html = isAr
    ? `<div dir="rtl"><p>مرحباً ${client.prenom}،</p><p>ستجد في المرفق فاتورة طلبك <strong>${commande.numeroCommande}</strong> بمبلغ <strong>${commande.total.toFixed(3)} TND</strong>.</p></div>`
    : `<p>Bonjour ${client.prenom},</p><p>Veuillez trouver ci-joint la facture de votre commande <strong>${commande.numeroCommande}</strong> d'un montant de <strong>${commande.total.toFixed(3)} TND</strong>.</p>`;

  return sendEmail({
    to: client.email,
    subject,
    html,
    attachments: [{ filename: `facture-${commande.numeroCommande}.pdf`, content: pdf, contentType: 'application/pdf' }],
  });
}

const METHODE_LABELS = {
  cod: { fr: 'Paiement à la livraison', ar: 'الدفع عند الاستلام' },
  virement: { fr: 'Virement bancaire', ar: 'تحويل بنكي' },
  konnect: { fr: 'Carte bancaire (Konnect)', ar: 'بطاقة بنكية (Konnect)' },
  flouci: { fr: 'Flouci', ar: 'Flouci' },
  sandbox: { fr: 'Carte bancaire (test)', ar: 'بطاقة بنكية (تجريبي)' },
};

// Polished payment-receipt email — the "premium" template, styled like the
// confirmation a SaaS sends right after a subscription payment goes through.
function emailRecuPaiement(commande, client, paiement, lang = 'fr') {
  const isAr = lang === 'ar';
  const t = (fr, ar) => (isAr ? ar : fr);
  const subject = t(
    `Reçu de paiement — Commande ${commande.numeroCommande}`,
    `إيصال الدفع — الطلب ${commande.numeroCommande}`,
  );

  const montant = `${Number(commande.total).toFixed(3)} TND`;
  const dateStr = new Date().toLocaleDateString(isAr ? 'ar-TN' : 'fr-TN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const methodeLabel = METHODE_LABELS[paiement?.methode]
    ? t(METHODE_LABELS[paiement.methode].fr, METHODE_LABELS[paiement.methode].ar)
    : t('En ligne', 'عبر الإنترنت');
  const rowAlign = isAr ? 'left' : 'right';

  const bodyHtml = `
    <p>${t(`Bonjour ${client.prenom},`, `مرحباً ${client.prenom}،`)}</p>
    <p>${t('Nous confirmons la réception de votre paiement. Voici votre reçu :', 'نؤكد استلام دفعتكم. إليكم الإيصال:')}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:18px 16px;font-size:32px;font-weight:800;color:#0F172A;text-align:center;background:#F8FAFC;">${montant}</td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#334155;">
      <tr><td style="padding:6px 0;color:#94A3B8;">${t('Commande', 'الطلب')}</td><td style="padding:6px 0;text-align:${rowAlign};font-weight:600;">${commande.numeroCommande}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">${t('Date', 'التاريخ')}</td><td style="padding:6px 0;text-align:${rowAlign};font-weight:600;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0;color:#94A3B8;">${t('Méthode', 'طريقة الدفع')}</td><td style="padding:6px 0;text-align:${rowAlign};font-weight:600;">${methodeLabel}</td></tr>
    </table>
    <p style="margin-top:18px;">${t(
      'La facture détaillée de votre commande vous a été envoyée séparément par e-mail.',
      'تم إرسال الفاتورة التفصيلية لطلبكم بشكل منفصل عبر البريد الإلكتروني.',
    )}</p>
  `;

  return sendEmail({
    to: client.email,
    subject,
    html: renderBrandedEmail({
      lang,
      badge: t('PAIEMENT CONFIRMÉ', 'تم تأكيد الدفع'),
      title: t('Paiement reçu avec succès', 'تم استلام الدفع بنجاح'),
      bodyHtml,
      ctaLabel: t('Voir mes commandes', 'عرض طلباتي'),
      ctaUrl: process.env.CLIENT_URL || 'http://localhost:5174',
    }),
  });
}

/**
 * Self-contained trigger for the payment-receipt email — loads the order,
 * client and payment record from just a commandeId so every payment
 * confirmation path (sandbox, webhook, admin virement validation) can fire
 * it with a single call, the same way crediterCashback() works.
 */
export async function envoyerRecuPaiement(commandeId, lang = 'fr') {
  const commande = await Commande.findByPk(commandeId);
  if (!commande) return;
  const [client, paiement] = await Promise.all([
    Utilisateur.findByPk(commande.clientId),
    Paiement.findOne({ where: { commandeId } }),
  ]);
  if (!client) return;
  return emailRecuPaiement(commande, client, paiement, lang);
}

// Email counterpart to smsConfirmationCommande — the SMS-only confirmation
// link left clients without a reachable phone (or with SMS delivery
// trouble) stuck with no way to confirm their COD order before the 48h
// auto-cancel window closes.
export function emailConfirmationLien(commande, client, lang = 'fr') {
  const isAr = lang === 'ar';
  const t = (fr, ar) => (isAr ? ar : fr);
  const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5174';
  const confirmUrl = `${frontendUrl}/confirmer-commande/${commande.confirmationToken}`;
  const subject = t(
    `Confirmez votre commande ${commande.numeroCommande} sous 48h`,
    `يرجى تأكيد طلبكم ${commande.numeroCommande} خلال 48 ساعة`,
  );

  const bodyHtml = `
    <p>${t(`Bonjour ${client.prenom},`, `مرحباً ${client.prenom}،`)}</p>
    <p>${t(
      `Merci de confirmer que vous attendez toujours votre commande <strong>${commande.numeroCommande}</strong> d'un montant de <strong>${Number(commande.total).toFixed(3)} TND</strong>.`,
      `يرجى تأكيد أنكم لا تزالون بانتظار طلبكم <strong>${commande.numeroCommande}</strong> بمبلغ <strong>${Number(commande.total).toFixed(3)} TND</strong>.`,
    )}</p>
    <p>${t(
      'Sans réponse de votre part sous 48 heures, la commande pourra être automatiquement annulée.',
      'دون رد من طرفكم خلال 48 ساعة، قد يتم إلغاء الطلب تلقائيًا.',
    )}</p>
  `;

  return sendEmail({
    to: client.email,
    subject,
    html: renderBrandedEmail({
      lang,
      badge: t('ACTION REQUISE', 'إجراء مطلوب'),
      title: t('Confirmez votre commande', 'أكدوا طلبكم'),
      bodyHtml,
      ctaLabel: t('Confirmer ma commande', 'تأكيد طلبي'),
      ctaUrl: confirmUrl,
    }),
  });
}

export function emailCommandeAnnulee(commande, client, lang = 'fr') {
  const isAr = lang === 'ar';
  const t = (fr, ar) => (isAr ? ar : fr);
  const subject = t(
    `Commande ${commande.numeroCommande} annulée`,
    `تم إلغاء الطلب ${commande.numeroCommande}`,
  );
  const html = isAr
    ? `<div dir="rtl"><p>مرحباً ${client.prenom}،</p><p>تم إلغاء طلبكم <strong>${commande.numeroCommande}</strong> بناءً على طلبكم، قبل تحضيره للشحن.</p><p>أي مبلغ مدفوع (بما في ذلك رصيد here.tn المستخدم) تم إضافته فورًا إلى رصيدكم على here.tn.</p></div>`
    : `<p>Bonjour ${client.prenom},</p><p>Votre commande <strong>${commande.numeroCommande}</strong> a été annulée à votre demande, avant sa prise en charge pour l'expédition.</p><p>Tout montant déjà payé (y compris le solde here.tn utilisé) a été immédiatement recrédité sur votre solde here.tn.</p>`;

  return sendEmail({ to: client.email, subject, html });
}

export function emailResetPassword(user, resetUrl, lang = 'fr') {
  const isAr = lang === 'ar';
  const subject = isAr ? 'إعادة تعيين كلمة المرور' : 'Réinitialisation de mot de passe';
  const html = isAr
    ? `<div dir="rtl"><p>مرحباً ${user.prenom},</p><p><a href="${resetUrl}">اضغط هنا لإعادة تعيين كلمة المرور</a></p><p>صالح لمدة ساعة واحدة.</p></div>`
    : `<p>Bonjour ${user.prenom},</p><p><a href="${resetUrl}">Cliquez ici pour réinitialiser votre mot de passe</a></p><p>Ce lien expire dans 1 heure.</p>`;

  return sendEmail({ to: user.email, subject, html });
}

export function emailBienvenueVendeur(vendeur, boutique, lang = 'fr') {
  const isAr = lang === 'ar';
  const modePaiementLabel = boutique.modePaiement === 'flouci'
    ? (isAr ? 'Flouci' : 'Flouci')
    : (isAr ? 'تحويل بنكي (IBAN)' : 'Virement bancaire (IBAN)');

  const subject = isAr
    ? `مرحبًا بك في here.tn، ${vendeur.prenom}`
    : `Bienvenue sur here.tn, ${vendeur.prenom} !`;

  const html = isAr
    ? `<div dir="rtl">
        <h2>مرحبًا ${vendeur.prenom}،</h2>
        <p>تم إنشاء متجرك <strong>${boutique.nom}</strong> بنجاح وهو الآن قيد المراجعة من طرف فريقنا قبل التفعيل.</p>
        <h3>القواعد الأساسية</h3>
        <ul>
          <li>عمولة المنصة: <strong>5%</strong> على كل عملية بيع.</li>
          <li>طريقة استلام أموالك: <strong>${modePaiementLabel}</strong>.</li>
          <li>يمكنك طلب سحب أموالك في أي وقت من لوحة التحكم، بحد أدنى قدره 50 دينار.</li>
          <li>يبقى المتجر مسؤولاً عن مطابقة منتجاته وتوفرها وجودتها.</li>
          <li>الطلبات المسلمة لا يمكن إرجاعها إلا عبر طلب رسمي يقدمه العميل ويوافق عليه المتجر.</li>
        </ul>
        <p>بمجرد الموافقة على متجرك، ستتمكن من إضافة منتجاتك والبدء في البيع.</p>
      </div>`
    : `<h2>Bonjour ${vendeur.prenom},</h2>
      <p>Votre boutique <strong>${boutique.nom}</strong> a bien été créée et est actuellement en attente de validation par notre équipe avant activation.</p>
      <h3>Les règles essentielles à connaître</h3>
      <ul>
        <li>Commission de la plateforme : <strong>5%</strong> sur chaque vente.</li>
        <li>Mode de réception de vos paiements : <strong>${modePaiementLabel}</strong>.</li>
        <li>Vous pouvez demander un retrait à tout moment depuis votre tableau de bord (montant minimum 50 TND).</li>
        <li>Votre boutique reste responsable de la conformité, de la disponibilité et de la qualité de ses produits.</li>
        <li>Une commande livrée ne peut être retournée que via une demande officielle du client, soumise à votre validation.</li>
      </ul>
      <p>Dès que votre boutique sera approuvée, vous pourrez ajouter vos produits et commencer à vendre.</p>`;

  return sendEmail({ to: vendeur.email, subject, html });
}

export function emailGarantieCommande(commande, client, lang = 'fr') {
  const isAr = lang === 'ar';
  const subject = isAr
    ? `شروط الضمان لطلبك ${commande.numeroCommande}`
    : `Conditions de garantie de votre commande ${commande.numeroCommande}`;

  const html = isAr
    ? `<div dir="rtl">
        <h2>مرحبًا،</h2>
        <p>فيما يلي شروط الضمان المطبقة على طلبك <strong>${commande.numeroCommande}</strong>:</p>
        <h3>التوصيل</h3>
        <p>يتم احتساب مدة وتكلفة التوصيل حسب الولاية. قد يحدث تأخير بسبب شركة النقل أو توفر المنتج.</p>
        <h3>الإرجاع والاسترداد</h3>
        <p>يمكن فتح طلب إرجاع من مساحتك الشخصية خلال <strong>48 ساعة</strong> فقط بعد تأكيد استلام الطلبية. بعد انقضاء هذا الأجل، يصبح الإرجاع غير ممكن. عند الموافقة، يُضاف مبلغ الاسترداد مباشرة إلى <strong>رصيدك على here.tn</strong> (وليس إلى وسيلة الدفع الأصلية).</p>
        <h3>المسؤولية</h3>
        <p>يبقى المتجر البائع مسؤولاً عن مطابقة وجودة المنتجات المباعة عبر المنصة.</p>
        <p>لأي استفسار، تواصل معنا عبر support@here.tn.</p>
      </div>`
    : `<h2>Bonjour,</h2>
      <p>Voici les conditions de garantie applicables à votre commande <strong>${commande.numeroCommande}</strong> :</p>
      <h3>Livraison</h3>
      <p>Les délais et frais de livraison sont calculés selon votre gouvernorat. Un retard peut survenir selon le transporteur, la région ou la disponibilité du produit.</p>
      <h3>Retour et remboursement</h3>
      <p>Une demande de retour peut être ouverte depuis votre espace client dans un délai de <strong>48 heures</strong> seulement après la confirmation de livraison. Passé ce délai, le retour n'est plus possible. En cas d'approbation, le montant remboursé est crédité directement sur votre <strong>solde here.tn</strong> (et non sur le moyen de paiement d'origine).</p>
      <h3>Responsabilité</h3>
      <p>La boutique vendeuse reste responsable de la conformité et de la qualité des produits vendus sur la plateforme.</p>
      <p>Pour toute question, contactez-nous à support@here.tn.</p>`;

  return sendEmail({ to: client.email, subject, html });
}

// Formal "contract" document — distinct from emailGarantieCommande above,
// sent alongside it at order confirmation. Written as numbered articles
// rather than a casual notice, since it's meant to be the reference
// document a client points back to if they dispute a return decision.
export function emailContratRetour(commande, client, lang = 'fr') {
  const isAr = lang === 'ar';
  const t = (fr, ar) => (isAr ? ar : fr);
  const subject = t(
    `Contrat de vente et conditions de retour — ${commande.numeroCommande}`,
    `عقد البيع وشروط الإرجاع — ${commande.numeroCommande}`,
  );

  const bodyHtml = `
    <p>${t(`Bonjour ${client.prenom},`, `مرحباً ${client.prenom}،`)}</p>
    <p>${t(
      'En complément de la confirmation de votre commande, voici les conditions contractuelles applicables à votre achat sur here.tn.',
      'بالإضافة إلى تأكيد طلبكم، إليكم الشروط التعاقدية المطبقة على عملية الشراء على here.tn.',
    )}</p>
    <p style="margin-top:20px;"><strong>${t('Article 1 — Livraison', 'المادة 1 — التوصيل')}</strong><br/>
    ${t(
      'Les délais et frais de livraison sont calculés selon votre gouvernorat et communiqués avant validation de la commande.',
      'يتم احتساب آجال وتكاليف التوصيل حسب ولايتكم ويتم إعلامكم بها قبل تأكيد الطلب.',
    )}</p>
    <p style="margin-top:14px;"><strong>${t('Article 2 — Délai de retour selon la catégorie', 'المادة 2 — مهلة الإرجاع حسب الفئة')}</strong><br/>
    ${t(
      'La fenêtre de retour dépend de la catégorie du produit (généralement entre 7 et 14 jours après livraison ; certains produits — alimentaire, cosmétique ouvert, sur-mesure — sont non retournables). Le délai applicable est affiché sur chaque fiche produit. Toute demande doit être ouverte depuis votre espace client, avec photos à l\'appui, avant l\'expiration de ce délai — passé celui-ci, le retour devient définitivement impossible.',
      'تعتمد مهلة الإرجاع على فئة المنتج (عادة بين 7 و14 يومًا بعد التسليم؛ بعض المنتجات — الغذائية، مستحضرات التجميل المفتوحة، المصنوعة حسب الطلب — غير قابلة للإرجاع). يظهر الأجل المطبق في بطاقة كل منتج. يجب فتح أي طلب من مساحتكم الشخصية، مرفقًا بصور، قبل انتهاء هذا الأجل — بعد ذلك يصبح الإرجاع غير ممكن نهائيًا.',
    )}</p>
    <p style="margin-top:14px;"><strong>${t('Article 2bis — Frais de retour', 'المادة 2 مكرر — مصاريف الإرجاع')}</strong><br/>
    ${t(
      'En cas de défaut ou de non-conformité du produit, les frais de retour sont à la charge de la boutique. En cas de simple changement d\'avis, ils restent à votre charge.',
      'في حالة وجود عيب أو عدم مطابقة، تكون مصاريف الإرجاع على عاتق المتجر. أما في حالة تغيير الرأي، فتبقى على عاتقكم.',
    )}</p>
    <p style="margin-top:14px;"><strong>${t('Article 3 — Remboursement en solde here.tn', 'المادة 3 — الاسترداد كرصيد here.tn')}</strong><br/>
    ${t(
      'Tout retour approuvé par la boutique donne lieu à un crédit du montant correspondant sur votre <strong>solde here.tn</strong> (wallet), immédiatement utilisable sur vos prochaines commandes. Aucun remboursement n’est effectué vers le moyen de paiement d’origine.',
      'كل عملية إرجاع توافق عليها المتجر تؤدي إلى إضافة المبلغ المطابق إلى <strong>رصيدكم على here.tn</strong> (المحفظة)، ويمكن استخدامه فورًا في طلباتكم القادمة. لا يتم أي استرداد إلى وسيلة الدفع الأصلية.',
    )}</p>
    <p style="margin-top:14px;"><strong>${t('Article 4 — Responsabilité', 'المادة 4 — المسؤولية')}</strong><br/>
    ${t(
      'La boutique vendeuse reste seule responsable de la conformité et de la qualité des produits vendus sur la plateforme.',
      'تبقى المتجر البائع المسؤول الوحيد عن مطابقة وجودة المنتجات المباعة عبر المنصة.',
    )}</p>
    <p style="margin-top:20px;">${t(
      'Pour toute question relative à ce contrat, contactez-nous à support@here.tn.',
      'لأي استفسار بخصوص هذا العقد، تواصلوا معنا عبر support@here.tn.',
    )}</p>
  `;

  return sendEmail({
    to: client.email,
    subject,
    html: renderBrandedEmail({
      lang,
      badge: t('DOCUMENT CONTRACTUEL', 'وثيقة تعاقدية'),
      title: t('Contrat de vente & conditions de retour', 'عقد البيع وشروط الإرجاع'),
      bodyHtml,
    }),
  });
}

function emailRemboursementCredite(commande, client, retour, lang = 'fr') {
  const isAr = lang === 'ar';
  const t = (fr, ar) => (isAr ? ar : fr);
  const subject = t(
    `Remboursement crédité — Commande ${commande.numeroCommande}`,
    `تم إضافة استرداد المبلغ — الطلب ${commande.numeroCommande}`,
  );
  const montant = `${Number(retour.montantRemboursement || commande.total).toFixed(3)} TND`;

  const bodyHtml = `
    <p>${t(`Bonjour ${client.prenom},`, `مرحباً ${client.prenom}،`)}</p>
    <p>${t(
      `Votre demande de retour pour la commande <strong>${commande.numeroCommande}</strong> a été acceptée.`,
      `تم قبول طلب إرجاعكم للطلب <strong>${commande.numeroCommande}</strong>.`,
    )}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:18px 16px;font-size:32px;font-weight:800;color:#0F172A;text-align:center;background:#F8FAFC;">+${montant}</td></tr>
    </table>
    <p>${t(
      'Ce montant a été crédité sur votre solde here.tn et est immédiatement utilisable sur vos prochaines commandes.',
      'تم إضافة هذا المبلغ إلى رصيدكم على here.tn ويمكن استخدامه فورًا في طلباتكم القادمة.',
    )}</p>
  `;

  return sendEmail({
    to: client.email,
    subject,
    html: renderBrandedEmail({
      lang,
      badge: t('REMBOURSEMENT CRÉDITÉ', 'تم الاسترداد'),
      title: t('Votre remboursement a été crédité', 'تم إضافة مبلغ استردادكم'),
      bodyHtml,
      ctaLabel: t('Voir mon solde', 'عرض رصيدي'),
      ctaUrl: process.env.CLIENT_URL || 'http://localhost:5174',
    }),
  });
}

export async function envoyerRemboursementCredite(retour, lang = 'fr') {
  const commande = await Commande.findByPk(retour.commandeId);
  const client = await Utilisateur.findByPk(retour.clientId);
  if (!commande || !client) return;
  return emailRemboursementCredite(commande, client, retour, lang);
}

export function emailStatutLivraison(client, livraison, lang = 'fr') {
  const isAr = lang === 'ar';
  const statutLabels = {
    en_preparation: isAr ? 'قيد التحضير' : 'En préparation',
    expedie: isAr ? 'تم الشحن' : 'Expédié',
    en_cours_livraison: isAr ? 'قيد التوصيل' : 'En cours de livraison',
    livre: isAr ? 'تم التسليم' : 'Livré',
    retourne: isAr ? 'مرتجع' : 'Retourné',
  };

  const subject = isAr
    ? `تحديث التتبع ${livraison.trackingId}`
    : `Suivi colis ${livraison.trackingId}`;

  const html = isAr
    ? `<div dir="rtl"><p>تحديث حالة طردك: <strong>${statutLabels[livraison.statut]}</strong></p><p>رقم التتبع: ${livraison.trackingId}</p></div>`
    : `<p>Mise à jour de votre colis: <strong>${statutLabels[livraison.statut]}</strong></p><p>Tracking: ${livraison.trackingId}</p>`;

  return sendEmail({ to: client.email, subject, html });
}
