import type { Prisma } from '@prisma/client';
import { pick, type Lang } from '../utils/lang.js';

/** Include Prisma minimal pour afficher une carte produit. */
export const productCardInclude = {
  images: { orderBy: { position: 'asc' }, take: 1 },
  category: { select: { slug: true, nameFr: true, nameAr: true } },
} satisfies Prisma.ProductInclude;

export type ProductCardRow = Prisma.ProductGetPayload<{ include: typeof productCardInclude }>;

export const productDetailInclude = {
  images: { orderBy: { position: 'asc' } },
  variants: { orderBy: [{ size: 'asc' }, { color: 'asc' }] },
  category: { select: { id: true, slug: true, nameFr: true, nameAr: true } },
} satisfies Prisma.ProductInclude;

export type ProductDetailRow = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

const isFlash = (p: { flashEndsAt: Date | null }) => !!p.flashEndsAt && p.flashEndsAt > new Date();

/** Pourcentage de remise arrondi (affiché en badge « -20 % »). */
const discountPercent = (price: number, compareAt: number | null) =>
  compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

/** Représentation légère d'un produit pour les grilles et carrousels. */
export function toProductCard(p: ProductCardRow, lang: Lang, favoriteIds?: Set<string>) {
  return {
    id: p.id,
    slug: p.slug,
    name: pick(p, 'name', lang),
    price: p.price,
    compareAt: p.compareAt,
    discountPercent: discountPercent(p.price, p.compareAt),
    imageUrl: p.images[0]?.url ?? null,
    rating: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    inStock: p.stock > 0,
    isFlash: isFlash(p),
    flashEndsAt: isFlash(p) ? p.flashEndsAt : null,
    category: { slug: p.category.slug, name: pick(p.category, 'name', lang) },
    isFavorite: favoriteIds?.has(p.id) ?? false,
  };
}

/** Représentation complète pour l'écran détail. */
export function toProductDetail(p: ProductDetailRow, lang: Lang, isFavorite: boolean) {
  const sizes = [...new Set(p.variants.map((v) => v.size).filter(Boolean))] as string[];
  const colors = [
    ...new Map(
      p.variants.filter((v) => v.color).map((v) => [v.color, { name: v.color!, hex: v.colorHex }]),
    ).values(),
  ];

  return {
    id: p.id,
    slug: p.slug,
    name: pick(p, 'name', lang),
    description: pick(p, 'description', lang),
    brand: p.brand,
    price: p.price,
    compareAt: p.compareAt,
    discountPercent: discountPercent(p.price, p.compareAt),
    stock: p.stock,
    inStock: p.stock > 0,
    rating: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
    isFlash: isFlash(p),
    flashEndsAt: isFlash(p) ? p.flashEndsAt : null,
    images: p.images.map((i) => ({ id: i.id, url: i.url })),
    category: { id: p.category.id, slug: p.category.slug, name: pick(p.category, 'name', lang) },
    options: { sizes, colors },
    variants: p.variants.map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      price: p.price + v.priceDelta,
      stock: v.stock,
    })),
    isFavorite,
  };
}
