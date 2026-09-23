import {
  Sparkles, Shirt, Watch, Home as HomeIcon, Smartphone,
  Laptop, ShoppingBasket, Dumbbell, Tv, Baby, Car, Gamepad2, Tag,
} from 'lucide-react';

const ICON_BY_KEYWORD = [
  [/beaut|sant|parapharm/i, Sparkles],
  [/mode|v[êe]tement|chaussure/i, Shirt],
  [/accessoire.*mode|bijou/i, Watch],
  [/maison|d[ée]co|bricolage/i, HomeIcon],
  [/t[ée]l[ée]phon|mobile|objets connect/i, Smartphone],
  [/informatique|ordinateur/i, Laptop],
  [/supermarch|alimentation|terroir|artisanat/i, ShoppingBasket],
  [/sport|loisir|voyage/i, Dumbbell],
  [/image|son|[ée]lectrom[ée]nager|tv|hi-tech/i, Tv],
  [/b[ée]b[ée]|enfant|jouet/i, Baby],
  [/auto|moto/i, Car],
  [/jeux vid[ée]o|console|gaming/i, Gamepad2],
];

// Catégorie -> icône Lucide, par correspondance de mots-clés sur le nom —
// utilisé par CategoryDrawer.jsx et la rangée de catégories de la page
// d'accueil, pas de photographie de catégorie disponible dans l'app.
export function iconForCategory(nom = '') {
  const match = ICON_BY_KEYWORD.find(([pattern]) => pattern.test(nom));
  return match ? match[1] : Tag;
}
