/**
 * Données de test BuyHere : 5 catégories, 30 produits (avec variantes),
 * bannières, coupons, comptes démo, une commande livrée et des avis.
 *
 * Idempotent : vide les tables puis réinsère tout. NE PAS lancer en production.
 *   npm run db:seed
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;
const DT = (dinars: number) => Math.round(dinars * 1000); // DT -> millimes
const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000);

// ─── Catégories ───

const categories = [
  { slug: 'mode', nameFr: 'Mode', nameAr: 'أزياء', icon: 'shirt', image: '1515886657613-9f3515b0c78f' },
  { slug: 'electronique', nameFr: 'Électronique', nameAr: 'إلكترونيات', icon: 'smartphone', image: '1517336714731-489689fd1ca8' },
  { slug: 'beaute', nameFr: 'Beauté', nameAr: 'تجميل', icon: 'sparkles', image: '1596462502278-27bfdc403348' },
  { slug: 'maison', nameFr: 'Maison', nameAr: 'المنزل', icon: 'sofa', image: '1555041469-a586c61ea9bc' },
  { slug: 'sport', nameFr: 'Sport & Chaussures', nameAr: 'رياضة وأحذية', icon: 'dumbbell', image: '1542291026-7eec264c27ff' },
];

// ─── Produits ───

type VariantSeed = { size?: string; color?: string; colorHex?: string; priceDelta?: number; stock: number };
type ProductSeed = {
  slug: string;
  category: string;
  nameFr: string;
  nameAr: string;
  descFr: string;
  descAr: string;
  price: number; // DT
  compareAt?: number; // DT
  stock?: number; // si pas de variantes
  brand?: string;
  featured?: boolean;
  flashHours?: number;
  images: string[];
  variants?: VariantSeed[];
};

const CLOTHING_SIZES = ['S', 'M', 'L', 'XL'];
const SHOE_SIZES = ['40', '41', '42', '43', '44'];

/** Génère les combinaisons taille × couleur avec un stock pseudo-aléatoire stable. */
function combos(sizes: string[], colors: { color: string; colorHex: string }[]): VariantSeed[] {
  return sizes.flatMap((size, i) =>
    colors.map((c, j) => ({ size, ...c, stock: ((i + 2) * (j + 3)) % 9 + 1 })),
  );
}

const BLACK = { color: 'Noir', colorHex: '#111111' };
const WHITE = { color: 'Blanc', colorHex: '#F5F5F5' };
const NAVY = { color: 'Bleu marine', colorHex: '#1F2A44' };
const BEIGE = { color: 'Beige', colorHex: '#D9C3A0' };
const RED = { color: 'Rouge', colorHex: '#C62828' };

