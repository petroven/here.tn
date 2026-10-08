import { useEffect, useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_URL } from '../../config/api.js';

const ENTITES = ['', 'Boutique', 'Commande', 'Retrait', 'Paiement', 'Retour', 'Produit', 'Avis', 'Categorie'];

const ACTIONS = {
  'kyc.valider': { fr: 'KYC validé', ar: 'تم قبول التحقق' },
  'kyc.rejeter': { fr: 'KYC refusé', ar: 'تم رفض التحقق' },
  'boutique.validee': { fr: 'Boutique validée', ar: 'تم قبول المتجر' },
  'boutique.suspendue': { fr: 'Boutique suspendue', ar: 'تم إيقاف المتجر' },
  'boutique.en_attente': { fr: 'Boutique remise en attente', ar: 'المتجر قيد الانتظار' },
  'commande.statut': { fr: 'Statut de commande modifié', ar: 'تعديل حالة الطلب' },
  'retrait.approuve': { fr: 'Retrait approuvé', ar: 'تمت الموافقة على السحب' },
  'retrait.verse': { fr: 'Retrait versé', ar: 'تم دفع السحب' },
  'retrait.rejete': { fr: 'Retrait refusé', ar: 'تم رفض السحب' },
  'virement.valider': { fr: 'Virement validé', ar: 'تم قبول التحويل' },
  'virement.rejeter': { fr: 'Virement rejeté', ar: 'تم رفض التحويل' },
  'retour.approuve': { fr: 'Retour approuvé', ar: 'تمت الموافقة على الإرجاع' },
  'retour.refuse': { fr: 'Retour refusé', ar: 'تم رفض الإرجاع' },
  'retour.rembourse': { fr: 'Retour remboursé', ar: 'تم استرداد الإرجاع' },
  'produit.statut': { fr: 'Statut produit modifié', ar: 'تعديل حالة المنتج' },
  'produit.supprimer': { fr: 'Produit supprimé', ar: 'تم حذف المنتج' },
  'avis.publier': { fr: 'Avis publié', ar: 'تم نشر التقييم' },
  'avis.masquer': { fr: 'Avis masqué', ar: 'تم إخفاء التقييم' },
  'categorie.image': { fr: 'Photo de catégorie modifiée', ar: 'تعديل صورة الفئة' },
};

// Différences avant → après, limitées aux champs qui ont changé.
function differences(avant, apres) {
  if (!avant && !apres) return [];
  const cles = new Set([...Object.keys(avant || {}), ...Object.keys(apres || {})]);
  return [...cles]
    .filter((cle) => JSON.stringify(avant?.[cle]) !== JSON.stringify(apres?.[cle]))
    .map((cle) => ({ cle, avant: avant?.[cle], apres: apres?.[cle] }));
}

/** Journal d'audit des actions admin — GET /admin/audit-logs (paginé). */
export default function AdminAuditLog({ token, language = 'fr' }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const locale = isAr ? 'ar-TN' : 'fr-TN';
  const [entite, setEntite] = useState('');
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState({ data: [], pagination: { total: 0, limit: 50 } });
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    setChargement(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (entite) params.set('entite', entite);
    fetch(`${API_URL}/admin/audit-logs?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setDonnees(d); })
      .catch(() => {})
      .finally(() => setChargement(false));
  }, [entite, page, token]);

  const pages = Math.max(1, Math.ceil((donnees.pagination?.total || 0) / (donnees.pagination?.limit || 50)));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900"><ScrollText size={18} /> {tr("Journal d'audit", 'سجل التدقيق')}</h2>
          <p className="mt-1 text-xs text-slate-500">{tr('Toutes les actions sensibles des administrateurs, non modifiables.', 'جميع الإجراءات الحساسة للمشرفين، غير قابلة للتعديل.')}</p>
        </div>
        <select
          value={entite}
          onChange={(e) => { setPage(1); setEntite(e.target.value); }}
          className="input-premium px-3 py-2 text-xs font-bold"
          aria-label={tr('Filtrer par élément', 'تصفية حسب العنصر')}
        >
          {ENTITES.map((e) => <option key={e} value={e}>{e || tr('Tous les éléments', 'كل العناصر')}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{tr('Date', 'التاريخ')}</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{tr('Administrateur', 'المشرف')}</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{tr('Action', 'الإجراء')}</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{tr('Élément', 'العنصر')}</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500">{tr('Changement', 'التغيير')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {donnees.data.map((entree) => {
              const libelle = ACTIONS[entree.action];
              return (
                <tr key={entree.id} className="align-top hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500">
                    {new Date(entree.createdAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-700">
                    {entree.acteur ? `${entree.acteur.prenom} ${entree.acteur.nom}` : tr('Système', 'النظام')}
                    {entree.ip && <span className="block font-mono text-[10px] text-slate-400">{entree.ip}</span>}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-slate-800">{libelle ? tr(libelle.fr, libelle.ar) : entree.action}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{entree.entite} #{entree.entiteId}</td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {differences(entree.avant, entree.apres).map((d) => (
                      <div key={d.cle}>
                        <span className="font-semibold text-slate-500">{d.cle}</span>{' : '}
                        <span className="text-slate-400 line-through">{String(d.avant ?? '—')}</span>{' → '}
                        <span className="font-bold text-slate-800">{String(d.apres ?? '—')}</span>
                      </div>
                    ))}
                    {entree.commentaire && <p className="mt-1 italic text-slate-500">« {entree.commentaire} »</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!chargement && donnees.data.length === 0 && (
        <p className="p-8 text-center text-sm text-slate-500">{tr('Aucune action journalisée.', 'لا توجد إجراءات مسجلة.')}</p>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-3 text-xs font-bold text-slate-600">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label={tr('Page précédente', 'الصفحة السابقة')}>
            <ChevronLeft size={16} />
          </button>
          {page} / {pages}
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-30" aria-label={tr('Page suivante', 'الصفحة التالية')}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
