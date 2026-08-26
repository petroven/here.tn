import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import Gouvernorat from './Gouvernorat.js';
import Delegation from './Delegation.js';
import Variante from './Variante.js';
import Wishlist from './Wishlist.js';
import Coupon from './Coupon.js';
import Retour from './Retour.js';
import Livraison from './Livraison.js';
import PasswordResetToken from './PasswordResetToken.js';
import PrixHistorique from './PrixHistorique.js';
import Livreur from './Livreur.js';
import NotificationLivreur from './NotificationLivreur.js';
import Transaction from './Transaction.js';
import PaymentLog from './PaymentLog.js';
import WalletTransaction from './WalletTransaction.js';

export const Utilisateur = sequelize.define('Utilisateur', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  prenom: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  // Toujours renseigné, y compris pour les comptes OAuth (hash aléatoire
  // inutilisable — voir passport.js) : la colonne existante est NOT NULL
  // en base et SQLite ne permet pas de l'assouplir sans recréer la table
  // (bloqué par les FK d'autres tables), donc on évite ce risque.
  password: { type: DataTypes.STRING, allowNull: false },
  telephone: { type: DataTypes.STRING, allowNull: true },
  role: {
    type: DataTypes.ENUM('client', 'vendeur', 'admin_boutique', 'administrateur', 'super_admin', 'livreur'),
    allowNull: false,
    defaultValue: 'client',
  },
  provider: {
    type: DataTypes.ENUM('local', 'google', 'facebook'),
    allowNull: false,
    defaultValue: 'local',
  },
  providerId: { type: DataTypes.STRING, allowNull: true },
  photo: { type: DataTypes.STRING, allowNull: true },
  gouvernoratId: { type: DataTypes.INTEGER, allowNull: true },
  delegationId: { type: DataTypes.INTEGER, allowNull: true },
  adresse: { type: DataTypes.STRING, allowNull: true },
  soldeWallet: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  // Acceptation obligatoire des conditions générales (dont la politique de
  // retour) à l'inscription — bloquée côté serveur dans authController.js,
  // pas seulement côté client.
  accepteConditions: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

export const Boutique = sequelize.define('Boutique', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  statut: {
    type: DataTypes.ENUM('en_attente', 'validee', 'suspendue'),
    defaultValue: 'en_attente',
  },
  logo: { type: DataTypes.STRING, allowNull: true },
  bannière: { type: DataTypes.STRING, allowNull: true },
  gouvernoratId: { type: DataTypes.INTEGER, allowNull: true },
  delegationId: { type: DataTypes.INTEGER, allowNull: true },
  adresse: { type: DataTypes.STRING, allowNull: true },
  iban: { type: DataTypes.STRING, allowNull: true },
  modePaiement: { type: DataTypes.ENUM('iban', 'flouci'), allowNull: false, defaultValue: 'iban' },
  flouciNumero: { type: DataTypes.STRING, allowNull: true },
  categorie: { type: DataTypes.STRING, allowNull: true },
  latitude: { type: DataTypes.FLOAT, allowNull: true },
  longitude: { type: DataTypes.FLOAT, allowNull: true },
  // Acceptation obligatoire (à l'inscription) des conditions de vente et de
  // retour — remboursement en solde site sous 48h, retour impossible passé
  // ce délai. Un admin ne doit pas pouvoir valider une boutique qui ne l'a
  // pas acceptée.
  accepteConditionsRetour: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

export const Categorie = sequelize.define('Categorie', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  slug: { type: DataTypes.STRING, allowNull: true, unique: true },
  icone: { type: DataTypes.STRING, allowNull: true },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
  // Fenêtre de retour par défaut pour tout produit de cette catégorie, en
  // jours après livraison. NULL = non configurée (le produit retombe sur le
  // délai plateforme par défaut, voir marketplaceConfig.returnPolicy) ; 0 =
  // catégorie explicitement non retournable (ex: alimentaire, cosmétique).
  delaiRetourJours: { type: DataTypes.INTEGER, allowNull: true },
});

export const Produit = sequelize.define('Produit', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nom: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  prix: { type: DataTypes.FLOAT, allowNull: false },
  prixAvant: { type: DataTypes.FLOAT, allowNull: true },
  stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  image: { type: DataTypes.STRING, allowNull: true },
  images: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
  status: {
    type: DataTypes.ENUM('actif', 'inactif', 'en_attente'),
    defaultValue: 'actif',
  },
  hasVariantes: { type: DataTypes.BOOLEAN, defaultValue: false },
  // Le vendeur peut resserrer la fenêtre de retour de sa catégorie (jamais
  // l'élargir — appliqué côté serveur, voir utils/returnPolicy.js) pour un
  // produit particulier, ex: un modèle plus fragile ou plus fraudé.
  delaiRetourJoursOverride: { type: DataTypes.INTEGER, allowNull: true },
});

