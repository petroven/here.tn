import React, { useCallback, useEffect, useState } from 'react';

/**
 * Animation d'ouverture « buyhere. » (≈ 3 s), une fois par session :
 *  1. le point orange de la marque tombe au centre et pulse (le « ta-dum ») ;
 *  2. il éclate en rubans de lumière terracotta / sable / crème ;
 *  3. les rubans se resserrent et le logo se dévoile lettre par lettre ;
 *  4. plongée à travers le logo vers le site.
 * Cliquer ou Échap la passe ; ignorée si l'utilisateur préfère moins d'animations.
 */
const SESSION_KEY = 'buyhere.introSeen';
const DURATION_MS = 3300;

// Rubans : teinte, position horizontale (%), largeur, délai — répartis en éventail.
const RIBBONS = [
  ['#C4532C', 8, 7, 0], ['#E8A87C', 17, 4, 40], ['#994122', 25, 9, 80], ['#F4ECDF', 34, 3, 20],
  ['#D87350', 41, 6, 60], ['#C4532C', 49, 10, 0], ['#FBF8F3', 57, 3, 100], ['#E8A87C', 63, 7, 30],
  ['#7A3219', 71, 5, 70], ['#D87350', 79, 8, 50], ['#F4ECDF', 87, 4, 90], ['#C4532C', 94, 6, 20],
];

function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function shouldPlay() {
  try {
    // ?intro dans l'adresse : rejoue l'animation à volonté (démo, test).
    if (new URLSearchParams(window.location.search).has('intro')) return true;
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    // Liens internes profonds (paiement, confirmation, OAuth) : pas d'intro.
    return !/^\/(payment|oauth|confirmer-commande|reset-password|admin|vendeur|livreur)/.test(window.location.pathname);
  } catch {
    return false;
  }
}

export default function IntroAnimation() {
  const [visible, setVisible] = useState(shouldPlay);
  // « Réduire les animations » (Windows, Android, macOS) : version douce
  // — le logo apparaît en fondu, sans rubans ni zoom — plutôt que rien.
  const [calm] = useState(prefersReducedMotion);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // stockage indisponible : l'intro rejouera au prochain chargement, sans gravité
    }
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 450);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(close, calm ? 1800 : DURATION_MS);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [visible, close, calm]);

  if (!visible) return null;

  return (
    <div
      className={`bh-intro ${calm ? 'bh-intro--calm' : ''} ${leaving ? 'bh-intro--leaving' : ''}`}
      onClick={close}
      role="presentation"
      aria-hidden="true"
    >
      <div className="bh-intro__ribbons">
        {RIBBONS.map(([color, left, width, delay], i) => (
          <span
            key={i}
            className="bh-intro__ribbon"
            style={{ '--c': color, '--x': left, '--w': `${width}vw`, '--d': `${delay}ms` }}
          />
        ))}
      </div>

      <span className="bh-intro__dot" />
      <span className="bh-intro__ring" />
      <span className="bh-intro__ring bh-intro__ring--late" />

      <div className="bh-intro__logo">
        <img src="/brand/buyhere-horizontal-inverse.svg" alt="" draggable="false" />
      </div>

      <span className="bh-intro__skip">Toucher pour passer</span>
    </div>
  );
}
