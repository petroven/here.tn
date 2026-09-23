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

// Boutiques additionnelles — au-delà du compte vendeur "officiel"
// (boutique.admin@here.tn, déjà documenté comme compte de démo), pour que
// StoresPage/l'accueil ne montrent pas un catalogue à vendeur unique. Chacune
// a son propre compte vendeur (mot de passe généré, non documenté comme
// identifiant de démo — seuls les 4 comptes historiques le sont).
const additionalDemoBoutiques = [
  {
    email: 'vendeur1.demo@here.tn',
    nom: 'Nasri',
    prenom: 'Youssef',
    telephone: '23123456',
    boutique: {
      nom: 'Atelier Kairouan',
      description: 'Artisanat tunisien authentique, produits du terroir et décoration faits main.',
      adresse: 'Kairouan',
    },
  },
  {
    email: 'vendeur2.demo@here.tn',
    nom: 'Chaouch',
    prenom: 'Mariem',
    telephone: '24123456',
    boutique: {
      nom: 'GadgetPro Sfax',
      description: 'Informatique, gaming et électronique — les dernières nouveautés tech en Tunisie.',
      adresse: 'Sfax',
    },
  },
];

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
        accepteConditionsRetour: true,
        categorie: 'Multi-categories',
        adresse: 'Tunis',
      },
    });
    demoBoutique = boutique;
  }

  const autresBoutiques = [];
  for (const item of additionalDemoBoutiques) {
    const password = await bcrypt.hash('VendeurDemo2026!', 10);
    const [vendeur] = await Utilisateur.findOrCreate({
      where: { email: item.email },
      defaults: { nom: item.nom, prenom: item.prenom, email: item.email, password, role: 'vendeur', telephone: item.telephone },
    });
    const [boutique] = await Boutique.findOrCreate({
      where: { vendeurId: vendeur.id },
      defaults: {
        vendeurId: vendeur.id,
        statut: 'validee',
        accepteConditionsRetour: true,
        modePaiement: 'iban',
        ...item.boutique,
      },
    });
    autresBoutiques.push(boutique);
  }

  await seedDemoProducts(demoBoutique, autresBoutiques[0], autresBoutiques[1]);
  console.log(`[SEED] Comptes de demonstration verifies: client, admin boutique (+${autresBoutiques.length} boutiques additionnelles), super admin, livreur.`);
}

// Photos Unsplash déjà éprouvées dans cette app (chargent réellement, pas de
// clé API requise) — réutilisées en rotation plutôt que de parier sur de
// nouveaux ID Unsplash devinés à l'aveugle, qui casseraient silencieusement
// si l'ID n'existe pas. Pas de vraie photographie produit distincte par
// article : compromis assumé, aucun accès internet dans cet environnement
// pour en générer/récupérer 30 différentes.
const stockImages = [
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=80',
];

