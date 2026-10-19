import { useEffect, useRef, useState } from 'react';
import { ImagePlus, RotateCcw, LayoutGrid } from 'lucide-react';
import { API_URL, absoluteImageUrl } from '../../config/api.js';

/**
 * Photos des catégories principales (pastilles de l'accueil du site et de
 * l'app). Envoi via POST /upload, puis PATCH /admin/categories/:id.
 */
export default function AdminCategories({ token, language = 'fr' }) {
  const tr = (fr, ar) => (language === 'ar' ? ar : fr);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState(null);
  const inputs = useRef({});

  const load = () =>
    fetch(`${API_URL}/categories`)
      .then((r) => r.json())
      .then((data) => { if (data.success) setCategories(data.data); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const save = async (categorie, image) => {
    const response = await fetch(`${API_URL}/admin/categories/${categorie.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Erreur');
    setCategories((list) => list.map((c) => (c.id === categorie.id ? { ...c, image } : c)));
  };

  const upload = async (categorie, file) => {
    if (!file) return;
    setBusyId(categorie.id);
    setMessage(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Erreur');
      await save(categorie, data.url);
      setMessage({ type: 'ok', text: tr(`Photo de « ${categorie.nom} » mise à jour.`, `تم تحديث صورة « ${categorie.nom} ».`) });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const reset = async (categorie) => {
    setBusyId(categorie.id);
    setMessage(null);
    try {
      await save(categorie, null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">{tr('Chargement…', 'جارٍ التحميل…')}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-slate-900">{tr('Photos des catégories', 'صور الفئات')}</h2>
        <p className="text-sm text-slate-500">
          {tr(
            "Affichées en pastilles rondes sur l'accueil du site et de l'application. Sans photo, c'est celle d'un produit de la catégorie qui s'affiche.",
            'تظهر في الصفحة الرئيسية للموقع والتطبيق. بدون صورة، تُعرض صورة أحد منتجات الفئة.',
          )}
        </p>
      </div>
      {message && (
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.text}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((categorie) => (
          <div key={categorie.id} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center">
            <span className="h-24 w-24 overflow-hidden rounded-full border-2 border-white shadow-soft ring-1 ring-[#E2D9CB]">
              {categorie.image ? (
                <img loading="lazy" decoding="async" src={absoluteImageUrl(categorie.image)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#F8E4DE] text-[#C4532C]"><LayoutGrid size={28} /></span>
              )}
            </span>
            <p className="line-clamp-2 min-h-[2.5rem] text-sm font-bold text-slate-800">{categorie.nom}</p>
            <input
              ref={(el) => { inputs.current[categorie.id] = el; }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { upload(categorie, e.target.files?.[0]); e.target.value = ''; }}
            />
            <div className="flex w-full flex-col gap-1.5">
              <button
                onClick={() => inputs.current[categorie.id]?.click()}
                disabled={busyId === categorie.id}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C4532C] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#994122] disabled:opacity-50"
              >
                <ImagePlus size={14} /> {busyId === categorie.id ? tr('Envoi…', 'جارٍ الإرسال…') : tr('Changer la photo', 'تغيير الصورة')}
              </button>
              {categorie.image && (
                <button
                  onClick={() => reset(categorie)}
                  disabled={busyId === categorie.id}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <RotateCcw size={13} /> {tr('Retirer', 'إزالة')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
