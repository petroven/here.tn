import { useEffect } from 'react';

// SEO de base sans dépendance externe (pas de react-helmet) — met à jour le
// titre d'onglet et la balise meta description à chaque changement de page.
// Restaure les valeurs précédentes au démontage pour ne pas laisser un
// titre de fiche produit "coller" sur la page suivante pendant la transition.
export function useDocumentTitle(title, description) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') || '';
    if (description) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }

    return () => {
      document.title = previousTitle;
      if (meta) meta.setAttribute('content', previousDescription);
    };
  }, [title, description]);
}
