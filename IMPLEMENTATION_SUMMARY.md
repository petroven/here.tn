# here.tn - Marketplace Bilingue Tunisien

> **Document historique.** Ce résumé décrit les premières fonctionnalités livrées. Il n'est plus tenu à jour : l'état réel, l'architecture et la configuration de production sont dans [`DOCUMENTATION.md`](DOCUMENTATION.md) et [`README.md`](README.md). Les tâches restantes et les validations effectivement passées sont dans [`CLAUDE_TASKS.md`](CLAUDE_TASKS.md).

## Fonctionnalités initiales

Le site est fonctionnel en développement. La mise en production réelle demande encore la configuration des paiements, des emails et de la publication mobile (voir `README.md`, section « Avant une mise en production réelle »).

---

## 📦 Fonctionnalités Implémentées

### 1. **Localization (i18n)**
- ✅ Support Français/Arabe complet
- ✅ Tous les textes de l'interface traduits
- ✅ Commutateur de langue en temps réel
- **Fichier:** `client/src/i18n.js`

### 2. **Système d'Authentification**
- ✅ Inscription (clients et vendeurs)
- ✅ Connexion avec JWT
- ✅ Gestion des rôles (client, vendeur, administrateur)
- **Routes:** `/api/auth/register`, `/api/auth/login`

### 3. **Gestion des Vendeurs**
- ✅ Inscription vendeur avec création automatique de boutique
- ✅ Gestion complète du profil de boutique
- ✅ CRUD produits (Créer, Lire, Modifier, Supprimer)
- ✅ Dashboard vendeur en temps réel avec statistiques
- ✅ Suivi des commandes et revenus
- ✅ Système de retrait avec virements bancaires tunisiens
- **Routes:** `/api/vendor/*`
- **UI:** `VendorDashboard.jsx`, `VendorRegistration.jsx`

### 4. **Système de Commission (15%)**
- ✅ Calcul automatique 15% sur chaque vente
- ✅ Suivi détaillé des commissions par vendeur
- ✅ Historique complet des commissions
- **Modèle:** Commission avec montant, taux, statut
- **Calcul:** Automatique lors de la création de commande

### 5. **Tableau de Bord Admin**
- ✅ Vue d'ensemble des statistiques (vendeurs, ventes, commissions, utilisateurs)
- ✅ Gestion complète des vendeurs (approuver, suspendre, rejeter)
- ✅ Gestion des demandes de retrait
- ✅ Rapport de settlement détaillé
- ✅ Liste complète des commandes et utilisateurs
- ✅ Analytics plateforme en temps réel
- **Routes:** `/api/admin/*`
- **UI:** `AdminDashboard.jsx`
- **Authentification:** Token admin secret dans headers

### 6. **Marketplace & Catalogue**
- ✅ Affichage de tous les produits disponibles
- ✅ Filtrage par catégorie, prix, magasin
- ✅ Recherche en temps réel
- ✅ Affichage des informations vendeur
- ✅ Gestion du panier
- **Route:** `/api/produits`, `/api/boutiques`
- **UI:** `Marketplace.jsx`

### 7. **Paiements Tunisiens**
- ✅ Support des virements bancaires IBAN
- ✅ Gestion des demandes de retrait
- ✅ Suivi du statut du paiement (demande → approuvé → versé)
- ✅ Système de rejet avec justification
- **Modèle:** Retrait avec montant, IBAN, statut, date

### 8. **Structure de Données Complète**
Modèles Sequelize implémentés:
- **Utilisateur** - Clients, vendeurs, admins
- **Boutique** - Profil complet du vendeur avec statut (en attente, validée, suspendue)
- **Produit** - Catalogue complet avec stock, prix, description
- **Commande** - Gestion des ventes avec montants
- **LigneCommande** - Détail des articles
- **Commission** - Suivi des commissions 15%
- **Retrait** - Gestion des paiements aux vendeurs
- **Paiement** - Historique des transactions
- **Catégorie** - Organisation des produits
- **Avis** - Système de commentaires
- **Panier** & **LignePanier** - Gestion du panier
- **Conversation** & **Message** - Support client

---

## 🚀 Comment Démarrer

### Prérequis
- Node.js v18+
- npm ou yarn

### Installation

```bash
# Installer les dépendances serveur
cd server
npm install

# Installer les dépendances client
cd ../client
npm install
```

### Démarrer les Services

**Terminal 1 - Serveur API:**
```bash
cd server
npm start
# Serveur écoute sur http://localhost:5000
```

**Terminal 2 - Client React:**
```bash
cd client
npm run dev
# Client accessible à http://localhost:5174
```

---

## 📊 Endpoints API Clés

### Authentication
- `POST /api/auth/register` - Créer un compte
- `POST /api/auth/login` - Se connecter

### Vendeur
- `GET /api/vendor/dashboard/:vendeurId` - Dashboard vendeur
- `GET /api/vendor/products/:vendeurId` - Lister les produits
- `POST /api/vendor/products/:vendeurId` - Créer un produit
- `PUT /api/vendor/products/:produitId` - Modifier un produit
- `DELETE /api/vendor/products/:produitId` - Supprimer un produit
- `POST /api/vendor/register` - S'inscrire comme vendeur
- `POST /api/vendor/withdrawal` - Demander un retrait

