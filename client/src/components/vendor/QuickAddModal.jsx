import React, { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, Loader2, CheckCircle2, XCircle, RotateCcw, Trash2 } from 'lucide-react';
import { API_URL } from '../../config/api.js';
import { useDialog } from '../../hooks/useDialog.js';

// Ajout rapide par photos : le vendeur sélectionne plusieurs photos d'un coup,
// chaque photo devient une fiche (nom pré-rempli depuis le nom du fichier) ;
// il ne reste qu'à taper le prix. Publication en parallèle (3 à la fois),
// photos compressées dans le navigateur avant l'envoi (connexions lentes),
// nouvelle tentative automatique en cas de coupure réseau ; une photo déjà
// envoyée n'est jamais renvoyée lors d'un « Réessayer ».
const CONCURRENCY = 3;
const MAX_SIDE = 1600;
const MAX_PHOTOS = 60;

/** Nom de produit lisible à partir d'un nom de fichier (« robe_rouge-2.jpg » → « Robe rouge 2 »). */
function nameFromFile(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Noms d'appareil photo (IMG_2024…, WhatsApp Image…, DSC0001) : rien d'utile à reprendre.
  if (/^(img|image|dsc|pxl|photo|whatsapp|screenshot|capture)\b/i.test(base) || /^\d+$/.test(base)) return '';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Redimensionne en JPEG (≤ 1600 px) : 4–8 Mo depuis un téléphone → ~300 Ko. */
async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // format non décodable par le navigateur (HEIC…) : le serveur s'en charge
  }
}

/** Requête avec 2 nouvelles tentatives sur erreur réseau / 5xx. */
async function fetchWithRetry(url, options, tries = 3) {
  let lastError;
  for (let attempt = 0; attempt < tries; attempt++) {
    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      lastError = err; // coupure réseau : on réessaie
    }
    if (response) {
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success !== false) return data;
      lastError = new Error(data.message || `Erreur ${response.status}`);
      if (response.status < 500) throw lastError; // erreur de saisie : inutile de réessayer
    }
    if (attempt < tries - 1) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw lastError;
}

let nextId = 1;