// categorieSlug référence les VRAIES catégories de la taxonomie (voir
// marketplaceTaxonomy ci-dessus), pas un nom libre — l'ancienne version
// créait une catégorie orpheline par nom ("Mode", "Electronique"...) jamais
// reliée à l'arbre réel de navigation, donc invisible dans le tiroir de
// catégories et les filtres du catalogue.
const demoCatalog = [
  // Mode, Chaussures & Accessoires
  { nom: 'Sac cabas artisanal Medina', description: 'Sac tunisien pratique en toile et cuir, adapte au quotidien.', prix: 59.9, prixAvant: 74.9, stock: 18, categorieSlug: 'accessoires-de-mode' },
  { nom: 'Baskets urbaines Tunis', description: 'Baskets confortables pour la ville, disponibles en plusieurs pointures.', prix: 119, stock: 15, categorieSlug: 'mode-homme', variantes: [{ pointure: '40', stock: 5 }, { pointure: '41', stock: 5 }, { pointure: '42', stock: 5 }] },
  { nom: 'Robe d ete Djerba', description: 'Robe legere en coton, coupe fluide pour l ete tunisien.', prix: 79, stock: 14, categorieSlug: 'mode-femme', variantes: [{ taille: 'S', stock: 4 }, { taille: 'M', stock: 6 }, { taille: 'L', stock: 4 }] },

  // Maison, Déco & Bricolage
  { nom: 'Lampe en rotin Sidi Bou Said', description: 'Lampe decorative artisanale pour une lumiere douce et chaleureuse.', prix: 89, stock: 9, categorieSlug: 'decoration-linge' },
  { nom: 'Set de coussins brodes Kilim', description: 'Housses de coussin brodees a la main, motifs traditionnels tunisiens.', prix: 65, stock: 20, categorieSlug: 'decoration-linge' },

  // Beauté, Santé & Parapharmacie
  { nom: 'Coffret soins naturels Nabeul', description: 'Selection de soins aux huiles naturelles pour le corps et les mains.', prix: 42.5, stock: 24, categorieSlug: 'soins-cosmetiques' },
  { nom: 'Parfum artisanal Fleur d Oranger', description: 'Eau de toilette a la fleur d oranger, distillee en Tunisie.', prix: 55, stock: 16, categorieSlug: 'parfums' },

  // Téléphonie & Objets Connectés
  { nom: 'Montre connectee Carthage Fit', description: 'Suivi de l activite, notifications et autonomie longue duree.', prix: 149, prixAvant: 179, stock: 12, categorieSlug: 'montres-objets-connectes' },
  { nom: 'Smartphone Atlas X5', description: 'Smartphone Android 5G avec grand ecran, double SIM et appareil photo haute resolution.', prix: 899, prixAvant: 999, stock: 8, categorieSlug: 'smartphones' },
  { nom: 'Tablette Carthage 10 pouces', description: 'Tablette legere pour le travail, les cours et le divertissement en famille.', prix: 449, stock: 10, categorieSlug: 'tablettes' },
  { nom: 'Powerbank Tunisie 20000 mAh', description: 'Batterie externe rapide pour smartphone, tablette et accessoires connectes.', prix: 69, stock: 25, categorieSlug: 'accessoires-mobiles' },
  { nom: 'Ecouteurs sans fil Jasmin', description: 'Ecouteurs compacts avec boitier de recharge et microphone integre.', prix: 79, stock: 20, categorieSlug: 'accessoires-mobiles' },

  // Informatique, Gaming & High-Tech (GadgetPro Sfax)
  { nom: 'PC Portable ProBook 15', description: 'Ordinateur portable 15 pouces, ideal bureautique et etudes, SSD rapide.', prix: 1699, prixAvant: 1899, stock: 6, categorieSlug: 'ordinateurs', boutiqueIndex: 2 },
  { nom: 'Souris Gamer RGB Nova', description: 'Souris gaming haute precision avec eclairage RGB personnalisable.', prix: 89, stock: 22, categorieSlug: 'gaming', boutiqueIndex: 2 },
  { nom: 'Clavier mecanique Strike TN', description: 'Clavier mecanique retroeclaire, switches reactifs pour gaming et bureautique.', prix: 159, stock: 14, categorieSlug: 'gaming', boutiqueIndex: 2 },

  // Image, Son & Électroménager (GadgetPro Sfax)
  { nom: 'Barre de son Atlas SoundBar', description: 'Barre de son compacte avec basses profondes, connexion Bluetooth.', prix: 249, stock: 9, categorieSlug: 'tv-audio', boutiqueIndex: 2 },
  { nom: 'Mini-four Sfax Cuisine 20L', description: 'Mini-four multifonction pour cuisine compacte, 20 litres.', prix: 189, stock: 11, categorieSlug: 'petit-electromenager', boutiqueIndex: 2 },

  // Bébé, Puériculture & Enfants
  { nom: 'Poussette 3-en-1 Confort Bebe', description: 'Poussette modulable avec nacelle et siege auto, confort et securite.', prix: 599, prixAvant: 699, stock: 5, categorieSlug: 'materiel-bebe' },
  { nom: 'Peluche douce Eveil Jasmin', description: 'Peluche hypoallergenique pour l eveil des tout-petits.', prix: 29, stock: 30, categorieSlug: 'jouets-eveil' },

  // Artisanat & Produits du Terroir (Atelier Kairouan)
  { nom: 'Huile d olive Bio Kairouan 1L', description: 'Huile d olive extra vierge, premiere pression a froid, terroir de Kairouan.', prix: 32, stock: 40, categorieSlug: 'terroir-tunisien', boutiqueIndex: 1 },
  { nom: 'Poterie artisanale Nabeul', description: 'Piece en ceramique peinte a la main par des artisans de Nabeul.', prix: 75, stock: 10, categorieSlug: 'artisanat-tunisien', boutiqueIndex: 1 },
  { nom: 'Tapis berbere fait main', description: 'Tapis en laine tisse a la main selon des techniques ancestrales.', prix: 349, stock: 6, categorieSlug: 'artisanat-tunisien', boutiqueIndex: 1, variantes: [{ couleur: 'Ocre', stock: 3 }, { couleur: 'Bordeaux', stock: 3 }] },

  // Supermarché & Alimentation
  { nom: 'Coffret dattes Deglet Nour 1kg', description: 'Dattes premium du sud tunisien, coffret cadeau 1kg.', prix: 24, stock: 35, categorieSlug: 'epicerie-sucree-salee' },
  { nom: 'The vert a la menthe Nana', description: 'Melange traditionnel the vert et menthe fraiche, boite 200g.', prix: 12.5, stock: 50, categorieSlug: 'boissons' },

  // Sports, Loisirs & Voyage (Atelier Kairouan)
  { nom: 'Sac de voyage Sahara 60L', description: 'Sac de voyage robuste, compartiments multiples, ideal week-end et randonnee.', prix: 129, stock: 13, categorieSlug: 'bagagerie', boutiqueIndex: 1 },
  { nom: 'Tapis de fitness Pro', description: 'Tapis de sol antiderapant pour yoga et fitness a domicile.', prix: 45, stock: 28, categorieSlug: 'fitness-musculation', boutiqueIndex: 1 },

  // Auto, Moto & Accessoires (Atelier Kairouan)
  { nom: 'Housse de siege auto premium', description: 'Housses universelles renforcees, confort et protection longue duree.', prix: 99, stock: 17, categorieSlug: 'accessoires-auto', boutiqueIndex: 1, variantes: [{ couleur: 'Noir', stock: 9 }, { couleur: 'Gris', stock: 8 }] },
  { nom: 'Kit entretien moto complet', description: 'Kit complet nettoyage et entretien pour moto et scooter.', prix: 59, stock: 21, categorieSlug: 'entretien-pieces', boutiqueIndex: 1 },

  // Librairie, Papeterie & Bureau
  { nom: 'Lot 5 cahiers scolaires 200p', description: 'Lot de 5 cahiers grands carreaux, 200 pages, rentree scolaire.', prix: 15, stock: 60, categorieSlug: 'fournitures-scolaires-bureau' },
  { nom: 'Roman tunisien contemporain', description: 'Recit contemporain d un auteur tunisien, edition broche.', prix: 22, stock: 25, categorieSlug: 'livres' },
];

