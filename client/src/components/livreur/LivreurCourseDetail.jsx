import React, { useState } from 'react';
import { X, MapPin, Phone, Navigation, AlertCircle, Package, MessageSquare } from 'lucide-react';
import LivreurProofModal from './LivreurProofModal';
import ChatWidget from '../ChatWidget';
import { API_URL } from '../../config/api.js';

export default function LivreurCourseDetail({ course, onClose, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProof, setShowProof] = useState(false);
  const [confirmEchec, setConfirmEchec] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const token = localStorage.getItem('token');
  const commande = course.Commande || {};
  const client = commande.client || {};
  const boutique = commande.boutique || {};

  const patchStatut = async (statut) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/livreur/courses/${course.id}/statut`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Action impossible.');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(commande.adresseLivraison || '')}`;

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto font-sans">
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">Détail de la course</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={22} /></button>
      </div>

      <div className="p-4 space-y-4 max-w-xl mx-auto pb-28">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 p-4 space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{course.trackingId}</p>
          <p className="text-lg font-black text-slate-900">{commande.numeroCommande || 'Commande'}</p>
          <p className="text-sm text-slate-600">Total : <strong>{Number(commande.total || 0).toFixed(3)} TND</strong></p>
          <p className="text-sm text-slate-600">Frais de livraison : <strong>{Number(course.fraisLivraison || 0).toFixed(3)} TND</strong></p>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Package size={16} className="text-amber-600 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Retrait</p>
              <p className="text-sm font-semibold text-slate-800">{boutique.nom || 'Boutique'}</p>
              <p className="text-xs text-slate-500">{boutique.adresse || 'Adresse non renseignée'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase">Livraison</p>
              <p className="text-sm font-semibold text-slate-800">{client.prenom} {client.nom}</p>
              <p className="text-xs text-slate-500">{commande.adresseLivraison || 'Adresse non renseignée'}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white text-xs font-bold py-2.5 hover:bg-slate-800 transition"
            >
              <Navigation size={14} /> Naviguer
            </a>
            {client.telephone && (
              <a
                href={`tel:${client.telephone}`}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold py-2.5 hover:bg-slate-50 transition"
              >
                <Phone size={14} /> Appeler
              </a>
            )}
          </div>

          {client.id && (
            <button
              onClick={() => setShowChat(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold py-2.5 hover:bg-amber-100 transition"
            >
              <MessageSquare size={14} /> Discuter avec le client
            </button>
          )}
        </div>

        {course.statutAssignation === 'assignee' && (
          <button
            onClick={() => patchStatut('en_cours')}
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 rounded-2xl text-sm transition disabled:opacity-50"
          >
            {loading ? 'Mise à jour...' : 'Colis récupéré'}
          </button>
        )}

        {course.statutAssignation === 'en_cours' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowProof(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl text-sm transition"
            >
              Marquer comme livré
            </button>

            {!confirmEchec ? (
              <button
                onClick={() => setConfirmEchec(true)}
                className="w-full text-xs font-semibold text-rose-500 hover:text-rose-700 py-2"
              >
                Échec de livraison
              </button>
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
                <p className="text-xs text-rose-800 font-semibold">Confirmer l'échec de cette livraison ? La course retournera dans le pool pour un autre livreur.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => patchStatut('echec')}
                    disabled={loading}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 rounded-lg transition disabled:opacity-50"
                  >
                    Confirmer l'échec
                  </button>
                  <button
                    onClick={() => setConfirmEchec(false)}
                    className="flex-1 border border-slate-200 text-xs font-bold py-2 rounded-lg hover:bg-white transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showProof && (
        <LivreurProofModal
          course={course}
          onClose={() => setShowProof(false)}
          onDelivered={() => { setShowProof(false); onChanged(); }}
        />
      )}

      {showChat && (
        <ChatWidget
          defaultVendeurId={client.id}
          defaultSujet={`Livraison ${course.trackingId}`}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}
