import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function OAuthCallbackPage({ onSuccess }) {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const oauthError = params.get('error');

    // Clear the token/error from the URL immediately — it's single-use,
    // it shouldn't linger in history or get shared via a copied link.
    window.history.replaceState({}, '', window.location.pathname.replace(/\/oauth\/callback.*/, '/'));

    if (oauthError) {
      setError(oauthError);
      return;
    }

    const payload = token ? decodeJwtPayload(token) : null;
    if (!token || !payload) {
      setError("Connexion impossible : le lien de retour est invalide.");
      return;
    }

    localStorage.setItem('token', token);
    localStorage.setItem('userId', payload.id);
    localStorage.setItem('userRole', payload.role);

    onSuccess({ id: payload.id, role: payload.role });
  }, [onSuccess]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft">
        {error ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertCircle size={24} />
            </div>
            <h1 className="text-lg font-black text-slate-900">Connexion échouée</h1>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <a href="/" className="mt-6 inline-block rounded-xl bg-[#6366F1] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#4F46E5]">
              Retour à l'accueil
            </a>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto mb-4 animate-spin text-[#6366F1]" size={32} />
            <p className="text-sm font-semibold text-slate-600">Connexion en cours...</p>
          </>
        )}
      </div>
    </div>
  );
}
