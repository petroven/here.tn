import { useEffect, useState } from 'react';

/** Compte à rebours (offres flash) : renvoie heures / minutes / secondes restantes. */
export function useCountdown(endsAt: string | null | undefined) {
  const target = endsAt ? new Date(endsAt).getTime() : 0;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const remaining = Math.max(0, target - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    expired: remaining === 0,
    hours: pad(Math.floor(totalSeconds / 3600)),
    minutes: pad(Math.floor((totalSeconds % 3600) / 60)),
    seconds: pad(totalSeconds % 60),
  };
}