async function seedDemoProducts(boutiquePrincipale, boutiqueArtisanat, boutiqueTech) {
  if (!boutiquePrincipale) return;
  const boutiques = [boutiquePrincipale, boutiqueArtisanat, boutiqueTech];

  let nombreCrees = 0;
  for (const item of demoCatalog) {
    const boutique = boutiques[item.boutiqueIndex || 0];
    if (!boutique) continue; // boutique additionnelle pas encore créée (ex: seed partiel) — on saute plutôt que de planter

    const categorie = await Categorie.findOne({ where: { slug: item.categorieSlug } });
    if (!categorie) {
      console.warn(`[SEED] Categorie introuvable pour le slug "${item.categorieSlug}" — produit "${item.nom}" ignore.`);
      continue;
    }

    const image = stockImages[nombreCrees % stockImages.length];
    const [produit, created] = await Produit.findOrCreate({
      where: { nom: item.nom, boutiqueId: boutique.id },
      defaults: {
        nom: item.nom,
        description: item.description,
        prix: item.prix,
        prixAvant: item.prixAvant || null,
        stock: item.stock,
        image,
        images: [image],
        status: 'actif',
        boutiqueId: boutique.id,
        categorieId: categorie.id,
        hasVariantes: Boolean(item.variantes?.length),
      },
    });
    // Répare les produits déjà semés avant l'introduction de la vraie
    // taxonomie (categorieId pointait vers une catégorie orpheline créée par
    // nom libre) — sans ça, un produit existant reste invisible dans le
    // tiroir de catégories même après cette mise à jour du seed.
    if (!created && produit.categorieId !== categorie.id) {
      await produit.update({ categorieId: categorie.id });
    }
    if (created) nombreCrees += 1;

    if (!item.variantes?.length) continue;
    for (const variant of item.variantes) {
      await Variante.findOrCreate({
        where: { produitId: produit.id, pointure: variant.pointure || null, couleur: variant.couleur || null, taille: variant.taille || null },
        defaults: { produitId: produit.id, ...variant, prixSupplement: 0 },
      });
    }
  }
  console.log(`[SEED] Catalogue de demonstration verifie: ${demoCatalog.length} produits repartis sur ${boutiques.filter(Boolean).length} boutiques.`);
}
