import bcrypt from 'bcryptjs';
import { Boutique, Categorie, Produit, Utilisateur, Variante, Livreur } from '../models/index.js';

export const demoProducts = [
  {
    id: 1,
    nom: 'Sac en cuir vintage',
    description: 'Sac de créateur en cuir de qualité premium.',
    prix: 89,
    stock: 12,
    categorie: 'Mode',
    boutiqueId: 1,
    vendeurId: 1,
  },
  {
    id: 2,
    nom: 'Lampe design scandinave',
    description: 'Lampe minimaliste pour un intérieur chaleureux.',
    prix: 120,
    stock: 7,
    categorie: 'Décoration',
    boutiqueId: 1,
    vendeurId: 1,
  },
  {
    id: 3,
    nom: 'Montre connectée premium',
    description: 'Montre intelligente avec suivi santé et notifications.',
    prix: 189,
    stock: 9,
    categorie: 'Technologie',
    boutiqueId: 2,
    vendeurId: 2,
  },
];

export const demoBoutiques = [
  { id: 1, nom: 'Luna Atelier', description: 'Mode et accessoires artisanaux.', userId: 1 },
  { id: 2, nom: 'Nord Maison', description: 'Décoration et objets du quotidien.', userId: 2 },
];

export const demoUsers = [
  { id: 1, nom: 'Alice', prenom: 'Martin', email: 'alice@example.com', role: 'vendeur' },
  { id: 2, nom: 'Noah', prenom: 'Dubois', email: 'noah@example.com', role: 'vendeur' },
  { id: 3, nom: 'Sonia', prenom: 'Leroy', email: 'sonia@example.com', role: 'client' },
];

export const demoAccounts = [
  {
    nom: 'Ben Salah',
    prenom: 'Amine',
    email: process.env.DEMO_CLIENT_EMAIL || 'client.demo@here.tn',
    password: process.env.DEMO_CLIENT_PASSWORD || 'ClientDemo2026!',
    role: 'client',
    telephone: '20123456',
  },
  {
    nom: 'Trabelsi',
    prenom: 'Meriem',
    email: process.env.DEMO_BOUTIQUE_ADMIN_EMAIL || 'boutique.admin@here.tn',
    password: process.env.DEMO_BOUTIQUE_ADMIN_PASSWORD || 'BoutiqueDemo2026!',
    role: 'admin_boutique',
    telephone: '22123456',
  },
  {
    nom: 'Admin',
    prenom: 'Super',
    email: process.env.DEMO_SUPER_ADMIN_EMAIL || 'super.admin@here.tn',
    password: process.env.DEMO_SUPER_ADMIN_PASSWORD || 'SuperAdminDemo2026!',
    role: 'super_admin',
    telephone: '70123456',
  },
  {
    nom: 'Chaabane',
    prenom: 'Karim',
    email: process.env.DEMO_LIVREUR_EMAIL || 'livreur.demo@here.tn',
    password: process.env.DEMO_LIVREUR_PASSWORD || 'LivreurDemo2026!',
    role: 'livreur',
    telephone: '25123456',
  },
];

// delaiRetourJours par univers : 7j pour l'électronique/high-tech (risque de
// fraude élevé), 14j pour le textile/maison/sport (standard, faible risque),
// 0 = non retournable (alimentaire, cosmétique ouvert, artisanat/terroir
// souvent fait à la demande). Un admin peut ajuster ces valeurs ensuite
// (voir /admin/categories) — ce ne sont que des valeurs de départ.
const marketplaceTaxonomy = [
  ['Informatique, Gaming & High-Tech', ['Ordinateurs', 'Composants PC', 'Gaming', 'Réseau & Périphériques'], 7],
  ['Téléphonie & Objets Connectés', ['Smartphones', 'Tablettes', 'Accessoires mobiles', 'Montres & Objets connectés'], 7],
  ['Image, Son & Électroménager', ['TV & Audio', 'Gros Électroménager', 'Petit Électroménager'], 7],
  ['Mode, Chaussures & Accessoires', ['Mode Homme', 'Mode Femme', 'Accessoires de mode'], 14],
  ['Bébé, Puériculture & Enfants', ['Matériel Bébé', 'Repas & Soins bébé', 'Mode Enfant', 'Jouets & Éveil'], 14],
  ['Beauté, Santé & Parapharmacie', ['Soins & Cosmétiques', 'Parfums', 'Parapharmacie', 'Épilateurs & Rasage'], 0],
  ['Maison, Déco & Bricolage', ['Meubles', 'Décoration & Linge', 'Bricolage & Outillage', 'Jardin & Extérieur'], 14],
  ['Artisanat & Produits du Terroir', ['Terroir Tunisien', 'Artisanat Tunisien'], 0],
  ['Supermarché & Alimentation', ['Épicerie sucrée & salée', 'Boissons', "Produits d'entretien"], 0],
  ['Sports, Loisirs & Voyage', ['Fitness & Musculation', "Sports d'extérieur", 'Bagagerie'], 14],
  ['Auto, Moto & Accessoires', ['Entretien & Pièces', 'Accessoires Auto', 'Moto & Scooter'], 7],
  ['Librairie, Papeterie & Bureau', ['Fournitures scolaires & Bureau', 'Livres'], 14],
];

