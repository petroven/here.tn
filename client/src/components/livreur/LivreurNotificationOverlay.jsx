import React, { useEffect, useRef, useState } from 'react';
import { Bike, MapPin, Navigation, Wallet, X } from 'lucide-react';

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Web Audio unavailable — silently skip the beep
  }
}

export default function LivreurNotificationOverlay({ notification, onAccepter, onRefuser, onExpired }) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [loading, setLoading] = useState(false);
  const hasAlerted = useRef(false);

  useEffect(() => {
    if (!notification) return undefined;
    hasAlerted.current = false;

    if (!hasAlerted.current) {
      navigator.vibrate?.([200, 100, 200]);
      playBeep();
      hasAlerted.current = true;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.round((new Date(notification.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) onExpired();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [notification, onExpired]);

  if (!notification) return null;

  const handleAccepter = async () => {
    setLoading(true);
    await onAccepter(notification.notificationId);
    setLoading(false);
  };

  const handleRefuser = async () => {
    setLoading(true);
    await onRefuser(notification.notificationId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 text-center relative">
        <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center animate-pulse">
          <Bike size={30} />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900">Nouvelle course disponible !</h2>
          <p className="text-xs text-slate-500 mt-1">Répondez avant expiration</p>
        </div>

        <div className="text-4xl font-black text-amber-600 tabular-nums">
          {secondsLeft !== null ? `${secondsLeft}s` : '--'}
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2 text-left text-xs text-slate-600">
          <div className="flex items-start gap-1.5">
            <MapPin size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <span><strong className="text-slate-800">Retrait :</strong> {notification.adresseDepart || 'Non renseigné'}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span><strong className="text-slate-800">Livraison :</strong> {notification.adresseArrivee || 'Non renseigné'}</span>
          </div>
          <div className="flex items-center gap-4 pt-1 font-bold text-slate-700">
            <span className="inline-flex items-center gap-1"><Navigation size={13} className="text-slate-400" /> {notification.distanceKm !== null && notification.distanceKm !== undefined ? `${notification.distanceKm.toFixed(1)} km` : 'Distance N/D'}</span>
            <span className="inline-flex items-center gap-1"><Wallet size={13} className="text-slate-400" /> {Number(notification.fraisLivraison || 0).toFixed(3)} TND</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefuser}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 text-slate-600 font-bold py-3 text-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            <X size={16} /> Refuser
          </button>
          <button
            onClick={handleAccepter}
            disabled={loading}
            className="flex-1 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 text-sm transition disabled:opacity-50"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
