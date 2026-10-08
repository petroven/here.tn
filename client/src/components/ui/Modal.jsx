import React, { useId } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog.js';

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  const titleId = useId();
  const dialog = useDialog(open, onClose, title ? titleId : undefined);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 animate-fadeIn"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div {...dialog} className={`glass w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-soft`}>
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 id={titleId} className="text-lg font-black text-slate-900">{title}</h2>
            <button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