const products: ProductSeed[] = [
  // Mode (6)
  {
    slug: 't-shirt-coton-bio', category: 'mode', nameFr: 'T-shirt en coton bio', nameAr: 'قميص قطني عضوي',
    descFr: 'T-shirt col rond en coton biologique 180 g/m², coupe régulière, doux et respirant. Idéal au quotidien.',
    descAr: 'قميص بياقة دائرية من القطن العضوي، قصة عادية، ناعم ومريح للاستعمال اليومي.',
    price: 29.9, compareAt: 39.9, brand: 'Medina Wear', featured: true,
    images: ['1521572163474-6864f9cf17ab', '1583743814966-8936f5b7be1a'],
    variants: combos(CLOTHING_SIZES, [WHITE, BLACK, NAVY]),
  },
  {
    slug: 'sweat-a-capuche-unisexe', category: 'mode', nameFr: 'Sweat à capuche unisexe', nameAr: 'سترة بقلنسوة للجنسين',
    descFr: 'Sweat molletonné à capuche, poche kangourou, intérieur gratté pour plus de chaleur.',
    descAr: 'سترة دافئة بقلنسوة وجيب أمامي، مبطنة من الداخل.',
    price: 69.9, compareAt: 89.9, brand: 'Medina Wear', flashHours: 20,
    images: ['1576566588028-4147f3842f27'],
    variants: combos(CLOTHING_SIZES, [BLACK, BEIGE]),
  },
  {
    slug: 'veste-en-jean', category: 'mode', nameFr: 'Veste en jean classique', nameAr: 'سترة جينز كلاسيكية',
    descFr: 'Veste en denim stretch, boutons métalliques, deux poches poitrine. Un intemporel.',
    descAr: 'سترة جينز مرنة بأزرار معدنية وجيبين على الصدر.',
    price: 119, brand: 'Carthage Denim', featured: true,
    images: ['1591047139829-d91aecb6caea', '1551028719-00167b16eac5'],
    variants: combos(CLOTHING_SIZES, [NAVY]),
  },
  {
    slug: 'jean-slim-homme', category: 'mode', nameFr: 'Jean slim homme', nameAr: 'جينز ضيق للرجال',
    descFr: 'Jean coupe slim en denim extensible, 5 poches, délavage moyen.',
    descAr: 'جينز بقصة ضيقة من قماش مرن، خمسة جيوب.',
    price: 89, compareAt: 109, brand: 'Carthage Denim',
    images: ['1542272604-787c3835535d'],
    variants: combos(['38', '40', '42', '44'], [NAVY, BLACK]),
  },
  {
    slug: 'robe-ete-fleurie', category: 'mode', nameFr: "Robe d'été fleurie", nameAr: 'فستان صيفي مزهر',
    descFr: 'Robe fluide à motif floral, bretelles réglables, longueur midi. Légère pour les journées chaudes.',
    descAr: 'فستان خفيف بنقشة زهور وأحزمة قابلة للتعديل، طول متوسط.',
    price: 79.9, compareAt: 99.9, brand: 'Jasmin', featured: true, flashHours: 30,
    images: ['1595777457583-95e059d581b8', '1572804013309-59a88b7e92f1'],
    variants: combos(['S', 'M', 'L'], [RED, BEIGE]),
  },
  {
    slug: 'chemise-lin-femme', category: 'mode', nameFr: 'Chemise en lin femme', nameAr: 'قميص كتان نسائي',
    descFr: 'Chemise ample 100 % lin, manches retroussables, parfaite pour l’été tunisien.',
    descAr: 'قميص واسع من الكتان الخالص، مثالي لصيف تونس.',
    price: 64.9, brand: 'Jasmin',
    images: ['1539109136881-3be0616acf4b'],
    variants: combos(['S', 'M', 'L'], [WHITE, BEIGE]),
  },

  // Électronique (6)
  {
    slug: 'casque-bluetooth-anc', category: 'electronique', nameFr: 'Casque Bluetooth à réduction de bruit', nameAr: 'سماعة بلوتوث بخاصية عزل الضوضاء',
    descFr: 'Réduction active du bruit, 30 h d’autonomie, charge rapide USB-C, micro intégré pour les appels.',
    descAr: 'عزل نشط للضوضاء، بطارية 30 ساعة، شحن سريع USB-C وميكروفون مدمج.',
    price: 249, compareAt: 329, brand: 'SoundWave', stock: 25, featured: true, flashHours: 12,
    images: ['1505740420928-5e560c06d30e', '1546435770-a3e426bf472b'],
  },
  {
    slug: 'ecouteurs-sans-fil', category: 'electronique', nameFr: 'Écouteurs sans fil', nameAr: 'سماعات لاسلكية',
    descFr: 'Écouteurs True Wireless, boîtier de charge, résistants à la sueur (IPX4), commandes tactiles.',
    descAr: 'سماعات لاسلكية بالكامل مع علبة شحن، مقاومة للعرق ولمس ذكي.',
    price: 99, compareAt: 129, brand: 'SoundWave', stock: 40,
    images: ['1606220945770-b5b6c2c55bf1'],
  },
  {
    slug: 'ordinateur-portable-14', category: 'electronique', nameFr: 'Ordinateur portable 14" Core i5', nameAr: 'حاسوب محمول 14 بوصة Core i5',
    descFr: 'Écran 14" Full HD, Intel Core i5, 16 Go RAM, SSD 512 Go, Windows 11. Léger (1,4 kg).',
    descAr: 'شاشة 14 بوصة، معالج Core i5، ذاكرة 16 جيجا، SSD 512 جيجا، ويندوز 11.',
    price: 2199, compareAt: 2499, brand: 'NovaBook', stock: 8, featured: true,
    images: ['1517336714731-489689fd1ca8', '1496181133206-80ce9b88a853'],
  },
  {
    slug: 'smartphone-6-5-128go', category: 'electronique', nameFr: 'Smartphone 6,5" 128 Go', nameAr: 'هاتف ذكي 6.5 بوصة 128 جيجا',
    descFr: 'Écran AMOLED 6,5", 128 Go, triple caméra 50 MP, batterie 5000 mAh, double SIM.',
    descAr: 'شاشة AMOLED، ذاكرة 128 جيجا، كاميرا ثلاثية 50 ميجابكسل، بطارية 5000 مللي أمبير.',
    price: 899, compareAt: 999, brand: 'Atlas', featured: true,
    images: ['1511707171634-5f897ff02aa9', '1610945265064-0e34e5519bbf'],
    variants: [
      { color: 'Noir', colorHex: '#111111', stock: 10 },
      { color: 'Bleu', colorHex: '#2F5DA8', stock: 6 },
      { color: 'Vert', colorHex: '#3E7D5A', priceDelta: DT(20), stock: 4 },
    ],
  },
  {
    slug: 'montre-connectee', category: 'electronique', nameFr: 'Montre connectée sport', nameAr: 'ساعة ذكية رياضية',
    descFr: 'Suivi cardiaque, GPS, 100 modes sportifs, notifications, 10 jours d’autonomie.',
    descAr: 'قياس نبض القلب، GPS، 100 وضع رياضي، إشعارات وبطارية 10 أيام.',
    price: 189, compareAt: 239, brand: 'Atlas', stock: 30, flashHours: 8,
    images: ['1523275335684-37898b6baf30', '1540932239986-30128078f3c5'],
  },
  {
    slug: 'ordinateur-portable-15-pro', category: 'electronique', nameFr: 'Ordinateur portable 15" Pro', nameAr: 'حاسوب محمول 15 بوصة برو',
    descFr: 'Écran 15,6" 2K, Core i7, 16 Go RAM, SSD 1 To, carte graphique dédiée. Pour créer et jouer.',
    descAr: 'شاشة 15.6 بوصة 2K، معالج Core i7، SSD 1 تيرا وبطاقة رسومات مخصصة.',
    price: 3490, brand: 'NovaBook', stock: 5,
    images: ['1593642632559-0c6d3fc62b89'],
  },

  // Beauté (6)
  {
    slug: 'serum-vitamine-c', category: 'beaute', nameFr: 'Sérum vitamine C éclat', nameAr: 'سيروم فيتامين سي للإشراق',
    descFr: 'Sérum à 15 % de vitamine C et acide hyaluronique. Unifie le teint et ravive l’éclat. 30 ml.',
    descAr: 'سيروم بفيتامين سي 15% وحمض الهيالورونيك لتوحيد لون البشرة. 30 مل.',
    price: 45.9, compareAt: 59.9, brand: 'Zitouna Care', stock: 60, featured: true,
    images: ['1620916566398-39f1143ab7be', '1611930022073-b7a4ba5fcccd'],
  },
  {
    slug: 'creme-hydratante-argan', category: 'beaute', nameFr: "Crème hydratante à l'huile d'argan", nameAr: 'كريم مرطب بزيت الأرغان',
    descFr: 'Crème visage nourrissante à l’huile d’argan, hydratation 24 h, tous types de peau. 50 ml.',
    descAr: 'كريم مغذٍ للوجه بزيت الأرغان، ترطيب 24 ساعة لجميع أنواع البشرة. 50 مل.',
    price: 38.5, brand: 'Zitouna Care', stock: 80,
    images: ['1556228578-8c89e6adf883', '1571781926291-c477ebfd024b'],
  },
  {
    slug: 'palette-maquillage', category: 'beaute', nameFr: 'Palette de maquillage 18 teintes', nameAr: 'لوحة مكياج 18 لوناً',
    descFr: 'Palette de fards à paupières mats et irisés, haute pigmentation, longue tenue.',
    descAr: 'لوحة ظلال عيون مطفأة ولامعة، ألوان قوية وثبات طويل.',
    price: 54.9, compareAt: 69.9, brand: 'Layla Beauty', stock: 35, flashHours: 16,
    images: ['1596462502278-27bfdc403348', '1512496015851-a90fb38ba796'],
  },
  {
    slug: 'huile-seche-corps', category: 'beaute', nameFr: 'Huile sèche corps et cheveux', nameAr: 'زيت جاف للجسم والشعر',
    descFr: 'Huile multi-usage non grasse au figuier de barbarie. Nourrit et parfume délicatement. 100 ml.',
    descAr: 'زيت متعدد الاستعمالات غير دهني بزيت التين الشوكي. 100 مل.',
    price: 42, brand: 'Zitouna Care', stock: 45,
    images: ['1608248543803-ba4f8c70ae0b'],
  },
  {
    slug: 'rouge-a-levres-mat', category: 'beaute', nameFr: 'Rouge à lèvres mat longue tenue', nameAr: 'أحمر شفاه مطفأ طويل الثبات',
    descFr: 'Texture crémeuse, fini mat, tenue jusqu’à 12 h sans dessécher les lèvres.',
    descAr: 'قوام كريمي ولمسة مطفأة، ثبات حتى 12 ساعة دون جفاف.',
    price: 24.9, brand: 'Layla Beauty',
    images: ['1522335789203-aabd1fc54bc9'],
    variants: [
      { color: 'Rouge carthage', colorHex: '#9E1B32', stock: 20 },
      { color: 'Nude', colorHex: '#C58C7A', stock: 15 },
      { color: 'Rose', colorHex: '#D46A8C', stock: 12 },
    ],
  },
  {
    slug: 'coffret-soin-visage', category: 'beaute', nameFr: 'Coffret soin visage complet', nameAr: 'مجموعة العناية الكاملة بالوجه',
    descFr: 'Nettoyant, tonique, sérum et crème : la routine complète dans un coffret cadeau.',
    descAr: 'منظف، تونر، سيروم وكريم: روتين كامل في علبة هدية.',
    price: 119, compareAt: 149, brand: 'Zitouna Care', stock: 15, featured: true,
    images: ['1572635196237-14b3f281503f'],
  },

  // Maison (6)
  {
    slug: 'canape-3-places', category: 'maison', nameFr: 'Canapé 3 places en tissu', nameAr: 'أريكة 3 مقاعد من القماش',
    descFr: 'Canapé confortable, assise en mousse haute densité, tissu déhoussable. L 210 cm.',
    descAr: 'أريكة مريحة بإسفنج عالي الكثافة وقماش قابل للنزع. الطول 210 سم.',
    price: 1290, compareAt: 1590, brand: 'Dar Déco', featured: true,
    images: ['1555041469-a586c61ea9bc', '1586023492125-27b2c045efd7'],
    variants: [
      { color: 'Gris', colorHex: '#8A8A8A', stock: 3 },
      { color: 'Beige', colorHex: '#D9C3A0', stock: 2 },
    ],
  },
  {
    slug: 'chaise-scandinave', category: 'maison', nameFr: 'Chaise scandinave', nameAr: 'كرسي إسكندنافي',
    descFr: 'Chaise design, assise moulée, pieds en hêtre massif. Vendue à l’unité.',
    descAr: 'كرسي بتصميم عصري وأرجل من خشب الزان.',
    price: 139, compareAt: 169, brand: 'Dar Déco', stock: 24,
    images: ['1524758631624-e2822e304c36'],
  },
  {
    slug: 'lampe-a-poser', category: 'maison', nameFr: 'Lampe à poser en céramique', nameAr: 'مصباح طاولة من السيراميك',
    descFr: 'Pied en céramique artisanale de Nabeul, abat-jour en lin. Ampoule E27 non incluse.',
    descAr: 'قاعدة من خزف نابل الحرفي وغطاء من الكتان.',
    price: 89, brand: 'Nabeul Craft', stock: 18, flashHours: 36,
    images: ['1507473885765-e6ed057f782c'],
  },
  {
    slug: 'set-ustensiles-cuisine', category: 'maison', nameFr: 'Set de 12 ustensiles de cuisine', nameAr: 'طقم 12 أداة مطبخ',
    descFr: 'Ustensiles en silicone résistant à la chaleur (230 °C) avec support. Compatibles antiadhésifs.',
    descAr: 'أدوات من السيليكون المقاوم للحرارة مع حامل.',
    price: 59.9, compareAt: 79.9, brand: 'Kitchen Plus', stock: 50,
    images: ['1556911220-bff31c812dba'],
  },
  {
    slug: 'plante-artificielle', category: 'maison', nameFr: 'Plante artificielle en pot', nameAr: 'نبتة اصطناعية في أصيص',
    descFr: 'Plante décorative réaliste de 90 cm, pot inclus. Aucun entretien.',
    descAr: 'نبتة زينة واقعية بطول 90 سم مع الأصيص.',
    price: 75, brand: 'Dar Déco', stock: 30,
    images: ['1594035910387-fea47794261f'],
  },
  {
    slug: 'decoration-murale', category: 'maison', nameFr: 'Décoration murale bohème', nameAr: 'ديكور حائط بوهيمي',
    descFr: 'Composition murale en bois et fibres naturelles, faite main.',
    descAr: 'قطعة ديكور حائطية من الخشب والألياف الطبيعية، صنع يدوي.',
    price: 49, brand: 'Nabeul Craft', stock: 22,
    images: ['1513506003901-1e6a229e2d15'],
  },

  // Sport & Chaussures (6)
  {
    slug: 'baskets-running', category: 'sport', nameFr: 'Baskets de running', nameAr: 'حذاء رياضي للجري',
    descFr: 'Amorti réactif, mesh respirant, semelle antidérapante. Pour la route et le tapis.',
    descAr: 'توسيد مرن وقماش يسمح بالتهوية ونعل مانع للانزلاق.',
    price: 189, compareAt: 239, brand: 'Stride', featured: true, flashHours: 24,
    images: ['1542291026-7eec264c27ff', '1608231387042-66d1773070a5'],
    variants: combos(SHOE_SIZES, [RED, BLACK]),
  },
  {
    slug: 'sneakers-blanches', category: 'sport', nameFr: 'Sneakers blanches en cuir', nameAr: 'حذاء رياضي أبيض من الجلد',
    descFr: 'Sneakers basses en cuir, semelle cousue. Le basique qui va avec tout.',
    descAr: 'حذاء رياضي منخفض من الجلد يناسب كل الإطلالات.',
    price: 149, brand: 'Stride',
    images: ['1549298916-b41d501d3772', '1600185365483-26d7a4cc7519'],
    variants: combos(SHOE_SIZES, [WHITE]),
  },
  {
    slug: 'chaussures-trail', category: 'sport', nameFr: 'Chaussures de trail', nameAr: 'حذاء للمسارات الجبلية',
    descFr: 'Crampons profonds, protection des orteils, tige imperméable. Pour les sentiers de Aïn Draham.',
    descAr: 'نعل بنتوءات عميقة وحماية للأصابع وجزء علوي مقاوم للماء.',
    price: 219, brand: 'Stride',
    images: ['1595950653106-6c9ebd614d3a'],
    variants: combos(SHOE_SIZES, [BLACK]),
  },
  {
    slug: 'sac-a-dos-sport', category: 'sport', nameFr: 'Sac à dos sport 25 L', nameAr: 'حقيبة ظهر رياضية 25 لتر',
    descFr: 'Compartiment chaussures, poche ordinateur 15", tissu déperlant.',
    descAr: 'جيب للأحذية وجيب لحاسوب 15 بوصة، قماش مقاوم للماء.',
    price: 79, compareAt: 95, brand: 'Stride', stock: 35,
    images: ['1553062407-98eeb64c6a62'],
  },
  {
    slug: 'sac-de-sport', category: 'sport', nameFr: 'Sac de sport week-end', nameAr: 'حقيبة رياضية لعطلة نهاية الأسبوع',
    descFr: 'Grand sac 40 L, bandoulière rembourrée, poche humide séparée.',
    descAr: 'حقيبة كبيرة 40 لتر بحزام مبطن وجيب منفصل للملابس المبللة.',
    price: 99, brand: 'Stride', stock: 20,
    images: ['1548036328-c9fa89d128fa', '1590874103328-eac38a683ce7'],
  },
  {
    slug: 'baskets-lifestyle', category: 'sport', nameFr: 'Baskets lifestyle', nameAr: 'حذاء رياضي كاجوال',
    descFr: 'Baskets confortables pour la ville, semelle légère en EVA.',
    descAr: 'حذاء مريح للمدينة بنعل خفيف.',
    price: 129, compareAt: 159, brand: 'Stride',
    images: ['1525966222134-fcfa99b8ae77', '1560769629-975ec94e6a86'],
    variants: combos(SHOE_SIZES, [NAVY, WHITE]),
  },
];

