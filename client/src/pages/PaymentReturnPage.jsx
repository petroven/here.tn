import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function PaymentReturnPage({ onDone }) {
  const [state, setState] = useState('checking'); // 'checking' | 'paid' | 'pending' | 'failed' | 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');
    const status = params.get('status'); // hint only — never trusted, the server's word decides

    if (!orderId) {
      setState('error');
      setMessage("Impossible de retrouver votre commande.");
      return;
    }

    const token = localStorage.getItem('token');
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`${API_URL}/payments/${orderId}/status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();

        if (data.success && data.data.transaction?.statut === 'validee') {
          setState('paid');
          return;
        }
        if (data.success && data.data.transaction?.statut === 'echec') {
          setState('failed');
          return;
        }

        // Le webhook du prestataire peut arriver avec un léger décalage —
        // on retente quelques secondes avant de conclure.
        if (attempts < 6) {
          setTimeout(poll, 2000);
        } else {
          setState(status === 'fail' ? 'failed' : 'pending');
        }
      } catch {
        setState('error');
        setMessage('Impossible de vérifier le statut du paiement.');
      }
    };

    poll();
  }, []);

  const content = {
    checking: { icon: <Loader2 size={40} className="animate-spin text-[#7C3AED]" />, title: 'Vérification du paiement...', desc: 'Merci de patienter, nous confirmons votre transaction.' },
    paid: { icon: <CheckCircle2 size={40} className="text-emerald-500" />, title: 'Paiement confirmé !', desc: 'Votre commande a été payée avec succès.' },
    pending: { icon: <Clock size={40} className="text-amber-500" />, title: 'Paiement en cours de traitement', desc: 'Nous n\'avons pas encore reçu la confirmation finale — vous recevrez un email dès que ce sera fait.' },
    failed: { icon: <XCircle size={40} className="text-rose-500" />, title: 'Paiement échoué', desc: 'La transaction n\'a pas abouti. Vous pouvez réessayer depuis votre panier.' },
    error: { icon: <XCircle size={40} className="text-rose-500" />, title: 'Erreur', desc: message || 'Une erreur est survenue.' },
  }[state];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 via-indigo-100 to-blue-100">
          {content.icon}
        </div>
        <h1 className="text-lg font-black text-slate-900">{content.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{content.desc}</p>
        {state !== 'checking' && (
          <button onClick={onDone} className="btn-primary-premium mt-6 w-full py-3 text-sm">
            Continuer
          </button>
        )}
      </div>
    </div>
  );
}
