import React, { useState } from 'react';
import { Truck, Search, CheckCircle2, Clock, MapPin, AlertCircle } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function TrackingPage({ language = 'fr' }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const locale = isAr ? 'ar-TN' : 'fr-TN';

  const [trackingId, setTrackingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/livraisons/track/${trackingId.trim()}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || tr('ID de suivi incorrect ou introuvable.', 'رمز التتبع غير صحيح أو غير موجود.'));
      }
      setResult(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { key: 'en_preparation', label: tr('En préparation', 'قيد التحضير'), desc: tr('Le vendeur prépare votre colis.', 'البائع يقوم بتحضير طردك.') },
    { key: 'expedie', label: tr('Expédié', 'تم الشحن'), desc: tr('Le colis a été remis au transporteur.', 'تم تسليم الطرد إلى شركة النقل.') },
    { key: 'en_cours_livraison', label: tr('En cours de livraison', 'قيد التوصيل'), desc: tr('Le livreur est en route.', 'عامل التوصيل في الطريق.') },
    { key: 'livre', label: tr('Livré', 'تم التسليم'), desc: tr('Le colis a été remis au destinataire.', 'تم تسليم الطرد إلى المستلم.') },
  ];

  const getStepIndex = (statut) => {
    if (statut === 'retourne') return -1;
    return steps.findIndex((s) => s.key === statut);
  };

  const currentStepIndex = result ? getStepIndex(result.statut) : 0;

  return (
    <div className="mx-auto max-w-3xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#6366F1]">
            <Truck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{tr('Suivre mon colis', 'تتبع طردي')}</h1>
            <p className="text-sm text-slate-500">{tr('Entrez votre code de suivi Tunisie Poste / Aramex', 'أدخل رمز التتبع الخاص بك')}</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-8 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400 rtl:left-auto rtl:right-4" size={20} />
            <input
              type="text"
              placeholder={tr('Ex: MPTN-LS7X8W-9Z2B', 'مثال: MPTN-LS7X8W-9Z2B')}
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3.5 pl-12 pr-4 text-sm outline-none transition focus:border-transparent focus:ring-2 focus:ring-indigo-500 rtl:pl-4 rtl:pr-12"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-[#6366F1] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#4F46E5] disabled:opacity-50"
          >
            {loading ? tr('Recherche...', 'جارٍ البحث...') : tr('Rechercher', 'بحث')}
          </button>
        </form>

        {error && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle className="flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-8">
            {/* Info Summary */}
            <div className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-6 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{tr('Transporteur', 'الناقل')}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{result.transporteur || 'Aramex TN'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{tr('Numéro AWB', 'رقم AWB')}</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{result.awbNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{tr('Statut actuel', 'الحالة الحالية')}</p>
                <p className="mt-1 text-sm font-bold uppercase text-[#6366F1]">
                  {result.statut === 'retourne' ? tr('Retourné au vendeur', 'أُعيد إلى البائع') : steps[currentStepIndex]?.label}
                </p>
              </div>
            </div>

            {/* Stepper */}
            {result.statut === 'retourne' ? (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
                <AlertCircle className="flex-shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">{tr('Colis retourné au vendeur', 'تم إرجاع الطرد إلى البائع')}</p>
                  <p className="mt-1">
                    {tr("La livraison a échoué ou a été refusée par le client. Le colis a été retourné à la boutique d'origine.", 'فشل التوصيل أو تم رفضه من قبل العميل. تم إرجاع الطرد إلى المتجر الأصلي.')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative ml-4 space-y-8 border-l-2 border-slate-100 py-2 pl-8 rtl:ml-0 rtl:mr-4 rtl:border-l-0 rtl:border-r-2 rtl:pl-0 rtl:pr-8">
                {steps.map((step, index) => {
                  const isDone = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;

                  return (
                    <div key={step.key} className="relative">
                      {/* Icon Indicator */}
                      <span
                        className={`absolute -left-12 top-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 transition rtl:-left-auto rtl:-right-12 ${
                          isDone
                            ? 'border-[#6366F1] bg-[#6366F1] text-white shadow-lg shadow-indigo-100'
                            : 'border-slate-200 bg-white text-slate-400'
                        }`}
                      >
                        {isDone ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                      </span>

                      <div>
                        <h3 className={`text-sm font-bold ${isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                          {step.label}
                          {isCurrent && (
                            <span className="ml-2 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4F46E5] rtl:ml-0 rtl:mr-2">
                              {tr('En cours', 'جارٍ')}
                            </span>
                          )}
                        </h3>
                        <p className={`mt-1 text-xs ${isDone ? 'text-slate-500' : 'text-slate-400'}`}>
                          {step.desc}
                        </p>

                        {result.historiqueStatuts?.find((h) => h.statut === step.key) && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            {tr('Mis à jour le', 'آخر تحديث')} :{' '}
                            {new Date(
                              result.historiqueStatuts.find((h) => h.statut === step.key).date
                            ).toLocaleString(locale)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