### Admin (JWT — rôle `administrateur` ou `super_admin`)
- `GET /api/admin/stats` - Statistiques globales
- `GET /api/admin/vendors` - Tous les vendeurs
- `PUT /api/admin/vendors/:boutiqueId/status` - Approuver/suspendre vendeur
- `GET /api/admin/withdrawals` - Demandes de retrait
- `PUT /api/admin/withdrawals/:retraitId` - Approuver/rejeter retrait
- `GET /api/admin/commissions` - Analytics commissions
- `GET /api/admin/orders` - Toutes les commandes
- `GET /api/admin/users` - Liste des utilisateurs
- `GET /api/admin/settlement-report` - Rapport de settlement

### Marketplace
- `GET /api/produits` - Tous les produits
- `GET /api/boutiques` - Tous les magasins

---

## 🔐 Authentification Admin

L'accès admin passe exclusivement par un JWT obtenu via `POST /api/auth/login` avec un compte dont le rôle est `administrateur` ou `super_admin` (compte de démo : `super.admin@here.tn`). Il n'existe plus de jeton statique de contournement — l'ancien header `x-admin-token` a été supprimé car il était visible en clair dans le bundle JavaScript public, ce qui constituait une faille de sécurité.

---

## 💾 Base de Données

Sequelize ORM : SQLite en développement (`server/data/marketplace.db`, créé au premier lancement), PostgreSQL en production (`DATABASE_URL`, base `here-tn-db` sur Render). Limites du mécanisme de schéma actuel : `DOCUMENTATION.md` §15.

---

## 📱 Interface Utilisateur

### Pages Principales
1. **Accueil** - Page de bienvenue avec highlights
2. **Catalogue** - Marketplace avec filtrage avancé
3. **Inscription Vendeur** - Processus en 2 étapes (compte + boutique)
4. **Dashboard Vendeur** - Gestion complète de la boutique
5. **Dashboard Admin** - Panel d'administration complet
6. **Panier & Paiement** - Processus de checkout

### Características d'Interface
- ✅ Design responsive (Mobile, Tablet, Desktop)
- ✅ Bilinguisme complet (FR/AR)
- ✅ Navigation intuitive
- ✅ Icônes Lucide React
- ✅ Styling Tailwind CSS
- ✅ Thèmes de couleurs professionnels

---

## 🎯 Flux Utilisateur

### Scénario Client
1. Consulte le catalogue
2. Ajoute des produits au panier
3. Procède au checkout
4. Effectue le paiement
5. Reçoit la confirmation de commande

### Scénario Vendeur
1. Créer un compte → Créer une boutique
2. Attendre l'approbation admin
3. Ajouter des produits avec images et descriptions
4. Gérer les commandes reçues
5. Demander des retraits
6. Recevoir les virements bancaires

### Scénario Admin
1. Consulter les statistiques globales
2. Approuver/rejeter les vendeurs
3. Valider les demandes de retrait
4. Visualiser les analytics de commission
5. Générer les rapports de settlement

---

## 🌐 Variables d'Environnement

### Serveur (`.env`)

Voir `server/.env.example` pour la liste complète et à jour des variables (URLs, OAuth, SMTP, Konnect/Flouci, Cloudinary, SMS, business). Il n'y a plus de `ADMIN_SECRET` — l'accès admin passe uniquement par JWT.

### Client (`.env`)
```
VITE_API_URL=http://localhost:5000/api
VITE_DEFAULT_LANGUAGE=fr
```

---

## 📈 Suite du projet

L'ancienne liste « prochaines étapes » est obsolète. Avis, coupons, factures PDF, chat, wishlist, upload d'images (base ou Cloudinary), notifications email/SMS/push et application mobile Expo ont été réalisés depuis. Le suivi à jour est dans [`CLAUDE_TASKS.md`](CLAUDE_TASKS.md).

---

## 🛠️ Technologies Utilisées

### Backend
- **Express.js** - Framework web
- **Sequelize** - ORM pour base de données
- **SQLite / PostgreSQL** - Base de données (dev / production)
- **bcryptjs** - Hash des mots de passe
- **jsonwebtoken** - Authentification JWT
- **CORS** - Cross-origin requests
- **dotenv** - Gestion des variables d'environnement

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **JavaScript ES6+** - Language

---

## ✨ Highlights

- ✅ **100% Bilingue** - Interface complète en FR et AR
- ✅ **Commission Automatique** - 15% calculé automatiquement
- ✅ **Paiements Tunisiens** - IBAN et virements bancaires
- ✅ **Admin Panel Complet** - Dashboard avec tous les outils
- ✅ **Vendor Dashboard** - Suivi complet des ventes et revenus
- ✅ **Responsive Design** - Fonctionne sur tous les appareils
- ✅ **Architecture Scalable** - Prêt pour la croissance

---

## 📞 Support

Pour questions ou problèmes, consultez la structure du projet:
- Backend: `server/src/`
- Frontend: `client/src/`
- Database: `server/data/marketplace.db`

**Marketplace prêt pour le lancement! 🚀**
