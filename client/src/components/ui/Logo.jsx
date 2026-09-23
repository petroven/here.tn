import React from 'react';

// Identité BuyHere — un seul composant pour tous les usages du logo, plutôt
// que des <img> vers client/public/brand/*.svg dispersés dans chaque page
// (source des incohérences visuelles). Trois formes (voir le guide dans
// client/public/brand/buyhere-identite.html) :
//  - horizontal : le mot-symbole complet, pour les en-têtes larges.
//  - compact    : version empilée, pour les formats étroits/carrés.
//  - symbole    : juste le « b. », pour les badges/avatars minuscules.
// Chaque forme existe en 4 teintes : couleur (charbon + point terre, sur
// fond clair), blanc/inverse (sur fond sombre), noir (usage mono).
const VARIANTS = {
  horizontal: {
    couleur: '/brand/buyhere-horizontal-couleur.svg',
    blanc: '/brand/buyhere-horizontal-blanc.svg',
    noir: '/brand/buyhere-horizontal-noir.svg',
    inverse: '/brand/buyhere-horizontal-inverse.svg',
  },
  compact: {
    couleur: '/brand/buyhere-compact-couleur.svg',
    blanc: '/brand/buyhere-compact-blanc.svg',
    noir: '/brand/buyhere-compact-noir.svg',
    inverse: '/brand/buyhere-compact-inverse.svg',
  },
  symbole: {
    couleur: '/brand/buyhere-symbole-b-couleur.svg',
    blanc: '/brand/buyhere-symbole-b-blanc.svg',
    noir: '/brand/buyhere-symbole-b-noir.svg',
    inverse: '/brand/buyhere-symbole-b-inverse.svg',
  },
};

export default function Logo({ variant = 'horizontal', tone = 'couleur', className = 'h-9 w-auto' }) {
  const src = VARIANTS[variant]?.[tone] || VARIANTS.horizontal.couleur;
  return <img src={src} alt="BuyHere" className={className} />;
}