export const Commande = sequelize.define('Commande', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numeroCommande: { type: DataTypes.STRING, allowNull: true, unique: true },
  groupeCommande: { type: DataTypes.STRING, allowNull: true },
  total: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  sousTotal: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  fraisLivraison: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  remiseCoupon: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  montantCommission: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  montantVendeur: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  statut: {
    type: DataTypes.ENUM('en_attente', 'payee', 'expediee', 'livree', 'annulee', 'retournee'),
    defaultValue: 'en_attente',
  },
  adresseLivraison: { type: DataTypes.STRING, allowNull: false },
  gouvernoratId: { type: DataTypes.INTEGER, allowNull: true },
  delegationId: { type: DataTypes.INTEGER, allowNull: true },
  couponCode: { type: DataTypes.STRING, allowNull: true },
  confirmationStatut: {
    type: DataTypes.ENUM('en_attente', 'confirmee', 'refusee', 'expiree'),
    defaultValue: 'en_attente',
  },
  confirmationToken: { type: DataTypes.STRING, allowNull: true, unique: true },
  confirmationExpiresAt: { type: DataTypes.DATE, allowNull: true },
  confirmationDate: { type: DataTypes.DATE, allowNull: true },
  walletUtilise: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
});

export const LigneCommande = sequelize.define('LigneCommande', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quantite: { type: DataTypes.INTEGER, allowNull: false },
  prixUnitaire: { type: DataTypes.FLOAT, allowNull: false },
  varianteId: { type: DataTypes.INTEGER, allowNull: true },
});

export const Paiement = sequelize.define('Paiement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  montant: { type: DataTypes.FLOAT, allowNull: false },
  methode: {
    type: DataTypes.ENUM('cod', 'konnect', 'flouci', 'carte', 'virement'),
    allowNull: false,
    defaultValue: 'cod',
  },
  statut: {
    type: DataTypes.ENUM('en_attente', 'valide', 'echec', 'en_attente_livraison', 'paye_livraison', 'en_attente_validation'),
    defaultValue: 'en_attente',
  },
  reference: { type: DataTypes.STRING, allowNull: true },
  // Référence/note fournie par le client pour un virement bancaire, afin que
  // l'admin puisse le rapprocher du relevé bancaire réel avant validation.
  referenceVirement: { type: DataTypes.STRING, allowNull: true },
  gatewayResponse: { type: DataTypes.JSON, allowNull: true },
});

export const Retrait = sequelize.define('Retrait', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  montant: { type: DataTypes.FLOAT, allowNull: false },
  statut: {
    type: DataTypes.ENUM('demande', 'approuve', 'verse', 'rejete'),
    defaultValue: 'demande',
  },
  iban: { type: DataTypes.STRING, allowNull: true },
  dateRetrait: { type: DataTypes.DATE, allowNull: true },
  motifRejection: { type: DataTypes.TEXT, allowNull: true },
});

export const Commission = sequelize.define('Commission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  montant: { type: DataTypes.FLOAT, allowNull: false },
  tauxCommission: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0.05 },
  statut: { type: DataTypes.STRING, defaultValue: 'collectee' },
});

export const Avis = sequelize.define('Avis', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { type: DataTypes.ENUM('produit', 'client'), allowNull: false, defaultValue: 'produit' },
  note: { type: DataTypes.INTEGER, allowNull: false },
  commentaire: { type: DataTypes.TEXT, allowNull: true },
  verifie: { type: DataTypes.BOOLEAN, defaultValue: false },
  valide: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export const Conversation = sequelize.define('Conversation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  sujet: { type: DataTypes.STRING, allowNull: true },
  dernierMessage: { type: DataTypes.TEXT, allowNull: true },
  dateDernierMessage: { type: DataTypes.DATE, allowNull: true },
});

export const Message = sequelize.define('Message', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contenu: { type: DataTypes.TEXT, allowNull: false },
  dateEnvoi: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  lu: { type: DataTypes.BOOLEAN, defaultValue: false },
});

export const Panier = sequelize.define('Panier', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  total: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
});

export const LignePanier = sequelize.define('LignePanier', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quantite: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  varianteId: { type: DataTypes.INTEGER, allowNull: true },
});

export const MouvementStock = sequelize.define('MouvementStock', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  variation: { type: DataTypes.INTEGER, allowNull: false },
  stockAvant: { type: DataTypes.INTEGER, allowNull: false },
  stockApres: { type: DataTypes.INTEGER, allowNull: false },
  motif: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ajustement_manuel' },
  note: { type: DataTypes.STRING, allowNull: true },
  utilisateurId: { type: DataTypes.INTEGER, allowNull: true },
});