export default function QuickAddModal({ vendorId, token, categories = [], language = 'fr', onClose, onCreated }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const dialog = useDialog(true, () => onClose(), 'quick-add-title');

  const [items, setItems] = useState([]);
  const [categorieId, setCategorieId] = useState('');
  const [defaultStock, setDefaultStock] = useState('1');
  const [publishing, setPublishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Libère les aperçus à la fermeture.
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.preview)), []);

  const patch = (id, changes) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...changes } : it)));

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_PHOTOS - itemsRef.current.length;
    const added = files.slice(0, Math.max(0, room)).map((file) => ({
      id: nextId++,
      file,
      preview: URL.createObjectURL(file),
      nom: nameFromFile(file.name),
      prix: '',
      stock: '',
      // Clé d'idempotence : une nouvelle tentative ne crée jamais de doublon.
      key: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: 'draft', // draft | sending | done | error
      error: '',
      imageUrl: null,
    }));
    setItems((list) => [...list, ...added]);
  };

  const remove = (id) => {
    setItems((list) => {
      const it = list.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.preview);
      return list.filter((x) => x.id !== id);
    });
  };

  const isValid = (it) => it.nom.trim().length >= 2 && Number(it.prix) > 0;
  const toSend = items.filter((it) => it.status !== 'done' && isValid(it));
  const doneCount = items.filter((it) => it.status === 'done').length;
  const invalidCount = items.filter((it) => it.status !== 'done' && !isValid(it)).length;

  const publishOne = async (it) => {
    patch(it.id, { status: 'sending', error: '' });
    try {
      let imageUrl = it.imageUrl;
      if (!imageUrl) {
        const formData = new FormData();
        formData.append('image', await compressImage(it.file));
        const up = await fetchWithRetry(`${API_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        imageUrl = up.url;
        patch(it.id, { imageUrl });
      }
      const nom = it.nom.trim();
      const stock = it.stock !== '' ? it.stock : defaultStock;
      await fetchWithRetry(`${API_URL}/vendor/products/${vendorId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'Idempotency-Key': it.key },
        body: JSON.stringify({
          nom,
          description: nom,
          prix: Number(it.prix),
          stock: Number(stock || 0),
          image: imageUrl,
          images: [imageUrl],
          categorieId: categorieId || null,
        }),
      });
      patch(it.id, { status: 'done' });
    } catch (err) {
      patch(it.id, { status: 'error', error: err.message || tr('Échec', 'فشل') });
    }
  };

  const publishAll = async () => {
    const queue = [...toSend];
    if (!queue.length) return;
    setPublishing(true);
    const worker = async () => {
      while (queue.length) await publishOne(queue.shift());
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
    setPublishing(false);
    onCreated?.();
  };

  const allDone = items.length > 0 && doneCount === items.length;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 font-sans">
      <div {...dialog} className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 id="quick-add-title" className="text-lg font-black text-slate-900">{tr('Ajout rapide par photos', 'إضافة سريعة بالصور')}</h2>
            <p className="text-xs font-semibold text-slate-400">
              {tr('Une photo = un produit. Tapez le nom et le prix, publiez tout d’un coup.', 'صورة = منتج. اكتبوا الاسم والسعر وانشروا الكل دفعة واحدة.')}
            </p>
          </div>
          <button onClick={onClose} disabled={publishing} aria-label={tr('Fermer', 'إغلاق')} className="text-slate-400 hover:text-slate-600 disabled:opacity-40">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Réglages communs à toutes les fiches */}
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              aria-label={tr('Catégorie pour tous les produits', 'الفئة لكل المنتجات')}
              value={categorieId}
              onChange={(e) => setCategorieId(e.target.value)}
              disabled={publishing}
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm focus:ring-2 focus:ring-terre-700"
            >
              <option value="">{tr('Catégorie (pour tous)', 'الفئة (للكل)')}</option>
              {categories.map((univers) => (
                <optgroup key={univers.id} label={univers.nom}>
                  {(univers.sousCategories || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              type="number"
              min="0"
              aria-label={tr('Stock par défaut', 'المخزون الافتراضي')}
              placeholder={tr('Stock par défaut', 'المخزون الافتراضي')}
              value={defaultStock}
              onChange={(e) => setDefaultStock(e.target.value)}
              disabled={publishing}
              className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm outline-none focus:ring-2 focus:ring-terre-700"
            />
          </div>

          {/* Zone de dépôt */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-terre-700 bg-terre-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
          >
            <ImagePlus size={28} className="text-terre-700" />
            <span className="text-sm font-bold text-slate-700">{tr('Choisir ou glisser des photos', 'اختاروا أو اسحبوا الصور')}</span>
            <span className="text-[11px] font-semibold text-slate-400">
              {tr(`Jusqu’à ${MAX_PHOTOS} photos · compressées automatiquement`, `حتى ${MAX_PHOTOS} صورة · تُضغط تلقائيًا`)}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              className="hidden"
              disabled={publishing}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </label>

          {items.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => {
                const locked = publishing || it.status === 'done' || it.status === 'sending';
                return (
                  <li key={it.id} className={`overflow-hidden rounded-xl border ${it.status === 'error' ? 'border-rose-300' : it.status === 'done' ? 'border-emerald-300' : 'border-slate-200'}`}>
                    <div className="relative aspect-square bg-slate-100">
                      <img src={it.preview} alt="" className="h-full w-full object-cover" />
                      {it.status === 'sending' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60"><Loader2 className="animate-spin text-terre-700" size={28} /></div>
                      )}
                      {it.status === 'done' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/70"><CheckCircle2 className="text-emerald-600" size={32} /></div>
                      )}
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          aria-label={tr('Retirer', 'إزالة')}
                          className="absolute end-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-500 shadow hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <input
                        value={it.nom}
                        onChange={(e) => patch(it.id, { nom: e.target.value })}
                        disabled={locked}
                        placeholder={tr('Nom du produit', 'اسم المنتج')}
                        aria-label={tr('Nom du produit', 'اسم المنتج')}
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-terre-700"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.001"
                          value={it.prix}
                          onChange={(e) => patch(it.id, { prix: e.target.value })}
                          disabled={locked}
                          placeholder={tr('Prix TND', 'السعر د.ت')}
                          aria-label={tr('Prix en TND', 'السعر بالدينار')}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-terre-700"
                        />
                        <input
                          type="number"
                          min="0"
                          value={it.stock}
                          onChange={(e) => patch(it.id, { stock: e.target.value })}
                          disabled={locked}
                          placeholder={`${tr('Stock', 'المخزون')} ${defaultStock || 0}`}
                          aria-label={tr('Stock', 'المخزون')}
                          className="w-24 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-terre-700"
                        />
                      </div>
                      {it.status === 'error' && (
                        <p className="flex items-start gap-1 text-[11px] font-semibold text-rose-600">
                          <XCircle size={13} className="mt-0.5 flex-shrink-0" /> {it.error}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 p-4">
            <p className="flex-1 text-xs font-semibold text-slate-500">
              {doneCount > 0 && <span className="text-emerald-700">{tr(`${doneCount} publié(s)`, `${doneCount} منشور`)} · </span>}
              {invalidCount > 0
                ? tr(`${invalidCount} fiche(s) sans nom ou prix`, `${invalidCount} بطاقة بدون اسم أو سعر`)
                : tr(`${toSend.length} prêt(s) à publier`, `${toSend.length} جاهز للنشر`)}
            </p>
            {allDone ? (
              <button onClick={onClose} className="rounded-2xl bg-terre-700 px-6 py-3 text-xs font-bold text-white hover:bg-terre-800">
                {tr('Terminé', 'تم')}
              </button>
            ) : (
              <button
                onClick={publishAll}
                disabled={publishing || toSend.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-terre-700 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-terre-100 hover:bg-terre-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : items.some((it) => it.status === 'error') ? <RotateCcw size={14} /> : null}
                {publishing
                  ? tr('Publication…', 'جارٍ النشر…')
                  : tr(`Publier ${toSend.length} produit(s)`, `نشر ${toSend.length} منتج`)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
