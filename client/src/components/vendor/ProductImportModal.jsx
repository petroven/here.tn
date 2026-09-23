import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileArchive,
} from 'lucide-react';
import { API_URL } from '../../config/api.js';

const STATUS_ICON = {
  ok: <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
  error: <XCircle size={16} className="text-rose-500 flex-shrink-0" />,
};

// Assistant d'import en masse (Excel/CSV, ou ZIP produits.xlsx + images/<reference>/*)
// — voir server/src/routes/vendorRoutes.js (routes /import/preview et /import/commit)
// et server/src/utils/productImport.js pour la logique de parsing/validation.
export default function ProductImportModal({ vendorId, token, language = 'fr', onClose, onImported }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'result'
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { importId, rows, summary }
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const closeAndCleanup = () => {
    if (preview?.importId && step === 'preview') {
      fetch(`${API_URL}/vendor/products/import/${preview.importId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_URL}/vendor/products/import/template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modele-import-produits.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(tr('Impossible de télécharger le modèle.', 'تعذر تحميل النموذج.'));
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('fichier', file);
      const response = await fetch(`${API_URL}/vendor/products/${vendorId}/import/preview`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || tr('Fichier invalide.', 'ملف غير صالح.'));
      setPreview(data.data);
      setStep('preview');
    } catch (err) {
      setError(err.message || tr("Erreur lors de l'analyse du fichier.", 'خطأ أثناء تحليل الملف.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleBackToUpload = async () => {
    if (preview?.importId) {
      await fetch(`${API_URL}/vendor/products/import/${preview.importId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setPreview(null);
    setError('');
    setStep('upload');
  };

  const handleCommit = async () => {
    if (!preview?.importId) return;
    setCommitting(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/vendor/products/${vendorId}/import/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ importId: preview.importId }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || tr("Erreur lors de l'import.", 'خطأ أثناء الاستيراد.'));
      setResult(data.data);
      setStep('result');
      onImported?.(data.data.produits);
    } catch (err) {
      setError(err.message || tr("Erreur lors de l'import.", 'خطأ أثناء الاستيراد.'));
    } finally {
      setCommitting(false);
    }
  };

  const importableCount = preview ? preview.summary.ok + preview.summary.warning : 0;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 font-sans">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-lg font-black text-slate-900">{tr('Importer des produits en masse', 'استيراد المنتجات بالجملة')}</h2>
            <p className="text-xs font-semibold text-slate-400">{tr('Créez des dizaines de produits en quelques minutes', 'أنشئوا عشرات المنتجات في دقائق')}</p>
          </div>
          <button onClick={closeAndCleanup} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <p className="mb-3 text-xs font-bold text-slate-600">① {tr('Téléchargez le modèle Excel', 'حمّلوا نموذج Excel')}</p>
                <button
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                >
                  <Download size={14} />
                  {tr('Télécharger le modèle (.xlsx)', 'تحميل النموذج (.xlsx)')}
                </button>
                <p className="mt-2 text-[10px] font-semibold text-slate-400">
                  {tr('Colonnes : reference, nom, description, prix, prix_avant, stock, categorie, marque', 'الأعمدة: reference, nom, description, prix, prix_avant, stock, categorie, marque')}
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-5">
                <p className="mb-3 text-xs font-bold text-slate-600">② {tr('Déposez votre fichier rempli', 'أضيفوا ملفكم المعبّأ')}</p>
                <label className={`flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 ${uploading ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}>
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? tr('Analyse en cours...', 'جارٍ التحليل...') : tr('Choisir un fichier .xlsx, .csv ou .zip', 'اختر ملف .xlsx أو .csv أو .zip')}
                  <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.zip" className="hidden" onChange={handleFileChange} disabled={uploading} />
                </label>
                <div className="mt-3 flex items-start gap-2 text-[10px] font-semibold text-slate-400">
                  <FileArchive size={26} className="flex-shrink-0 text-slate-300" />
                  <p>
                    {tr(
                      'Pour inclure des photos, déposez un .zip contenant produits.xlsx à la racine et un dossier images/ avec un sous-dossier par référence (ex : images/P001/1.jpg, 2.jpg...). La première photo de chaque dossier devient la photo de couverture.',
                      'لإضافة صور، أرفقوا ملف .zip يحتوي على produits.xlsx في الجذر ومجلد images/ يضم مجلدًا فرعيًا لكل مرجع (مثال: images/P001/1.jpg، 2.jpg...). تصبح الصورة الأولى في كل مجلد صورة الغلاف.',
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 size={14} /> {preview.summary.ok} {tr('prêts', 'جاهزة')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                  <AlertTriangle size={14} /> {preview.summary.warning} {tr('avertissement(s)', 'تنبيه(ات)')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                  <XCircle size={14} /> {preview.summary.error} {tr('erreur(s) — ignorée(s)', 'خطأ (أخطاء) — متجاهلة')}
                </span>
              </div>

              {preview.summary.ignoredHeaders?.length > 0 && (
                <p className="text-[10px] font-semibold text-slate-400">
                  {tr('Colonnes ignorées (non prises en charge) : ', 'أعمدة متجاهلة (غير مدعومة): ')}{preview.summary.ignoredHeaders.join(', ')}
                </p>
              )}

              <div className="max-h-96 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 font-bold uppercase text-slate-400">
                    <tr>
                      <th className="p-2.5">{tr('Statut', 'الحالة')}</th>
                      <th className="p-2.5">{tr('Réf.', 'المرجع')}</th>
                      <th className="p-2.5">{tr('Nom', 'الاسم')}</th>
                      <th className="p-2.5">{tr('Prix', 'السعر')}</th>
                      <th className="p-2.5">{tr('Stock', 'المخزون')}</th>
                      <th className="p-2.5">{tr('Catégorie', 'الفئة')}</th>
                      <th className="p-2.5">{tr('Photos', 'الصور')}</th>
                      <th className="p-2.5">{tr('Détails', 'التفاصيل')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {preview.rows.map((row) => (
                      <tr key={row.rowIndex} className={row.status === 'error' ? 'bg-rose-50/50' : row.status === 'warning' ? 'bg-amber-50/40' : ''}>
                        <td className="p-2.5">{STATUS_ICON[row.status]}</td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-500">{row.reference || '—'}</td>
                        <td className="p-2.5 font-bold text-slate-900">{row.nom || '—'}</td>
                        <td className="p-2.5">{row.prix != null ? `${row.prix} TND` : '—'}</td>
                        <td className="p-2.5">{row.stock}</td>
                        <td className="p-2.5">{row.categorieNom || <span className="text-slate-300">—</span>}</td>
                        <td className="p-2.5">{row.imageCount}</td>
                        <td className="max-w-xs p-2.5 text-[11px] font-medium text-slate-500">
                          {[...row.errors, ...row.warnings].join(' · ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCommit}
                  disabled={committing || importableCount === 0}
                  className="flex-1 rounded-2xl bg-terre-700 py-3 text-xs font-bold text-white shadow-lg shadow-terre-100 transition hover:bg-terre-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {committing
                    ? tr('Import en cours...', 'جارٍ الاستيراد...')
                    : tr(`Importer ${importableCount} produit(s)`, `استيراد ${importableCount} منتج(ات)`)}
                </button>
                <button
                  onClick={handleBackToUpload}
                  disabled={committing}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {tr('Annuler', 'إلغاء')}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4 py-4 text-center">
              <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
              <p className="text-lg font-black text-slate-800">
                {tr(`${result.createdCount} produit(s) créé(s) avec succès`, `تم إنشاء ${result.createdCount} منتج(ات) بنجاح`)}
              </p>
              {(result.skippedRows.length > 0 || result.commitErrors.length > 0) && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900">
                  <p className="mb-1.5 font-bold">{tr('Non importés :', 'لم يتم استيرادها:')}</p>
                  <ul className="space-y-1">
                    {result.skippedRows.map((r) => (
                      <li key={`s-${r.rowIndex}`}>• {r.nom || r.reference || `${tr('Ligne', 'السطر')} ${r.rowIndex}`} — {r.errors.join(', ')}</li>
                    ))}
                    {result.commitErrors.map((r) => (
                      <li key={`c-${r.rowIndex}`}>• {r.nom || r.reference || `${tr('Ligne', 'السطر')} ${r.rowIndex}`} — {r.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button onClick={onClose} className="w-full rounded-2xl bg-terre-700 py-3 text-xs font-bold text-white shadow-lg shadow-terre-100 transition hover:bg-terre-800">
                {tr('Terminé', 'تم')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
