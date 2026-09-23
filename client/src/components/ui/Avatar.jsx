import React from 'react';

// Avatar générique (photo si disponible, sinon initiales) — utilisé pour les
// auteurs d'avis produit et les vendeurs mis en avant sur la page d'accueil.
export default function Avatar({ nom, prenom, photo, className = 'h-9 w-9' }) {
  const initials = `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase() || '?';

  if (photo) {
    return <img src={photo} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  }

  return (
    <span className={`flex ${className} shrink-0 items-center justify-center rounded-full bg-[#F8E4DE] text-xs font-black text-[#C4532C]`}>
      {initials}
    </span>
  );
}
