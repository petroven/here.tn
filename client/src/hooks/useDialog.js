import { useEffect, useRef } from 'react';

/**
 * Comportement commun des fenêtres modales : Échap ferme, le défilement de la
 * page est bloqué, le focus entre dans la fenêtre à l'ouverture puis revient
 * sur l'élément qui l'a ouverte. Renvoie les props à poser sur le panneau.
 *
 *   const dialog = useDialog(open, onClose, 'titre-id');
 *   <div {...dialog}> <h2 id="titre-id">…</h2> … </div>
 *
 * onClose absent : Échap ne ferme pas (choix obligatoire, ex. consentement).
 */
export function useDialog(open, onClose, labelledBy) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && closeRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [open]);

  return {
    ref,
    role: 'dialog',
    'aria-modal': true,
    tabIndex: -1,
    ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
    style: { outline: 'none' },
  };
}
