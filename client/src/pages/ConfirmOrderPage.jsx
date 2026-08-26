import React, { useEffect, useState } from 'react';
import { PackageCheck, XCircle, AlertCircle, Clock, ShoppingBag } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function ConfirmOrderPage({ token }) {
  const [commande, setCommande] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchCommande();
  }, [token]);

  const fetchCommande = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/commandes/confirmation/${token}`);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Lien de confirmation invalide.');
      setCommande(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (action) => {
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/commandes/confirmation/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Action impossible.');
      setCommande(data.data);
      setResultMessage(
        action === 'confirmer'
          ? 'Commande confirmée ! Votre colis va être préparé et expédié.'
          : 'Commande annulée. Le vendeur a été informé.',
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-sm text-slate-500">Chargement...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 font-sans min-h-screen flex items-center">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-8 w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-[#EEF2FF] text-[#6366F1] rounded-2xl flex items-center justify-center">
            <PackageCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Confirmation de commande</h1>
            <p className="text-slate-500 text-sm">Confirmez pour lancer la préparation de votre colis</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-sm flex gap-3 mb-6">
            <AlertCircle className="text-rose-600 flex-shrink-0" size={20} />
            <span>{error}</span>
          </div>
        )}

        {commande && (
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Commande</p>
              <p className="text-lg font-black text-slate-900 mt-1">#{commande.numeroCommande}</p>
              <p className="text-sm text-slate-600 mt-1">{commande.boutique?.nom}</p>
              <p className="text-xl font-black text-teal-700 mt-3">{Number(commande.total).toFixed(3)} TND</p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {commande.lignes?.map((ligne) => (
                <div key={ligne.id} className="p-4 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden flex-shrink-0">
                    {ligne.produit?.image ? (
                      <img src={ligne.produit.image} alt={ligne.produit.nom} className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag size={18} />
                    )}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{ligne.produit?.nom || `Produit #${ligne.produitId}`}</p>
                    <p className="text-xs text-slate-400">Quantité: {ligne.quantite}</p>
                  </div>
                </div>
              ))}
            </div>

            {commande.confirmationStatut === 'en_attente' && (
              <div>
                <p className="text-xs text-slate-500 font-semibold mb-4">
                  Merci de confirmer que vous attendez toujours ce colis. Sans réponse sous 48h, la commande peut être annulée automatiquement.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRespond('confirmer')}
                    disabled={submitting}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition text-sm flex items-center justify-center gap-2"
                  >
                    <PackageCheck size={18} />
                    Confirmer ma commande
                  </button>
                  <button
                    onClick={() => handleRespond('annuler')}
                    disabled={submitting}
                    className="flex-1 bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 border border-red-200 font-bold py-3.5 rounded-2xl transition text-sm flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} />
                    Annuler la commande
                  </button>
                </div>
              </div>
            )}

            {commande.confirmationStatut === 'confirmee' && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex gap-3">
                <PackageCheck className="text-emerald-600 flex-shrink-0" size={20} />
                <span>{resultMessage || 'Commande déjà confirmée. Elle est en cours de préparation.'}</span>
              </div>
            )}

            {commande.confirmationStatut === 'refusee' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-sm flex gap-3">
                <XCircle className="text-red-600 flex-shrink-0" size={20} />
                <span>{resultMessage || 'Commande annulée.'}</span>
              </div>
            )}

            {commande.confirmationStatut === 'expiree' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm flex gap-3">
                <Clock className="text-amber-600 flex-shrink-0" size={20} />
                <span>Le délai de confirmation de 48h est dépassé. Contactez le service client si vous attendez toujours ce colis.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
