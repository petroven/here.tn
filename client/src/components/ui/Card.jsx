import React from 'react';

export default function Card({ as: Tag = 'div', hover = true, className = '', children, ...props }) {
  return (
    <Tag className={`${hover ? 'card-premium' : 'rounded-2xl border border-slate-200 bg-white'} ${className}`} {...props}>
      {children}
    </Tag>
  );
}