async function reset() {
  // Ordre inverse des dépendances.
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.review.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.address.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function main() {
  console.log('🌱 Réinitialisation des données...');
  await reset();

  // Catégories
  const categoryIds = new Map<string, string>();
  for (const [i, c] of categories.entries()) {
    const row = await prisma.category.create({
      data: { slug: c.slug, nameFr: c.nameFr, nameAr: c.nameAr, icon: c.icon, imageUrl: img(c.image), sortOrder: i },
    });
    categoryIds.set(c.slug, row.id);
  }

  // Produits : createdAt décalés pour que « Nouveautés » ait un ordre réaliste.
  const productIds = new Map<string, string>();
  for (const [i, p] of products.entries()) {
    const variants = (p.variants ?? []).map((v, j) => ({
      sku: `${p.slug}-${j + 1}`.toUpperCase(),
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      priceDelta: v.priceDelta ?? 0,
      stock: v.stock,
    }));
    const stock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : (p.stock ?? 0);

    const data: Prisma.ProductCreateInput = {
      slug: p.slug,
      category: { connect: { id: categoryIds.get(p.category)! } },
      nameFr: p.nameFr,
      nameAr: p.nameAr,
      descriptionFr: p.descFr,
      descriptionAr: p.descAr,
      price: DT(p.price),
      compareAt: p.compareAt ? DT(p.compareAt) : null,
      stock,
      brand: p.brand,
      isFeatured: p.featured ?? false,
      flashEndsAt: p.flashHours ? inHours(p.flashHours) : null,
      soldCount: (i * 37) % 250,
      createdAt: new Date(Date.now() - i * 36 * 3600 * 1000),
      images: { create: p.images.map((id, position) => ({ url: img(id), position })) },
      variants: { create: variants },
    };
    const row = await prisma.product.create({ data });
    productIds.set(p.slug, row.id);
  }

  // Bannières du carrousel
  await prisma.banner.createMany({
    data: [
      {
        titleFr: 'Soldes d’été jusqu’à -40 %', titleAr: 'تخفيضات الصيف حتى 40%',
        subtitleFr: 'Mode, beauté et maison', subtitleAr: 'أزياء، تجميل ومنزل',
        imageUrl: img('1515886657613-9f3515b0c78f'),
        target: 'category:mode', sortOrder: 0,
      },
      {
        titleFr: 'High-tech au meilleur prix', titleAr: 'أفضل أسعار التكنولوجيا',
        subtitleFr: 'Livraison offerte dès 150 DT', subtitleAr: 'توصيل مجاني ابتداءً من 150 دينار',
        imageUrl: img('1496181133206-80ce9b88a853'), target: 'category:electronique', sortOrder: 1,
      },
      {
        titleFr: '-10 % sur votre 1re commande', titleAr: 'خصم 10% على طلبك الأول',
        subtitleFr: 'Code : BIENVENUE10', subtitleAr: 'الرمز: BIENVENUE10',
        imageUrl: img('1586023492125-27b2c045efd7'), target: 'category:maison', sortOrder: 2,
      },
    ],
  });

  // Coupons
  await prisma.coupon.createMany({
    data: [
      { code: 'BIENVENUE10', type: 'PERCENT', value: 10, maxDiscount: DT(30) },
      { code: 'ETE2026', type: 'PERCENT', value: 20, minSubtotal: DT(100), maxDiscount: DT(60), usageLimit: 500, expiresAt: inHours(24 * 60) },
      { code: 'LIVRAISON7', type: 'FIXED', value: DT(7), minSubtotal: DT(50) },
    ],
  });

  // Comptes démo
  const passwordHash = await bcrypt.hash('BuyHere2026', 12);
  const admin = await prisma.user.create({
    data: { email: 'admin@buyhere.tn', firstName: 'Admin', lastName: 'BuyHere', role: 'ADMIN', passwordHash, cart: { create: {} } },
  });
  const client = await prisma.user.create({
    data: {
      email: 'client@buyhere.tn',
      phone: '+21622123456',
      firstName: 'Amira',
      lastName: 'Ben Salah',
      passwordHash,
      cart: { create: {} },
      addresses: {
        create: [
          { label: 'Maison', fullName: 'Amira Ben Salah', phone: '+21622123456', governorate: 'Tunis', city: 'La Marsa', street: '12 rue Habib Bourguiba', postalCode: '2070', isDefault: true },
          { label: 'Travail', fullName: 'Amira Ben Salah', phone: '+21622123456', governorate: 'Ariana', city: 'Ariana Ville', street: 'Technopole El Ghazala, bloc B', postalCode: '2083' },
        ],
      },
    },
    include: { addresses: true },
  });

  // Une commande livrée (permet de tester les avis) + une commande en cours.
  const home = client.addresses.find((a) => a.isDefault)!;
  const shipping = {
    addressId: home.id, shippingName: home.fullName, shippingPhone: home.phone,
    shippingGov: home.governorate, shippingCity: home.city, shippingStreet: home.street,
  };
  const serum = products.find((p) => p.slug === 'serum-vitamine-c')!;
  const headphones = products.find((p) => p.slug === 'casque-bluetooth-anc')!;
  const days = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

  await prisma.order.create({
    data: {
      number: 'BH-DEMO-0001', userId: client.id, ...shipping,
      status: 'DELIVERED', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PAID',
      subtotal: DT(serum.price * 2), shippingFee: DT(7), total: DT(serum.price * 2 + 7), createdAt: days(6),
      items: { create: { productId: productIds.get(serum.slug), name: serum.nameFr, imageUrl: img(serum.images[0]), unitPrice: DT(serum.price), quantity: 2 } },
      history: {
        create: [
          { status: 'PENDING', createdAt: days(6) },
          { status: 'CONFIRMED', createdAt: days(5) },
          { status: 'SHIPPED', createdAt: days(4) },
          { status: 'DELIVERED', createdAt: days(2) },
        ],
      },
    },
  });
  await prisma.order.create({
    data: {
      number: 'BH-DEMO-0002', userId: client.id, ...shipping,
      status: 'SHIPPED', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'UNPAID',
      subtotal: DT(headphones.price), shippingFee: 0, total: DT(headphones.price), createdAt: days(1),
      items: { create: { productId: productIds.get(headphones.slug), name: headphones.nameFr, imageUrl: img(headphones.images[0]), unitPrice: DT(headphones.price), quantity: 1 } },
      history: {
        create: [
          { status: 'PENDING', createdAt: days(1) },
          { status: 'CONFIRMED', createdAt: inHours(-20) },
          { status: 'SHIPPED', createdAt: inHours(-3) },
        ],
      },
    },
  });

  // Avis (note moyenne dénormalisée mise à jour ensuite)
  const reviewers = await Promise.all(
    ['Youssef Trabelsi', 'Salma Jebali', 'Karim Mansour'].map((name, i) => {
      const [firstName, lastName] = name.split(' ');
      return prisma.user.create({
        data: { email: `avis${i + 1}@buyhere.tn`, firstName, lastName, passwordHash },
      });
    }),
  );
  const comments = [
    'Très bon produit, conforme à la description. Livraison rapide à Sfax !',
    'Bonne qualité pour le prix. Je recommande.',
    'Correct, mais la taille est un peu grande.',
    'Excellent, je vais en recommander.',
  ];
  const reviewed = [...productIds.entries()].filter((_, i) => i % 2 === 0);
  for (const [i, [, productId]] of reviewed.entries()) {
    const authors = [client, ...reviewers].slice(0, (i % 3) + 2);
    for (const [j, author] of authors.entries()) {
      await prisma.review.create({
        data: { userId: author.id, productId, rating: 5 - ((i + j) % 3 === 2 ? 2 : (i + j) % 2), comment: comments[(i + j) % comments.length] },
      });
    }
    const agg = await prisma.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.product.update({
      where: { id: productId },
      data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all },
    });
  }

  // Favoris et notifications de démo
  await prisma.favorite.createMany({
    data: ['robe-ete-fleurie', 'baskets-running', 'montre-connectee'].map((slug) => ({
      userId: client.id,
      productId: productIds.get(slug)!,
    })),
  });
  await prisma.notification.createMany({
    data: [
      { userId: client.id, type: 'ORDER', title: 'Commande BH-DEMO-0002', body: 'Votre commande a été expédiée.', createdAt: inHours(-3) },
      { userId: client.id, type: 'PROMO', title: 'Vente flash 🔥', body: 'Jusqu’à -30 % sur une sélection pendant 24 h.', createdAt: inHours(-10) },
      { userId: client.id, type: 'ORDER', title: 'Commande BH-DEMO-0001', body: 'Votre commande a été livrée. Merci !', readAt: days(2), createdAt: days(2) },
    ],
  });

  console.log(`✅ ${categories.length} catégories, ${products.length} produits, 3 coupons, 3 bannières.`);
  console.log(`   Comptes démo (mot de passe « BuyHere2026 ») : client@buyhere.tn, admin@buyhere.tn (${admin.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
