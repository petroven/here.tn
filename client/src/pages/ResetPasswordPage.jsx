import React, { useState, useEffect } from 'react';
import { KeyRound, Mail, ShieldAlert, CheckCircle } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (t) {
      setToken(t);
    }
  }, []);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de la demande.');
      }
      setStatus({
        type: 'success',
        message: 'Si cet email est inscrit, un lien de réinitialisation vous a été envoyé.',
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'Les mots de passe ne correspondent pas.' });
      return;
    }

    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Le lien a expiré ou est invalide.');
      }
      setStatus({
        type: 'success',
        message: 'Votre mot de passe a été modifié avec succès! Redirection...',
      });
      setTimeout(() => {
        window.location.href = '/';
      }, 2500);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft max-w-md w-full p-8">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-[#EEF2FF] text-[#6366F1] rounded-2xl flex items-center justify-center">
            <KeyRound size={24} />
          </div>
        </div>

        {token ? (
          // Reset Password form
          <form onSubmit={handleReset} className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900 text-center">Nouveau mot de passe</h1>
            <p className="text-slate-500 text-sm text-center mb-6">
              Choisissez un mot de passe sécurisé à 6 caractères minimum.
            </p>

            {status.message && (
              <div
                className={`p-4 rounded-2xl border text-sm flex gap-3 text-left ${
                  status.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {status.type === 'success' ? (
                  <CheckCircle className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="text-rose-600 flex-shrink-0" />
                )}
                <span>{status.message}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Mot de passe</label>
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-slate-50/50"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Confirmer le mot de passe</label>
              <input
                type="password"
                placeholder="••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-slate-50/50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50 text-sm mt-2"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        ) : (
          // Request reset token form
          <form onSubmit={handleRequestReset} className="space-y-4">
            <h1 className="text-2xl font-black text-slate-900 text-center">Mot de passe oublié</h1>
            <p className="text-slate-500 text-sm text-center mb-6">
              Saisissez l'adresse e-mail de votre compte pour recevoir un lien de réinitialisation.
            </p>

            {status.message && (
              <div
                className={`p-4 rounded-2xl border text-sm flex gap-3 text-left ${
                  status.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {status.type === 'success' ? (
                  <CheckCircle className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="text-rose-600 flex-shrink-0" />
                )}
                <span>{status.message}</span>
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="Votre adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50/50"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-bold py-3 px-4 rounded-xl transition disabled:opacity-50 text-sm mt-2"
            >
              {loading ? 'Envoi en cours...' : 'Envoyer les instructions'}
            </button>

            <div className="text-center pt-4">
              <a href="/" className="text-xs font-semibold text-slate-500 hover:text-red-600 transition">
                Retour à l'accueil
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
