// Libellés et étapes des commandes — miroir de server/src/utils/orderStatus.js
// (machine d'états). Partagé par l'espace client, vendeur et admin.

export const STATUT_LABELS = {
  en_attente: { fr: 'En attente', ar: 'قيد الانتظار' },
  payee: { fr: 'Payée', ar: 'مدفوعة' },
  preparation: { fr: 'En préparation', ar: 'قيد التحضير' },
  expediee: { fr: 'Expédiée', ar: 'تم الشحن' },
  en_cours_livraison: { fr: 'En livraison', ar: 'في الطريق' },
  livree: { fr: 'Livrée', ar: 'تم التسليم' },
  annulee: { fr: 'Annulée', ar: 'ملغاة' },
  retour: { fr: 'Retour demandé', ar: 'طلب إرجاع' },
  litige: { fr: 'Retour en médiation', ar: 'إرجاع قيد الوساطة' },
  retournee: { fr: 'Remboursée', ar: 'تم الاسترداد' },
};

// Libellé d'une ligne d'historique (événement daté).
export const EVENEMENT_LABELS = {
  en_attente: { fr: 'Commande passée', ar: 'تم تقديم الطلب' },
  payee: { fr: 'Paiement confirmé', ar: 'تم تأكيد الدفع' },
  preparation: { fr: 'Préparation', ar: 'التحضير' },
  expediee: { fr: 'Expédiée', ar: 'تم الشحن' },
  en_cours_livraison: { fr: 'En livraison', ar: 'في الطريق' },
  livree: { fr: 'Livrée', ar: 'تم التسليم' },
  annulee: { fr: 'Annulée', ar: 'ملغاة' },
  retour: { fr: 'Retour demandé', ar: 'طلب إرجاع' },
  litige: { fr: 'Retour en médiation', ar: 'إرجاع قيد الوساطة' },
  retournee: { fr: 'Remboursement effectué', ar: 'تم الاسترداد' },
};

// Couleur de pastille par statut (classes Tailwind).
export const STATUT_TONES = {
  en_attente: 'bg-slate-100 text-slate-700',
  payee: 'bg-sky-50 text-sky-700',
  preparation: 'bg-amber-50 text-amber-700',
  expediee: 'bg-indigo-50 text-indigo-700',
  en_cours_livraison: 'bg-violet-50 text-violet-700',
  livree: 'bg-emerald-50 text-emerald-700',
  annulee: 'bg-rose-50 text-rose-700',
  retour: 'bg-orange-50 text-orange-700',
  litige: 'bg-red-50 text-red-700',
  retournee: 'bg-slate-100 text-slate-600',
};

const PARCOURS = ['en_attente', 'payee', 'preparation', 'expediee', 'en_cours_livraison', 'livree'];

/**
 * Étapes affichées dans la barre de progression. Une commande COD n'est
 * jamais « payée » avant la livraison : l'étape est remplacée par
 * « Confirmée ». Renvoie [{ cle, fr, ar, etat: 'faite'|'courante'|'a_venir', date }].
 */
export function etapesCommande(order) {
  const historique = order.historique || [];
  const estCod = order.paiement?.methode === 'cod';
  const atteints = new Map();
  for (const h of historique) {
    if (!atteints.has(h.nouveauStatut)) atteints.set(h.nouveauStatut, h.createdAt);
  }
  const confirmation = historique.find((h) => /confirmée par le client/i.test(h.commentaire || ''));

  const etapes = [
    { cle: 'en_attente', fr: 'Commande passée', ar: 'تم تقديم الطلب' },
    estCod
      ? { cle: 'confirmee', fr: 'Confirmée', ar: 'تم التأكيد' }
      : { cle: 'payee', fr: 'Paiement confirmé', ar: 'تم تأكيد الدفع' },
    { cle: 'preparation', fr: 'Préparation', ar: 'التحضير' },
    { cle: 'expediee', fr: 'Expédiée', ar: 'تم الشحن' },
    { cle: 'en_cours_livraison', fr: 'En livraison', ar: 'في الطريق' },
    { cle: 'livree', fr: 'Livrée', ar: 'تم التسليم' },
  ];

  // Rang atteint sur le parcours principal (les statuts de retour impliquent
  // une livraison préalable).
  const statutRang = ['retour', 'litige', 'retournee'].includes(order.statut) ? 'livree' : order.statut;
  const rangActuel = PARCOURS.indexOf(statutRang);

  const avecEtat = etapes.map((etape, index) => {
    if (etape.cle === 'confirmee') {
      return {
        ...etape,
        date: confirmation?.createdAt || null,
        faite: Boolean(confirmation) || order.confirmationStatut === 'confirmee' || rangActuel >= 2,
      };
    }
    return { ...etape, date: atteints.get(etape.cle) || null, faite: index <= rangActuel };
  });
  // Étape courante = la première pas encore franchie (aucune si la commande
  // est annulée : le parcours s'arrête là).
  const indexCourant = order.statut === 'annulee' ? -1 : avecEtat.findIndex((e) => !e.faite);
  return avecEtat.map(({ faite, ...etape }, index) => ({
    ...etape,
    etat: faite ? 'faite' : (index === indexCourant ? 'courante' : 'a_venir'),
  }));
}

export function libelleStatut(statut, language = 'fr') {
  const l = STATUT_LABELS[statut];
  return l ? l[language === 'ar' ? 'ar' : 'fr'] : statut;
}
