import React from 'react';

export default function Input({ icon: Icon, className = '', containerClassName = '', ...props }) {
  return (
    <div className={`relative ${containerClassName}`}>
      {Icon && <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 rtl:left-auto rtl:right-3.5" />}
      <input
        className={`input-premium w-full py-2.5 text-sm text-slate-800 outline-none ${Icon ? 'pl-10 pr-3.5 rtl:pl-3.5 rtl:pr-10' : 'px-3.5'} ${className}`}
        {...props}
      />
    </div>
  );
}
