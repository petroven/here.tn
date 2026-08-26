import React, { useState } from 'react';
import { Bike, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function LivreurLoginPage({ onBack, onLoginSuccess, onRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/livreur/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Connexion impossible.');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userRole', data.user.role);

      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft max-w-md w-full p-8">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-600 mb-6">
          <ArrowLeft size={14} /> Retour à l'accueil
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Bike size={26} />
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900 text-center">Espace Livreur</h1>
        <p className="text-slate-500 text-sm text-center mb-6">Connectez-vous pour accéder à vos courses.</p>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex gap-2 mb-4">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-slate-50/50"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-slate-50/50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div className="text-center pt-5">
          <button
            type="button"
            onClick={onRegister}
            className="text-xs font-semibold text-slate-500 hover:text-amber-600 transition"
          >
            Pas encore livreur ? Créer un compte
          </button>
        </div>
      </div>
    </div>
  );
}
