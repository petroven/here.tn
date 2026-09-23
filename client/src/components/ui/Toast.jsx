import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

// Petit store module-level (pas de Context/Provider à câbler dans l'arbre) —
// toast.success('...')/toast.error('...') depuis n'importe quel composant,
// <ToastHost/> monté une fois par coquille (MainShell côté client,
// VendorDashboard côté vendeur, ce sont deux arbres React indépendants).
let listeners = [];
let nextId = 1;

function push(message, tone) {
  const id = nextId++;
  const item = { id, message, tone };
  listeners.forEach((fn) => fn((current) => [...current, item]));
  setTimeout(() => {
    listeners.forEach((fn) => fn((current) => current.filter((t) => t.id !== id)));
  }, 3200);
}

export const toast = {
  success: (message) => push(message, 'success'),
  error: (message) => push(message, 'error'),
};

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    listeners.push(setToasts);
    return () => { listeners = listeners.filter((fn) => fn !== setToasts); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold shadow-lg animate-fadeIn ${
            t.tone === 'error' ? 'bg-rose-600 text-white' : 'bg-[#1E1B18] text-white'
          }`}
        >
          {t.tone === 'error' ? <XCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
