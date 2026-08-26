import React, { useState } from 'react';
import { X, Camera, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_URL } from '../../config/api.js';

export default function LivreurProofModal({ course, onClose, onDelivered }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const markDelivered = async () => {
    const response = await fetch(`${API_URL}/livreur/courses/${course.id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ statut: 'livree' }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Impossible de marquer la course comme livrée.');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      if (file) {
        const formData = new FormData();
        formData.append('preuve', file);
        const uploadResponse = await fetch(`${API_URL}/livreur/courses/${course.id}/preuve`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadData.success) {
          throw new Error(uploadData.message || "Échec de l'envoi de la photo.");
        }
      }
      await markDelivered();
      onDelivered();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    setError('');
    try {
      await markDelivered();
      onDelivered();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Confirmer la livraison</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl p-6 cursor-pointer hover:border-amber-400 transition">
          {preview ? (
            <img src={preview} alt="Preuve de livraison" className="h-40 w-full object-cover rounded-xl" />
          ) : (
            <>
              <Camera size={28} className="text-amber-600" />
              <span className="text-xs font-bold text-slate-600">Prendre ou choisir une photo</span>
            </>
          )}
          <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        </label>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 rounded-2xl text-sm transition disabled:opacity-50"
        >
          <CheckCircle2 size={18} />
          {loading ? 'Envoi...' : 'Confirmer la livraison'}
        </button>

        <button
          onClick={handleSkip}
          disabled={loading}
          className="w-full text-center text-xs font-semibold text-slate-400 hover:text-amber-600 transition"
        >
          Marquer livré sans photo
        </button>
      </div>
    </div>
  );
}
