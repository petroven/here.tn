import React from 'react';

const TONES = {
  violet: 'bg-[#F5F3FF] text-[#7C3AED]',
  blue: 'bg-blue-50 text-blue-600',
  rose: 'bg-rose-50 text-rose-600',
  green: 'bg-emerald-50 text-emerald-700',
  orange: 'bg-orange-50 text-orange-600',
  amber: 'bg-amber-50 text-amber-700',
  slate: 'bg-slate-100 text-slate-600',
  glass: 'glass-badge text-slate-800',
  promo: 'bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-sm',
};

export default function Badge({ tone = 'violet', icon: Icon, className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONES[tone]} ${className}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}
