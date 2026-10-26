import React from 'react';
import { useTheme } from '../../utils/theme.js';

// Identité BuyHere — un seul composant pour tous les usages du logo, plutôt
// que des <img> vers client/public/brand/*.svg dispersés dans chaque page
// (source des incohérences visuelles). Trois formes (voir le guide dans
// client/public/brand/buyhere-identite.html) :
//  - horizontal : le mot-symbole complet, pour les en-têtes larges.
//  - compact    : version empilée, pour les formats étroits/carrés.
//  - symbole    : juste le « b. », pour les badges/avatars minuscules.
// Chaque forme existe en 4 teintes : couleur (charbon + point terre, sur
// fond clair), blanc/inverse (sur fond sombre), noir (usage mono).
// BASE_URL keeps the paths valid when the client is built for a sub-path
// (e.g. the static preview build with base './').
const BASE = import.meta.env.BASE_URL;
const VARIANTS = {
  horizontal: {
    couleur: `${BASE}brand/buyhere-horizontal-couleur.svg`,
    blanc: `${BASE}brand/buyhere-horizontal-blanc.svg`,
    noir: `${BASE}brand/buyhere-horizontal-noir.svg`,
    inverse: `${BASE}brand/buyhere-horizontal-inverse.svg`,
  },
  compact: {
    couleur: `${BASE}brand/buyhere-compact-couleur.svg`,
    blanc: `${BASE}brand/buyhere-compact-blanc.svg`,
    noir: `${BASE}brand/buyhere-compact-noir.svg`,
    inverse: `${BASE}brand/buyhere-compact-inverse.svg`,
  },
  symbole: {
    couleur: `${BASE}brand/buyhere-symbole-b-couleur.svg`,
    blanc: `${BASE}brand/buyhere-symbole-b-blanc.svg`,
    noir: `${BASE}brand/buyhere-symbole-b-noir.svg`,
    inverse: `${BASE}brand/buyhere-symbole-b-inverse.svg`,
  },
};

export default function Logo({ variant = 'horizontal', tone = 'couleur', className = 'h-9 w-auto' }) {
  // En mode sombre, la version « couleur » (texte charbon) disparaîtrait sur
  // le fond : on passe à la version inverse, prévue pour les fonds sombres.
  const { dark } = useTheme();
  const shownTone = dark && tone === 'couleur' ? 'inverse' : tone;
  const src = VARIANTS[variant]?.[shownTone] || VARIANTS.horizontal.couleur;
  return <img src={src} alt="BuyHere" className={className} />;
}