// Associations
Utilisateur.hasOne(Boutique, { foreignKey: 'vendeurId', as: 'boutique' });
Boutique.belongsTo(Utilisateur, { foreignKey: 'vendeurId', as: 'vendeur' });
Boutique.hasMany(Produit, { foreignKey: 'boutiqueId' });
Produit.belongsTo(Boutique, { foreignKey: 'boutiqueId', as: 'boutique' });
Categorie.hasMany(Produit, { foreignKey: 'categorieId' });
Produit.belongsTo(Categorie, { foreignKey: 'categorieId', as: 'categorie' });
Categorie.hasMany(Categorie, { foreignKey: 'parentId', as: 'sousCategories' });
Categorie.belongsTo(Categorie, { foreignKey: 'parentId', as: 'parent' });

Utilisateur.hasMany(Commande, { foreignKey: 'clientId' });
Commande.belongsTo(Utilisateur, { foreignKey: 'clientId', as: 'client' });
Commande.hasMany(LigneCommande, { foreignKey: 'commandeId', as: 'lignes' });
LigneCommande.belongsTo(Commande, { foreignKey: 'commandeId' });
Produit.hasMany(LigneCommande, { foreignKey: 'produitId' });
LigneCommande.belongsTo(Produit, { foreignKey: 'produitId', as: 'produit' });
Variante.hasMany(LigneCommande, { foreignKey: 'varianteId' });
LigneCommande.belongsTo(Variante, { foreignKey: 'varianteId', as: 'variante' });

Commande.hasOne(Paiement, { foreignKey: 'commandeId', as: 'paiement' });
Paiement.belongsTo(Commande, { foreignKey: 'commandeId' });
Commande.hasOne(Livraison, { foreignKey: 'commandeId', as: 'livraison' });
Livraison.belongsTo(Commande, { foreignKey: 'commandeId' });

Utilisateur.hasOne(Livreur, { foreignKey: 'utilisateurId', as: 'profilLivreur' });
Livreur.belongsTo(Utilisateur, { foreignKey: 'utilisateurId', as: 'utilisateur' });
Livreur.hasMany(Livraison, { foreignKey: 'livreurId', as: 'courses' });
Livraison.belongsTo(Livreur, { foreignKey: 'livreurId', as: 'livreur' });

Livraison.hasMany(NotificationLivreur, { foreignKey: 'livraisonId', as: 'notifications' });
NotificationLivreur.belongsTo(Livraison, { foreignKey: 'livraisonId' });
Livreur.hasMany(NotificationLivreur, { foreignKey: 'livreurId', as: 'notifications' });
NotificationLivreur.belongsTo(Livreur, { foreignKey: 'livreurId' });

Commande.hasMany(Transaction, { foreignKey: 'commandeId', as: 'transactions' });
Transaction.belongsTo(Commande, { foreignKey: 'commandeId' });
Utilisateur.hasMany(Transaction, { foreignKey: 'utilisateurId' });
Transaction.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Transaction.hasMany(PaymentLog, { foreignKey: 'transactionId', as: 'logs' });
PaymentLog.belongsTo(Transaction, { foreignKey: 'transactionId' });

Utilisateur.hasMany(WalletTransaction, { foreignKey: 'utilisateurId', as: 'walletTransactions' });
WalletTransaction.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Commande.hasMany(WalletTransaction, { foreignKey: 'commandeId' });
WalletTransaction.belongsTo(Commande, { foreignKey: 'commandeId' });

Utilisateur.hasMany(Avis, { foreignKey: 'auteurId' });
Avis.belongsTo(Utilisateur, { foreignKey: 'auteurId', as: 'auteur' });
Utilisateur.hasMany(Avis, { foreignKey: 'cibleId', as: 'avisRecus' });
Avis.belongsTo(Utilisateur, { foreignKey: 'cibleId', as: 'cible' });
Produit.hasMany(Avis, { foreignKey: 'produitId' });
Avis.belongsTo(Produit, { foreignKey: 'produitId', as: 'produit' });
Commande.hasMany(Avis, { foreignKey: 'commandeId' });
Avis.belongsTo(Commande, { foreignKey: 'commandeId' });

Utilisateur.hasMany(Conversation, { foreignKey: 'clientId', as: 'conversationsClient' });
Conversation.belongsTo(Utilisateur, { foreignKey: 'clientId', as: 'client' });
Utilisateur.hasMany(Conversation, { foreignKey: 'vendeurId', as: 'conversationsVendeur' });
Conversation.belongsTo(Utilisateur, { foreignKey: 'vendeurId', as: 'vendeur' });
Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });
Utilisateur.hasMany(Message, { foreignKey: 'expediteurId', as: 'messagesEnvoyes' });
Message.belongsTo(Utilisateur, { foreignKey: 'expediteurId', as: 'expediteur' });

