import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { API_URL } from '../config/api.js';

const INTERVALLE_MS = 60 * 1000;

/**
 * Cloche des notifications in-app (mêmes lignes que les push mobiles).
 * Relève le compteur toutes les minutes ; la liste n'est chargée qu'à
 * l'ouverture. `onOuvrirLien(lien)` reçoit le lien d'app de la notification
 * (ex: 'commande/12', 'vendeur/produits/4') pour naviguer.
 */
export default function NotificationBell({ language = 'fr', onOuvrirLien, tone = 'clair' }) {
  const isAr = language === 'ar';
  const tr = (fr, ar) => (isAr ? ar : fr);
  const [nonLues, setNonLues] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const [items, setItems] = useState([]);
  const conteneur = useRef(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const chargerCompteur = useCallback(() => {
    if (!token) return;
    fetch(`${API_URL}/notifications/non-lues`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => d.success && setNonLues(d.data.count))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    chargerCompteur();
    const id = setInterval(chargerCompteur, INTERVALLE_MS);
    return () => clearInterval(id);
  }, [chargerCompteur]);

  useEffect(() => {
    if (!ouvert) return undefined;
    fetch(`${API_URL}/notifications?limit=20`, { headers })
      .then((r) => r.json())
      .then((d) => { if (d.success) { setItems(d.data); setNonLues(d.nonLues); } })
      .catch(() => {});
    const fermer = (e) => { if (conteneur.current && !conteneur.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  if (!token) return null;

  const marquerLue = (notification) => {
    if (!notification.lu) {
      fetch(`${API_URL}/notifications/${notification.id}/lu`, { method: 'PATCH', headers }).catch(() => {});
      setItems((list) => list.map((n) => (n.id === notification.id ? { ...n, lu: true } : n)));
      setNonLues((c) => Math.max(0, c - 1));
    }
    setOuvert(false);
    if (notification.lien && onOuvrirLien) onOuvrirLien(notification.lien);
  };

  const toutLu = () => {
    fetch(`${API_URL}/notifications/tout-lu`, { method: 'PATCH', headers }).catch(() => {});
    setItems((list) => list.map((n) => ({ ...n, lu: true })));
    setNonLues(0);
  };

  const boutonClasse = tone === 'sombre'
    ? 'bg-white/10 text-white hover:bg-white/20'
    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50';

  return (
    <div className="relative" ref={conteneur}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition ${boutonClasse}`}
        aria-label={tr(`Notifications (${nonLues} non lues)`, `الإشعارات (${nonLues} غير مقروءة)`)}
        aria-expanded={ouvert}
      >
        <Bell size={17} />
        {nonLues > 0 && (
          <span className="absolute -end-1 -top-1 min-w-[18px] rounded-full bg-[#C4532C] px-1 text-center text-[10px] font-black leading-[18px] text-white">
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      {ouvert && (
        <div className="absolute end-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-black">{tr('Notifications', 'الإشعارات')}</p>
            {nonLues > 0 && (
              <button type="button" onClick={toutLu} className="flex items-center gap-1 text-[11px] font-bold text-[#C4532C] hover:underline">
                <CheckCheck size={13} /> {tr('Tout marquer comme lu', 'تحديد الكل كمقروء')}
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-4 py-8 text-center text-xs text-slate-400">{tr('Aucune notification.', 'لا توجد إشعارات.')}</li>
            )}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => marquerLue(n)}
                  className={`flex w-full gap-2 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${n.lu ? '' : 'bg-[#FCF5F3]'}`}
                >
                  <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${n.lu ? 'bg-transparent' : 'bg-[#C4532C]'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-800">{n.titre}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{n.message}</span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleString(isAr ? 'ar-TN' : 'fr-TN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