function toSlug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function seedMarketplaceCategories() {
  for (const [parentName, children, delaiRetourJours] of marketplaceTaxonomy) {
    const [parent] = await Categorie.findOrCreate({
      where: { slug: toSlug(parentName) },
      defaults: { nom: parentName, slug: toSlug(parentName), icone: 'shopping-bag', description: `Univers ${parentName}.`, delaiRetourJours },
    });
    if (parent.delaiRetourJours === null) await parent.update({ delaiRetourJours });

    for (const childName of children) {
      const [child] = await Categorie.findOrCreate({
        where: { slug: toSlug(childName) },
        defaults: { nom: childName, slug: toSlug(childName), parentId: parent.id, icone: 'tag', description: `Sous-categorie ${childName}.`, delaiRetourJours },
      });
      if (child.delaiRetourJours === null) await child.update({ delaiRetourJours });
    }
  }
  console.log(`[SEED] Taxonomie marketplace verifiee: ${marketplaceTaxonomy.length} univers.`);
}

export async function seedDemoAccounts() {
  let demoBoutique = null;
  for (const account of demoAccounts) {
    const password = await bcrypt.hash(account.password, 10);
    const [user] = await Utilisateur.findOrCreate({
      where: { email: account.email },
      defaults: {
        nom: account.nom,
        prenom: account.prenom,
        email: account.email,
        password,
        role: account.role,
        telephone: account.telephone,
      },
    });

    if (account.role === 'livreur') {
      await Livreur.findOrCreate({ where: { utilisateurId: user.id }, defaults: { utilisateurId: user.id, statut: 'disponible' } });
      continue;
    }

    if (account.role !== 'admin_boutique') continue;

    const [boutique] = await Boutique.findOrCreate({
      where: { vendeurId: user.id },
      defaults: {
        vendeurId: user.id,
        nom: 'Demo Market TN',
        description: 'Boutique de demonstration pour tester les acces vendeur.',
        statut: 'validee',
        categorie: 'Multi-categories',
        adresse: 'Tunis',
      },
    });
    demoBoutique = boutique;
  }

  await seedDemoProducts(demoBoutique);
  console.log('[SEED] Comptes de demonstration verifies: client, admin boutique, super admin, livreur.');
}

const demoCatalog = [
  {
    nom: 'Sac cabas artisanal Medina',
    description: 'Sac tunisien pratique en toile et cuir, adapte au quotidien.',
    prix: 59.9,
    prixAvant: 74.9,
    stock: 18,
    categorie: 'Mode',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
  },
  {
    nom: 'Lampe en rotin Sidi Bou Said',
    description: 'Lampe decorative artisanale pour une lumiere douce et chaleureuse.',
    prix: 89,
    stock: 9,
    categorie: 'Maison',
    image: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=900&q=80',
  },
  {
    nom: 'Montre connectee Carthage Fit',
    description: 'Suivi de l activite, notifications et autonomie longue duree.',
    prix: 149,
    prixAvant: 179,
    stock: 12,
    categorie: 'Electronique',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  },
  {
    nom: 'Coffret soins naturels Nabeul',
    description: 'Selection de soins aux huiles naturelles pour le corps et les mains.',
    prix: 42.5,
    stock: 24,
    categorie: 'Beaute',
    image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80',
  },
  {
    nom: 'Baskets urbaines Tunis',
    description: 'Baskets confortables pour la ville, disponibles en plusieurs pointures.',
    prix: 119,
    stock: 15,
    categorie: 'Sport',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    variantes: [
      { pointure: '40', stock: 5 },
      { pointure: '41', stock: 5 },
      { pointure: '42', stock: 5 },
    ],
  },
  {
    nom: 'Ecouteurs sans fil Jasmin',
    description: 'Ecouteurs compacts avec boitier de recharge et microphone integre.',
    prix: 79,
    stock: 20,
    categorie: 'Technologie',
    image: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80',
  },
  {
    nom: 'Smartphone Atlas X5',
    description: 'Smartphone Android 5G avec grand ecran, double SIM et appareil photo haute resolution.',
    prix: 899,
    prixAvant: 999,
    stock: 8,
    categorie: 'Smartphones',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
  },
  {
    nom: 'Tablette Carthage 10 pouces',
    description: 'Tablette legere pour le travail, les cours et le divertissement en famille.',
    prix: 449,
    stock: 10,
    categorie: 'Tablettes',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=80',
  },
  {
    nom: 'Powerbank Tunisie 20000 mAh',
    description: 'Batterie externe rapide pour smartphone, tablette et accessoires connectes.',
    prix: 69,
    stock: 25,
    categorie: 'Accessoires mobiles',
    image: 'https://images.unsplash.com/photo-1609592424856-6e2a5b2d8b6e?auto=format&fit=crop&w=900&q=80',
  },
];

async function seedDemoProducts(boutique) {
  if (!boutique) return;

  for (const item of demoCatalog) {
    const [categorie] = await Categorie.findOrCreate({
      where: { nom: item.categorie },
      defaults: { nom: item.categorie, description: `Categorie ${item.categorie} de demonstration.` },
    });

    const [produit] = await Produit.findOrCreate({
      where: { nom: item.nom, boutiqueId: boutique.id },
      defaults: {
        nom: item.nom,
        description: item.description,
        prix: item.prix,
        prixAvant: item.prixAvant || null,
        stock: item.stock,
        image: item.image,
        images: [item.image],
        status: 'actif',
        boutiqueId: boutique.id,
        categorieId: categorie.id,
        hasVariantes: Boolean(item.variantes?.length),
      },
    });

    if (!item.variantes?.length) continue;
    for (const variant of item.variantes) {
      await Variante.findOrCreate({
        where: { produitId: produit.id, pointure: variant.pointure },
        defaults: { produitId: produit.id, pointure: variant.pointure, stock: variant.stock, prixSupplement: 0 },
      });
    }
  }
  console.log(`[SEED] Catalogue de demonstration verifie: ${demoCatalog.length} produits.`);
}
