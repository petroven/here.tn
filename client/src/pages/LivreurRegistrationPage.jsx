import React, { useState } from 'react';
import { Bike, ArrowLeft, AlertCircle, Truck, Car, PackageCheck } from 'lucide-react';
import { API_URL } from '../config/api.js';

const VEHICULES = [
  { value: 'moto', label: 'Moto', icon: Bike },
  { value: 'voiture', label: 'Voiture', icon: Car },
  { value: 'velo', label: 'Vélo', icon: Bike },
  { value: 'camionnette', label: 'Camionnette', icon: Truck },
];

export default function LivreurRegistrationPage({ onBack, onSuccess }) {
  const [form, setForm] = useState({
    nom: '', prenom: '', email: '', password: '', confirmPassword: '', telephone: '', vehiculeType: 'moto',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/livreur/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          password: form.password,
          telephone: form.telephone,
          vehiculeType: form.vehiculeType,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Inscription impossible.');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userRole', data.user.role);

      onSuccess();
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
          <ArrowLeft size={14} /> Retour
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Bike size={26} />
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900 text-center">Devenir livreur</h1>
        <p className="text-slate-500 text-sm text-center mb-6">Rejoignez notre réseau de livreurs partenaires.</p>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex gap-2 mb-4">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Prénom"
              value={form.prenom}
              onChange={updateField('prenom')}
              className="border border-slate-200 p-3 rounded-xl text-xs bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
            <input
              type="text"
              placeholder="Nom"
              value={form.nom}
              onChange={updateField('nom')}
              className="border border-slate-200 p-3 rounded-xl text-xs bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          <input
            type="email"
            placeholder="Adresse email"
            value={form.email}
            onChange={updateField('email')}
            className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
            required
          />

          <input
            type="text"
            placeholder="Téléphone tunisien"
            value={form.telephone}
            onChange={updateField('telephone')}
            className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
            required
          />

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">Véhicule</label>
            <div className="grid grid-cols-4 gap-2">
              {VEHICULES.map((v) => {
                const Icon = v.icon;
                const active = form.vehiculeType === v.value;
                return (
                  <button
                    type="button"
                    key={v.value}
                    onClick={() => setForm({ ...form, vehiculeType: v.value })}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[10px] font-bold transition ${
                      active ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={16} /> {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            type="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={updateField('password')}
            className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
            required
          />

          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={form.confirmPassword}
            onChange={updateField('confirmPassword')}
            className="w-full border border-slate-200 p-3 rounded-xl text-xs bg-slate-50/50 outline-none focus:ring-2 focus:ring-amber-500"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition disabled:opacity-50"
          >
            <PackageCheck size={16} />
            {loading ? 'Création du compte...' : 'Créer mon compte livreur'}
          </button>
        </form>
      </div>
    </div>
  );
}
