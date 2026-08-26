import React, { useEffect, useState } from 'react';
import { Ticket, ArrowLeft, Copy, Check } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function CouponsPage({ language = 'fr', onBack }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/coupons/actifs`)
      .then((response) => response.json())
      .then((data) => { if (data.success) setCoupons(data.data); })
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 2000);
    });
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-3xl p-4 pb-24 sm:p-6 md:pb-6 font-sans">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50">
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Ticket size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">{tr("Bons d'achat", 'قسائم الشراء')}</h1>
          <p className="text-sm text-slate-500">{tr('Codes promo disponibles à utiliser au checkout', 'رموز الخصم المتاحة لاستخدامها عند الدفع')}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-soft">
          <p className="text-slate-500">{tr('Aucun bon disponible pour le moment.', 'لا توجد قسائم متاحة حاليًا.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div key={coupon.code} className="flex items-center justify-between rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-5">
              <div>
                <p className="font-mono text-lg font-black tracking-wide text-slate-900">{coupon.code}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {coupon.type === 'pourcentage' ? `-${coupon.valeur}%` : `-${Number(coupon.valeur).toFixed(3)} TND`}
                  {coupon.montantMinimum > 0 && ` · ${tr('dès', 'ابتداءً من')} ${Number(coupon.montantMinimum).toFixed(3)} TND`}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {tr('Expire le', 'ينتهي في')} {new Date(coupon.dateExpiration).toLocaleDateString(isAr ? 'ar-TN' : 'fr-TN')}
                </p>
              </div>
              <button
                onClick={() => handleCopy(coupon.code)}
                className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700"
              >
                {copiedCode === coupon.code ? <Check size={14} /> : <Copy size={14} />}
                {copiedCode === coupon.code ? tr('Copié', 'تم النسخ') : tr('Copier', 'نسخ')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