Utilisateur.hasOne(Panier, { foreignKey: 'utilisateurId' });
Panier.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Panier.hasMany(LignePanier, { foreignKey: 'panierId', as: 'lignes' });
LignePanier.belongsTo(Panier, { foreignKey: 'panierId' });
Produit.hasMany(LignePanier, { foreignKey: 'produitId' });
LignePanier.belongsTo(Produit, { foreignKey: 'produitId', as: 'produit' });
Produit.hasMany(MouvementStock, { foreignKey: 'produitId', as: 'mouvementsStock' });
MouvementStock.belongsTo(Produit, { foreignKey: 'produitId', as: 'produit' });
Variante.hasMany(MouvementStock, { foreignKey: 'varianteId', as: 'mouvementsStock' });
MouvementStock.belongsTo(Variante, { foreignKey: 'varianteId', as: 'variante' });
Utilisateur.hasMany(MouvementStock, { foreignKey: 'utilisateurId', as: 'mouvementsStock' });
MouvementStock.belongsTo(Utilisateur, { foreignKey: 'utilisateurId', as: 'utilisateur' });

Boutique.hasMany(Commande, { foreignKey: 'boutiqueId' });
Commande.belongsTo(Boutique, { foreignKey: 'boutiqueId', as: 'boutique' });
Boutique.hasMany(Retrait, { foreignKey: 'boutiqueId' });
Retrait.belongsTo(Boutique, { foreignKey: 'boutiqueId' });
Commande.hasOne(Commission, { foreignKey: 'commandeId' });
Commission.belongsTo(Commande, { foreignKey: 'commandeId' });
Boutique.hasMany(Commission, { foreignKey: 'boutiqueId' });
Commission.belongsTo(Boutique, { foreignKey: 'boutiqueId' });

Produit.hasMany(Variante, { foreignKey: 'produitId', as: 'variantes' });
Variante.belongsTo(Produit, { foreignKey: 'produitId' });

Utilisateur.hasMany(Wishlist, { foreignKey: 'utilisateurId' });
Wishlist.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });
Produit.hasMany(Wishlist, { foreignKey: 'produitId' });
Wishlist.belongsTo(Produit, { foreignKey: 'produitId', as: 'produit' });

Gouvernorat.hasMany(Delegation, { foreignKey: 'gouvernoratId', as: 'delegations' });
Delegation.belongsTo(Gouvernorat, { foreignKey: 'gouvernoratId' });
Gouvernorat.hasMany(Utilisateur, { foreignKey: 'gouvernoratId' });
Gouvernorat.hasMany(Boutique, { foreignKey: 'gouvernoratId' });
Boutique.belongsTo(Gouvernorat, { foreignKey: 'gouvernoratId' });
Gouvernorat.hasMany(Commande, { foreignKey: 'gouvernoratId' });
Delegation.hasMany(Utilisateur, { foreignKey: 'delegationId' });
Delegation.hasMany(Boutique, { foreignKey: 'delegationId' });
Boutique.belongsTo(Delegation, { foreignKey: 'delegationId' });
Delegation.hasMany(Commande, { foreignKey: 'delegationId' });

Commande.hasMany(Retour, { foreignKey: 'commandeId', as: 'retours' });
Retour.belongsTo(Commande, { foreignKey: 'commandeId' });
Utilisateur.hasMany(Retour, { foreignKey: 'clientId' });
Retour.belongsTo(Utilisateur, { foreignKey: 'clientId', as: 'client' });
Boutique.hasMany(Retour, { foreignKey: 'boutiqueId' });
Retour.belongsTo(Boutique, { foreignKey: 'boutiqueId', as: 'boutique' });
Retour.hasOne(WalletTransaction, { foreignKey: 'retourId' });
WalletTransaction.belongsTo(Retour, { foreignKey: 'retourId' });

Utilisateur.hasMany(PasswordResetToken, { foreignKey: 'utilisateurId' });
PasswordResetToken.belongsTo(Utilisateur, { foreignKey: 'utilisateurId' });

Produit.hasMany(PrixHistorique, { foreignKey: 'produitId', as: 'historiquePrix' });
PrixHistorique.belongsTo(Produit, { foreignKey: 'produitId' });

export {
  Gouvernorat,
  Delegation,
  Variante,
  Wishlist,
  Coupon,
  Retour,
  Livraison,
  PasswordResetToken,
  PrixHistorique,
  Livreur,
  NotificationLivreur,
  Transaction,
  PaymentLog,
  WalletTransaction,
};

export default sequelize;
