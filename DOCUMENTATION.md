# Documentation technique — here.tn / buyhere.

Marketplace multi-vendeurs tunisienne, bilingue français / arabe. Ce document décrit le dépôt dossier par dossier, puis fichier par fichier : rôle, fonctionnement, routes exposées et règles métier.

> Les dossiers `node_modules/`, `server/data/` (base SQLite générée) et `server/uploads/` (images envoyées) ne sont pas versionnés et ne sont pas décrits ici.

---

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Démarrage rapide](#2-démarrage-rapide)
3. [Racine du dépôt](#3-racine-du-dépôt)
4. [Serveur — `server/`](#4-serveur--server)
5. [Site web — `client/`](#5-site-web--client)
6. [Application mobile et API alternative — `buyhere/`](#6-application-mobile-et-api-alternative--buyhere)
7. [Parcours métier de bout en bout](#7-parcours-métier-de-bout-en-bout)
8. [Référence complète de l'API](#8-référence-complète-de-lapi)
9. [Variables d'environnement](#9-variables-denvironnement)
10. [Points d'attention et limites connues](#10-points-dattention-et-limites-connues)
11. [Machine d'états, stock, notifications, audit (Phase 1)](#11-machine-détats-stock-notifications-audit-phase-1)

---

## 1. Vue d'ensemble

| Partie | Dossier | Technologies | Port (dev) |
|---|---|---|---|
| API REST + temps réel | `server/` | Node.js (ESM), Express 4, Sequelize 6, SQLite ou PostgreSQL, Socket.io, Passport, Joi | 5000 |
| Site web | `client/` | React 18, Vite 5, React Router 6, Tailwind CSS 3, lucide-react, socket.io-client | 5174 |
| App mobile | `buyhere/mobile/` | Expo SDK 57, React Native 0.86, TypeScript, Zustand, TanStack Query, NativeWind, i18next | Expo (8081) |
| API alternative (séparée) | `buyhere/backend/` | Express 5, Prisma 6, PostgreSQL, Zod, TypeScript | 4000 |

**Cinq rôles utilisateur** (`Utilisateur.role`) :

| Rôle | Espace | Ce qu'il peut faire |
|---|---|---|
| visiteur (sans compte) | site public | parcourir le catalogue, ajouter au panier, **commander en invité** |
| `client` | `/compte`, `/commandes`, `/favoris` | commander, suivre, noter, demander un retour, discuter avec un vendeur, utiliser son solde |
| `vendeur` / `admin_boutique` | `/vendeur` | gérer sa boutique, ses produits et son stock, l'import en masse, les commandes, les retours, le KYC et les retraits |
| `livreur` | `/livreur` | recevoir des courses en temps réel, les accepter, livrer, déposer une preuve |
| `administrateur` / `super_admin` | `/admin` | valider les boutiques et le KYC, modérer, valider les virements et les retraits, arbitrer les litiges, consulter les rapports |

**Architecture en un schéma :**

```
Navigateur (React, :5174) ──/api (proxy Vite)──► Express (:5000) ──► Sequelize ──► SQLite (server/data/marketplace.db)
        │                                            │                         └─► ou PostgreSQL (DATABASE_URL)
        └──── Socket.io (notifications livreur) ◄────┤
App mobile Expo ──────── HTTP /api ─────────────────►│
                                                     ├─► Nodemailer (SMTP)   ├─► Konnect / Flouci (paiement)
                                                     ├─► Cloudinary ou disque local (images)
                                                     └─► Twilio / WinSMS / mock (SMS)
```

En production (Render), un seul service sert l'API **et** le site compilé (`client/dist`) sur la même URL.

---

## 2. Démarrage rapide

```bash
npm install                    # racine (concurrently)
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env   # puis changer JWT_SECRET
npm run dev                    # lance serveur (:5000) + client (:5174)
```

Au premier démarrage, le serveur crée les tables et insère automatiquement :
- les **24 gouvernorats** tunisiens et leurs délégations, avec les frais de livraison ;
- **12 univers** de catégories et leurs sous-catégories, avec le délai de retour de chacune ;
- **3 boutiques** et **30 produits** de démonstration ;
- les comptes de démonstration :

| Rôle | Email | Mot de passe |
|---|---|---|
| Client | `client.demo@here.tn` | `ClientDemo2026!` |
| Admin boutique | `boutique.admin@here.tn` | `BoutiqueDemo2026!` |
| Super admin | `super.admin@here.tn` | `SuperAdminDemo2026!` |
| Livreur | `livreur.demo@here.tn` | `LivreurDemo2026!` |

Deux autres comptes vendeurs (`vendeur1.demo@here.tn` pour *Atelier Kairouan*, `vendeur2.demo@here.tn` pour *GadgetPro Sfax*) reçoivent un mot de passe non documenté.

Tests du serveur : `npm test --prefix server` (base isolée `server/data/test.db`).

---

## 3. Racine du dépôt

| Fichier | Rôle |
|---|---|
| `package.json` | Scripts globaux. `dev` lance serveur et client en parallèle via `concurrently` ; `build` installe les deux projets et compile le client ; `start` démarre le serveur seul, qui sert alors `client/dist`. |
| `package-lock.json` | Verrou des versions npm de la racine. |
| `render.yaml` | Déploiement Render : un service web Node 20 à Francfort et une base PostgreSQL gratuite (`here-tn-db`). `JWT_SECRET` et les mots de passe de démo sont générés automatiquement ; `CLIENT_URL`, `FRONTEND_URL` et `API_BASE_URL` sont à renseigner. Health check sur `/api/health`. |
| `README.md` | Guide de démarrage court, comptes de démo et avertissement sur les paiements. |
| `IMPLEMENTATION_SUMMARY.md` | Résumé fonctionnel historique. Certaines informations sont dépassées : le port client indiqué est 5173 alors que c'est 5174, et sa liste « prochaines étapes » contient des fonctions déjà faites (avis, coupons, PDF, chat, wishlist). |
| `.gitignore` | Exclut `node_modules`, `data`, `client/dist`, `server/uploads`, `.env` et `.claude`. |
| `.vscode/extensions.json` | Extensions VS Code recommandées. |
| `here_tn_logo_basket.png`, `here_tn_logo_compact.png`, `here_tn_logo_icon.png` | Anciens logos « here.tn ». Le site utilise maintenant l'identité « buyhere. » de `client/public/brand/`. |

---

## 4. Serveur — `server/`

### 4.1 Fichiers de configuration

| Fichier | Rôle |
|---|---|
| `package.json` | Dépendances : express, sequelize, sqlite3, pg, socket.io, passport (Google, Facebook), jsonwebtoken, bcryptjs, joi, helmet, express-rate-limit, multer, cloudinary, nodemailer, pdfkit, exceljs, adm-zip. Scripts : `dev` (`node --watch`), `start`, `test` (`node --test`, après suppression de `data/test.db`). |
| `.env.example` | Modèle commenté de toutes les variables (voir [§9](#9-variables-denvironnement)). |
| `.env` | Configuration locale réelle, non versionnée. |

### 4.2 `src/server.js` — point d'entrée

Construit l'application Express dans cet ordre :
1. **Helmet**, avec `crossOriginResourcePolicy: cross-origin` pour que le site (autre port) puisse afficher les images de `/uploads`.
2. **CORS**, avec la liste blanche de `config/cors.js`.
3. **`express.json`**, qui conserve aussi le corps brut (`req.rawBody`) : les signatures HMAC des webhooks de paiement sont calculées sur ces octets exacts.
4. **Passport** (OAuth).
5. Les fichiers statiques de `/uploads`.
6. **Limitation de débit** : 100 requêtes par 15 min et par IP sur `/api/auth`, 60 sur `/api/payments`.
7. Les **13 routeurs**, tous montés sous `/api`.
8. Si `client/dist` existe : sert le site compilé, avec repli sur `index.html` pour les routes React.
9. Un gestionnaire d'erreurs global qui renvoie un 500 JSON.

`startServer()` synchronise la base, attache Socket.io au serveur HTTP puis écoute sur le port. Le serveur ne démarre que si le fichier est exécuté directement : les tests importent `app` sans ouvrir de port.

### 4.3 `src/config/`

| Fichier | Rôle |
|---|---|
| `database.js` | Choisit **PostgreSQL** si `DATABASE_URL` commence par `postgres://` (SSL activé sauf si `DATABASE_SSL=false`), sinon **SQLite** dans `server/data/marketplace.db`, ou dans `SQLITE_STORAGE` pour les tests. `syncDatabase()` exécute `sequelize.sync()`, puis une **mini-migration automatique** : toute colonne présente dans un modèle mais absente de la table est ajoutée. Elle lance ensuite les trois seeds (géographie, catégories, comptes et produits de démo). |
| `cors.js` | Liste blanche des origines, partagée par Express et Socket.io : `CLIENT_URL`, plus `localhost:5173` et `localhost:5174` hors production. Les requêtes sans en-tête `Origin` (curl, mobile, webhooks) sont acceptées. |
| `marketplace.js` | Paramètres métier lus depuis l'environnement, avec des valeurs par défaut sûres : taux de commission (0,15), retrait minimum (50 DT), livraison facturée par boutique et seuil de gratuité, rayon de recherche livreur (10 km) et délai de réponse (60 s), cashback (1 %), politique de retour (14 jours par défaut, 48 h de réponse vendeur), RIB de la plateforme. Exporte aussi `calculateShipping()` et `calculateCommission()`. |
| `passport.js` | Stratégies **Google** et **Facebook** (Graph API v19). `findOrCreateOAuthUser` crée un compte client ou retrouve le compte existant, et **refuse de fusionner** un email déjà inscrit avec un mot de passe ou avec l'autre fournisseur. Les comptes OAuth reçoivent un mot de passe haché aléatoire inutilisable. |

### 4.4 `src/middleware/`

| Fichier | Rôle |
|---|---|
| `auth.js` | `generateToken` crée un JWT valable 7 jours, contenant `{id, email, role}`. `authMiddleware` exige un en-tête `Bearer` valide (401 sinon). `optionalAuthMiddleware` lit le jeton s'il existe sans jamais bloquer : il sert au checkout invité. `requireRole(...roles)` renvoie 403 si le rôle n'est pas autorisé ; `requireSuperAdmin` est le raccourci pour `administrateur` et `super_admin`. |
| `verifyPaymentSignature.js` | Pour `/payments/webhook/:provider` : retrouve le prestataire, vérifie la signature, consigne `webhook_rejete` dans `PaymentLog` et renvoie 401 si elle est invalide. |

### 4.5 `src/models/` — schéma de la base

`models/index.js` définit les modèles principaux et **toutes les associations**. Les autres fichiers définissent un modèle chacun.

#### Utilisateurs et boutiques

| Modèle | Champs clés |
|---|---|
| **Utilisateur** | `nom`, `prenom`, `email` (unique), `password` (bcrypt), `telephone`, `role` (6 valeurs), `provider` (`local`, `google`, `facebook`), `providerId`, `photo`, `gouvernoratId`, `delegationId`, `adresse`, `soldeWallet`, `accepteConditions` |
| **Boutique** | `nom`, `description`, `statut` (`en_attente`, `validee`, `suspendue`), `logo`, `bannière`, localisation et `latitude`/`longitude`, `iban`, `modePaiement` (`iban` ou `flouci`), `flouciNumero`, `categorie`, `accepteConditionsRetour`, **KYC** : `kycStatut` (`non_soumis`, `en_attente`, `valide`, `rejete`), `kycCin`, `kycRib`, documents, commentaire admin et dates. Appartient à un vendeur (`vendeurId`). |
| **Livreur** (`Livreur.js`) | `statut` (`disponible`, `occupe`, `hors_ligne`), `vehiculeType` (moto, voiture, vélo, camionnette), `latitude`/`longitude`, `dernierePositionMaj`, `noteMoyenne`, `nombreLivraisons`. Lié à un Utilisateur. |
| **PasswordResetToken** | `token`, `expiresAt`, `used` |

#### Catalogue

| Modèle | Champs clés |
|---|---|
| **Categorie** | `nom`, `slug`, `icone`, `parentId` (arborescence à 2 niveaux), `delaiRetourJours` (`null` = défaut plateforme, `0` = non retournable) |
| **Produit** | `nom`, `description`, `reference` (SKU unique, utilisée par l'import), `marque`, `prix`, `prixAvant` (prix barré), `stock`, `image`, `images` (JSON), `status` (`actif`, `inactif`, `en_attente`), `hasVariantes`, `delaiRetourJoursOverride` |
| **Variante** | `taille`, `couleur`, `pointure`, `sku`, `stock`, `prixSupplement`, `image` |
| **PrixHistorique** | `prix`, `dateDebut`, `dateFin` : sert à détecter les fausses promotions |
| **MouvementStock** | `variation`, `stockAvant`, `stockApres`, `motif`, `note`, auteur : journal d'audit du stock |
| **Avis** | `type` (`produit` ou `client` : un vendeur peut noter un client), `note` (1 à 5), `commentaire`, `verifie` (achat vérifié), `valide` (modération) |
| **Wishlist** | couple unique (`utilisateurId`, `produitId`) |
| **Coupon** | `code`, `type` (`pourcentage` ou `montant_fixe`), `valeur`, `dateExpiration`, `limiteUtilisation`, `utilisations`, `actif`, `montantMinimum` |

#### Commandes, paiement, livraison

| Modèle | Champs clés |
|---|---|
| **Commande** | `numeroCommande`, `groupeCommande` (regroupe les sous-commandes d'un même panier multi-boutiques), `sousTotal`, `fraisLivraison`, `remiseCoupon`, `walletUtilise`, `total`, `montantCommission`, `montantVendeur`, `statut` (`en_attente`, `payee`, `preparation`, `expediee`, `en_cours_livraison`, `livree`, `annulee`, `retour`, `litige`, `retournee` = remboursée — transitions imposées par `utils/orderStatus.js`, voir [§11](#11-machine-détats-stock-notifications-audit-phase-1)), adresse et localisation, `couponCode`, **confirmation** (`confirmationStatut`, `confirmationToken` et expiration à 48 h, pour le paiement à la livraison), **invité** (`guestNom`, `guestPrenom`, `guestEmail`, `guestTelephone`) |
| **LigneCommande** | `quantite`, `prixUnitaire` (figé au moment de l'achat), `produitId`, `varianteId` |
| **Paiement** | `montant`, `methode` (`cod`, `konnect`, `flouci`, `carte`, `virement`), `statut` (`en_attente`, `valide`, `echec`, `en_attente_livraison`, `paye_livraison`, `en_attente_validation`), `reference`, `referenceVirement`, `gatewayResponse` |
| **Transaction** (`Transaction.js`) | Couche d'audit au-dessus de Paiement : `montant`, `statut`, `provider`, `providerReference`, **`idempotencyKey` unique** (empêche un double débit), `dateConfirmation`. Aucune donnée de carte n'est stockée. |
| **PaymentLog** | Journal des événements de paiement : `evenement`, `statut`, `montant`, `provider`, `message`, `ip` |
| **Commission** | `montant`, `tauxCommission`, `statut` : une par commande |
| **Livraison** | `trackingId`, `awbNumber`, `statut` transporteur (`en_preparation` → `expedie` → `en_cours_livraison` → `livre` ou `retourne`), `transporteur` (« Aramex TN » par défaut), `historiqueStatuts` (JSON), et pour les livreurs internes : `statutAssignation`, coordonnées de départ et d'arrivée, `distanceKm`, `livreurId`, `preuveLivraison` |
| **NotificationLivreur** | Offre de course envoyée à un livreur : `statut` (`envoyee`, `acceptee`, `expiree`, `refusee`), `distanceKm`, `ordre` dans la cascade, `dateExpiration` |

#### Après-vente et finances

| Modèle | Champs clés |
|---|---|
| **Retour** (`Retour.js`) | Demande de retour (RMA) : `motif`, `motifCategorie` (`defaut`, `non_conforme`, `changement_avis`), `photos` (obligatoires), `statut` (`demande`, `approuve`, `refuse`, `rembourse`, `litige`), `dateLimiteReponseVendeur`, `fraisRetourALaCharge`, `montantRemboursement`, `commentaireVendeur` |
| **WalletTransaction** | Mouvement du solde client : `montant`, `type` (`credit` ou `debit`), `motif` (`cashback`, `utilise_commande`, remboursement…) |
| **Retrait** | Demande de virement d'un vendeur : `montant`, `statut` (`demande` → `approuve` → `verse`, ou `rejete`), `iban`, `motifRejection` |
| **Panier** / **LignePanier** | Panier côté serveur. Le site utilise surtout un panier stocké dans le navigateur (`localStorage`). |
| **Conversation** / **Message** | Messagerie entre un client et un vendeur : `sujet`, dernier message, `contenu`, `lu` |
| **Gouvernorat** / **Delegation** | Découpage administratif tunisien, avec noms en arabe ; `fraisLivraison` est défini par gouvernorat. |
| **HistoriqueCommande** | Chronologie immuable d'une commande : `ancienStatut` (`null` à la création), `nouveauStatut`, `utilisateurId`, `commentaire`. Écrite uniquement par `utils/orderStatus.js`. |
| **Notification** | Notification in-app : `type`, `titre`, `message`, `lien` (chemin d'app, ex. `commande/12`), `data`, `lu`. Source de la cloche du site et des push mobiles. |
| **PushToken** | Jeton Expo Push d'un appareil (`token` unique, `plateforme`), plusieurs par utilisateur. |
| **AuditLog** | Journal des actions admin : `acteurId`, `acteurRole`, `action` (ex. `kyc.valider`), `entite`, `entiteId`, `avant`, `apres`, `commentaire`, `ip`. Jamais modifié ni supprimé par l'application. |

### 4.6 `src/controllers/`

| Fichier | Fonctions |
|---|---|
| `authController.js` | `register` (exige `accepteConditions`), `login` (refusé pour les comptes OAuth), `forgotPassword` (génère un jeton et envoie un email avec le lien), `resetPassword`, `getMe`, `updateMe`, `changePassword` |
| `orderController.js` | Cœur du commerce. **Catalogue** : `getProduits` (pagination jusqu'à 60 par page ; filtres `search`, `categoryId` qui inclut les sous-catégories, `storeId`, `minPrice`, `maxPrice`, `minRating`, `inStock`, `promotion` ; tri `sort`), `getProduitById`, `getBoutiques`, `getBoutiqueById`. **Coupons** : `validerCouponEndpoint`, `getCouponsActifs`. **Commande** : `createCommande` (voir [§7.1](#71-passer-une-commande)), `confirmPayment` (confirmation sandbox), `getCommandeFacture` (PDF), `getMesCommandes`, `annulerCommandeParClient`, `updateLivraisonStatut` (vendeur), `assignDeliveryManually`, `getTracking`, `getConfirmationCommande` et `repondreConfirmationCommande` (lien de confirmation du paiement à la livraison) |
| `avisController.js` | `getAvisByProduit`, `createAvis` (achat vérifié, commande livrée), `createAvisClient` (un vendeur note un client), `getMesAvis`, `getReputationClient`, `moderateAvis` |
| `wishlistController.js` | `getWishlist`, `addToWishlist`, `removeFromWishlist`, `checkWishlist` (vérifie plusieurs identifiants en un seul appel) |
| `geoController.js` | `getGouvernorats`, `getDelegations`, `getFraisLivraison` |

### 4.7 `src/routes/`

| Fichier | Domaine | Accès |
|---|---|---|
| `healthRoutes.js` | `GET /health` → `{status:"ok"}` | public |
| `marketRoutes.js` | catalogue, géographie, catégories, avis, wishlist, coupons, commandes, suivi, confirmation, moyens de paiement disponibles | mixte |
| `authRoutes.js` | inscription, connexion, mot de passe oublié, profil `/users/me` | mixte |
| `oauthRoutes.js` | `/auth/google`, `/auth/facebook` et leurs callbacks. Redirige vers `CLIENT_URL/oauth/callback?token=…` ou `?error=…`. | public |
| `vendorRoutes.js` | tableau de bord, produits (CRUD), stock et historique, **import en masse**, KYC, retraits, profil de boutique, inscription vendeur, vitrine publique | vendeur, admin_boutique, admins |
| `adminRoutes.js` | vendeurs, KYC, retraits, virements, commissions, avis, statistiques, commandes, utilisateurs, produits, rapport de règlement | administrateur, super_admin |
| `paymentRoutes.js` | initiation idempotente, webhook signé, statut d'un paiement | client ou signature du prestataire |
| `retourRoutes.js` | création d'une demande de retour (jusqu'à 5 photos), liste selon le rôle, décision | client, vendeur, admin |
| `livreurRoutes.js` | inscription et connexion livreur, statut, position GPS, courses (avec le mode et l'état du paiement, pour l'encaissement COD), acceptation, statut de livraison, preuve, historique, statistiques, notifications | livreur |
| `deliveryRoutes.js` | `GET /livraisons/:commandeId/awb` : bordereau d'expédition en PDF | authentifié |
| `chatRoutes.js` | conversations et messages | authentifié |
| `uploadRoutes.js` | `POST /upload` : une image vers Cloudinary ou le disque local | vendeurs et admins |
| `walletRoutes.js` | `GET /wallet/me` : solde et historique | authentifié |
| `notificationRoutes.js` | notifications in-app (liste, non lues, marquer lu) et jetons push | authentifié |
| `appLinkRoutes.js` | `/.well-known/assetlinks.json` et `apple-app-site-association` (liens d'application) | public |

La liste complète des routes est dans la [§8](#8-référence-complète-de-lapi).

### 4.8 `src/services/payments/` — prestataires de paiement

Architecture modulaire : chaque prestataire **hérite** de `PaymentProvider` et s'enregistre dans `index.js`.

| Fichier | Rôle |
|---|---|
| `PaymentProvider.js` | Interface commune : `initiate()`, `verifyWebhookSignature(req)`, `parseWebhookPayload(body)` |
| `KonnectProvider.js` | Konnect (Tunisie) |
| `FlouciProvider.js` | Flouci (Tunisie) |
| `CashOnDeliveryProvider.js` | Paiement à la livraison : aucune passerelle. L'encaissement est constaté quand le livreur marque la course `livree`. |
| `SandboxMockProvider.js` | Simule tout le circuit initiation → webhook signé → confirmation, avec 8 scénarios (`SUCCESS`, `FAILED`, `CANCELLED`, `TIMEOUT`, `DUPLICATE_WEBHOOK`, `WEBHOOK_DELAYED`, `WRONG_AMOUNT`, `INVALID_SIGNATURE`) joués par `POST /payments/sandbox/simulate`. **Refuse de fonctionner en production.** |
| `hmac.js` | Vérification HMAC-SHA256 du corps brut, avec comparaison à temps constant |
| `index.js` | Registre `{cod, flouci, konnect, sandbox}` et `getProvider(name)` |

### 4.9 `src/utils/`

| Fichier | Rôle |
|---|---|
| `seed.js` | Données de démo : 12 univers de catégories avec leur délai de retour (7 jours pour la high-tech, 14 jours pour la mode, la maison et le sport, 0 pour l'alimentaire, la beauté et le terroir), les 4 comptes de démo, 3 boutiques et 30 produits avec variantes. Tous les seeds sont **idempotents** (`findOrCreate`). |
| `shipping.js` | `seedGeographie()` (24 gouvernorats et délégations), `calculerFraisLivraison`, générateurs de `trackingId`, de numéro AWB et de `numeroCommande` |
| `email.js` | Nodemailer et un gabarit HTML aux couleurs de la marque, en FR ou AR. Emails disponibles : confirmation de commande, **facture PDF jointe**, reçu de paiement, lien de confirmation du paiement à la livraison, annulation, réinitialisation du mot de passe, bienvenue vendeur, garantie, **contrat de retour**, remboursement crédité, statut de livraison. |
| `pdf.js` | PDFKit : `generateInvoicePDF` (facture) et `generateAwbPDF` (bordereau d'expédition) |
| `sms.js` | `sendSMS` via **Twilio**, **WinSMS**, ou `mock` (écrit dans la console). Messages : confirmation de commande, statut de livraison. |
| `upload.js` | `uploadImage` envoie vers **Cloudinary** si les 3 variables sont définies, sinon déplace le fichier dans `server/uploads/` et renvoie `/uploads/<fichier>`. Contient aussi `deleteImage` et `getStorageProvider`. |
| `paymentGateway.js` | Ancien circuit de paiement utilisé par `createCommande` : `initKonnectPayment`, `initFlouciPayment`, réponses simulées en sandbox, `confirmSandboxPayment` |
| `finance.js` | **Source unique des chiffres financiers d'une boutique** (`calculerFinancesBoutique`) : ventes brutes et nettes, commissions, sommes versées, **séquestre** et solde retirable. Le montant d'une commande ne devient retirable qu'une fois sa **fenêtre de retour écoulée sans retour actif**. |
| `wallet.js` | `crediterCashback` (1 % à la finalisation du paiement, idempotent), `crediterRemboursement` (retour remboursé en **solde site**), `crediterAnnulationCommande`, `plafonnerUtilisationWallet` |
| `returnPolicy.js` | Calcule le délai de retour effectif : le plus court entre celui de la catégorie et celui du produit, le vendeur ne pouvant que le **raccourcir**. La commande prend le délai de son produit le plus restrictif. Contient aussi `dateLimiteRetour` et `fraisRetourParDefaut` (vendeur pour un défaut ou une non-conformité, client pour un changement d'avis). |
| `promoGuard.js` | Historise chaque changement de prix et **valide `prixAvant`** pour empêcher les fausses promotions (prix barré inventé) |
| `courierMatching.js` | **Attribution des livreurs en cascade** : sélectionne les livreurs `disponible` dans le rayon autour de la boutique, du plus proche au plus éloigné, et notifie le premier par Socket.io (site) et par notification push Expo (app mobile, fonction `pousser`, sans ligne dans l'historique des notifications). Sans réponse sous 60 s ou en cas de refus, il passe au suivant. Sans coordonnées de boutique, tous les livreurs disponibles sont candidats. L'état de la cascade est gardé **en mémoire**. |
| `geocode.js` | **Géocodage des adresses de livraison** via Nominatim / OpenStreetMap (gratuit, sans clé ; 1 requête/s, cache en mémoire). Localise d'abord la délégation ou le gouvernorat, puis cherche l'adresse dans cette zone ; à défaut, centre de la zone. Remplit `Livraison.latitude/longitudeDepart/Arrivee` et `geocodage` (précision obtenue) en tâche de fond : à la création de la commande, puis à la lecture de « Mes commandes » ou des courses livreur s'il manque des coordonnées. `carteCommande()` construit le champ `carte` (départ, arrivée, livreur) des commandes client. Désactivé en test et avec `GEOCODING=off` ; `NOMINATIM_URL` pour une instance privée. |
| `comptesSupprimes.js` + `DELETE /users/me` | **Suppression du compte** (exigée par les stores) : clients uniquement, confirmation par mot de passe (ou « SUPPRIMER » pour Google/Facebook), refusée si commande/retour en cours ou solde restant. Données personnelles effacées, favoris/panier/notifications/jetons push supprimés, commandes conservées anonymisées ; `compteSupprime` = sessions existantes refusées par `authMiddleware`. Écran `DeleteAccount` (app) et section « Supprimer mon compte » (page Mon compte du site). |
| `config/marketplace.js` → `fiscal` | **TVA et timbre fiscal** : prix catalogue TTC. Chaque commande enregistre `montantTva` (TVA comprise dans articles après remise + livraison, taux `TVA_RATE`, 19 % par défaut) et `timbreFiscal` (`TIMBRE_FISCAL`, 1 DT par défaut, une facture par boutique), ajouté au total. Exposés par `/config/payment-methods` (`tvaTaux`, `timbreFiscal`) pour les récapitulatifs du site et de l'app ; détaillés sur la facture PDF ; le timbre est exclu des ventes brutes de la boutique. |
| `courseAssignment.js` | `assignCourseToLivreur` : affecte la livraison et passe le livreur en `occupe` |
| `geo.js` | Distance à vol d'oiseau (formule de Haversine), en km |
| `productImport.js` | Import en masse : lecture de fichiers **Excel ou CSV** (séparateur détecté automatiquement, en-têtes insensibles aux accents) et de **ZIP** (`produits.xlsx` + `images/<reference>/*.jpg`), avec protections contre les ZIP-bombes et la traversée de chemin. Construit une prévisualisation ligne par ligne et génère le modèle Excel. |
| `importStore.js` | Garde en mémoire, avec expiration, les imports en attente de confirmation |
| `orderStatus.js` | **Machine d'états des commandes** : transitions autorisées, `changerStatutCommande` (UPDATE conditionnel + historique + notification client), `synchroniserStatutCommande` (version tolérante), `verifierPaiementAvantExpedition`, libellés FR/AR. |
| `stock.js` | **Stock atomique** : `reserverStock` (`UPDATE … SET stock = stock - q WHERE stock >= q`), `restaurerStock` / `restaurerStockCommande`, journal `MouvementStock`, alerte vendeur au franchissement du seuil. |
| `notifications.js` | `notifier` / `notifierVendeur` (ligne Notification + push Expo), `apresCommit` (effets différés après la transaction). |
| `audit.js` | `journaliser` / `journaliserSiAdmin` : écrit un AuditLog sans jamais copier mot de passe ni documents KYC. |
| `vendorStats.js` | Statistiques vendeur (CA jour/semaine/mois au fuseau de Tunis, panier moyen, taux de retour, série quotidienne). |
| `validation.js` | Schémas **Joi** (inscription, connexion, commande, avis, coupon, retour, message, mot de passe, profil) et middleware `validate(schema)` |

### 4.10 `src/realtime/io.js`

Initialise Socket.io sur le serveur HTTP. La connexion exige un JWT dans `handshake.auth.token`. Un livreur rejoint automatiquement le salon `livreur:<id>`, où il reçoit les événements `notification:nouvelle`.

### 4.11 `src/data/tunisia-geo.js`

Données brutes : les 24 gouvernorats (nom FR/AR, code, délégations) et la table `fraisLivraisonParGouvernorat`.

### 4.12 `tests/`

| Fichier | Contenu |
|---|---|
| `helpers.js` | Fait pointer SQLite vers `data/test.db`, démarre l'application sur un port éphémère et fournit l'utilitaire `api()` ainsi que les identifiants du client de démo. |
| `api.test.js` | Parcours critiques : authentification, panier invité, commande payée à la livraison, avis après livraison, routes publiques. |
| `productImport.test.js` | Tests unitaires du parsing Excel/CSV/ZIP et de la validation des lignes, sans base de données. |
| `quickAdd.test.js` | Ajout rapide : une même `Idempotency-Key` rejouée (ou envoyée deux fois en même temps) ne crée qu'un seul produit. |
| `orderLifecycle.test.js` | Machine d'états, historique, achats simultanés du dernier article, restitution du stock, alertes stock faible, retours, audit admin, statistiques vendeur, notifications. |
| `sandboxPayments.test.js` | Les 8 scénarios sandbox et la chaîne commande → paiement → webhook → cashback → commission → solde vendeur. |

Chaque fichier de test a sa propre base SQLite (`data/test-*.db`), recréée à chaque exécution : les fichiers tournent en parallèle sans se gêner (49 tests, ~10 s).

---

## 5. Site web — `client/`

### 5.1 Configuration

| Fichier | Rôle |
|---|---|
| `package.json` | react, react-dom, react-router-dom, lucide-react, socket.io-client ; vite, tailwind, postcss, autoprefixer |
| `vite.config.js` | Port **5174** (`strictPort`), écoute sur `0.0.0.0`, **proxy `/api` → `http://localhost:5000`** |
| `tailwind.config.js` | Palette « buyhere. » : `ink` #1E1B18 (charbon), `cream` #F4ECDF (chaux), `terre` 50–900 (terre de Nabeul, **#C4532C**). Polices **Schibsted Grotesk** (latin) et **Tajawal** (arabe). Ombre `soft`. |
| `postcss.config.js` | Tailwind et Autoprefixer |
| `index.html` | Charge les favicons et les polices Google, titre « buyhere. », point de montage `#root` |
| `.env.example` | `VITE_API_URL=http://localhost:5000/api`, `VITE_DEFAULT_LANGUAGE=fr` |
| `.env.production` | `VITE_API_URL=/api` (même domaine que l'API en production) |
| `public/brand/` | Identité visuelle : logos horizontal, compact et symbole « b » (couleur, noir, blanc, inversé), icônes d'application 180, 192, 512 et 1024, favicons |
| `public/logo-alt-basket.png` | Logo alternatif |

### 5.2 Fichiers centraux de `src/`

| Fichier | Rôle |
|---|---|
| `main.jsx` | Monte `<App/>` dans `<BrowserRouter>` (StrictMode) |
| `App.jsx` (≈1 200 lignes) | **Coquille de l'application** : routes, en-tête, menu mobile, tiroir des catégories, fenêtre de connexion et d'inscription (avec acceptation obligatoire des conditions via `PolicyConsentModal`), **panier conservé dans `localStorage`** (utilisable sans compte), session (`token`, `userId`, `userRole` dans `localStorage`), redirection automatique selon le rôle depuis `/`, widget de chat. Contient aussi la page d'accueil `HomeView` : catégories, produits les mieux notés, nouveautés, boutiques. |
| `index.css` | Directives Tailwind et styles globaux (composants, animations, support RTL) |
| `i18n.js` | Dictionnaire **FR/AR** et hook `useTranslation(language)` qui renvoie `t(clé)`. De nombreux textes ponctuels utilisent aussi la fonction locale `tr(fr, ar)`. |
| `config/api.js` | `API_URL` (lue depuis `VITE_API_URL`) et `SERVER_ORIGIN` (pour Socket.io et les URLs d'images) |
| `hooks/useDocumentTitle.js` | Met à jour le titre de l'onglet et la meta description à chaque page, puis les restaure |
| `utils/categoryIcons.js` | Associe une icône Lucide à une catégorie par mots-clés |

### 5.3 Plan du site (routes React)

| URL | Page | Accès |
|---|---|---|
| `/` | Accueil (`HomeView` dans App.jsx et `HomeDashboard`) | public |
| `/catalogue` | `Marketplace` | public |
| `/boutiques` | `StoresPage` | public |
| `/boutiques/:id` | `StorePage` | public |
| `/produits/:id` | `ProductPage` | public |
| `/panier` | redirige vers `/checkout` | — |
| `/checkout` | `CheckoutPage` | public (invité accepté) |
| `/favoris` | `FavoritesPage` | client |
| `/coupons` | `CouponsPage` | public |
| `/suivi` | `TrackingPage` | public |
| `/compte` | `AccountPage` | client |
| `/commandes` | `ClientOrdersPage` | client |
| `/messages` | `MessagesPage` | client |
| `/aide` | `HelpCenterPage` | public |
| `/legal/:type` (`cgu`, `privacy`, `returns`, `shipping`…) | `LegalPage` | public |
| `/confirmer-commande/:token` | `ConfirmOrderPage` | lien reçu par email ou SMS |
| `/reset-password` | `ResetPasswordPage` | public |
| `/oauth/callback` | `OAuthCallbackPage` | retour Google ou Facebook |
| `/payment/return` | `PaymentReturnPage` | retour Konnect ou Flouci |
| `/vendeur/inscription` | `VendorRegistration` | public |
| `/vendeur` | `VendorDashboard` | vendeur |
| `/admin` | `AdminDashboard` | admin |
| `/livreur/connexion` | `LivreurLoginPage` | public |
| `/livreur/inscription` | `LivreurRegistrationPage` | public |
| `/livreur` | `LivreurDashboardPage` | livreur |
| `*` | redirige vers `/` | — |

### 5.4 `src/pages/` — détail de chaque page

| Fichier | Contenu et fonctionnement | API utilisées |
|---|---|---|
| `Marketplace.jsx` | Catalogue : recherche, filtres repliables (catégorie, prix, note, stock, promotion), tri, grille ou liste, pagination par 24, filtres actifs sous forme de puces, tiroir de filtres sur mobile, cœur favori. | `/produits`, `/boutiques`, `/categories`, `/wishlist` |
| `ProductPage.jsx` | Fiche produit : galerie, sélection de variante sur deux axes (couleur, taille ou pointure), stock, prix barré, onglets *Description*, *Livraison* (frais selon le gouvernorat) et *Avis*, délai de retour, produits similaires, bouton « Contacter le vendeur ». | `/produits/:id`, `/gouvernorats` |
| `StoresPage.jsx` | Liste des boutiques (`BoutiqueCard`) | `/boutiques` |
| `StorePage.jsx` | Vitrine d'une boutique, onglets *Produits*, *À propos* et *Avis* | `/boutiques/:id` |
| `CheckoutPage.jsx` | Panier et commande : quantités, **adresse** (gouvernorat, délégation), **coupon**, **solde wallet**, choix du paiement (à la livraison, Konnect, Flouci, virement si un RIB est configuré), **commande invité** (nom, prénom, email, téléphone). Le paiement par carte en sandbox s'affiche sur la page même ; une fois la commande passée, la confirmation et les instructions de virement s'affichent. | `/commandes`, `/coupons/valider`, `/gouvernorats`, `/wallet/me`, `/config/payment-methods`, `/paiements/confirm` |
| `ClientOrdersPage.jsx` | Mes commandes : statut, annulation, **facture PDF**, **demande de retour** avec photos et motif, **avis**, solde wallet, contact vendeur | `/commandes/mes-commandes`, `/commandes/:id/annuler`, `/commandes/:id/facture`, `/retours`, `/avis`, `/wallet/me` |
| `AccountPage.jsx` | Hub « Mon compte » : édition du profil et de l'adresse, changement de mot de passe, raccourcis vers commandes, favoris, coupons et suivi | `/users/me`, `/users/me/password`, `/gouvernorats` |
| `FavoritesPage.jsx` | Liste de souhaits | `/wishlist` |
| `CouponsPage.jsx` | Codes promo actifs | `/coupons/actifs` |
| `TrackingPage.jsx` | Suivi d'un colis par numéro de suivi, avec la chronologie des statuts | `/livraisons/track/:trackingId` |
| `ConfirmOrderPage.jsx` | Le client confirme ou refuse sa commande payée à la livraison (lien valable 48 h) | `/commandes/confirmation/:token` |
| `MessagesPage.jsx` | Messagerie : réutilise `ChatWidget` en mode intégré | (via ChatWidget) |
| `ResetPasswordPage.jsx` | Demande d'un lien, puis saisie du nouveau mot de passe | `/auth/forgot-password`, `/auth/reset-password` |
| `OAuthCallbackPage.jsx` | Récupère le jeton OAuth dans l'URL, l'efface de l'historique et l'enregistre | — |
| `PaymentReturnPage.jsx` | Après Konnect ou Flouci : interroge le statut à plusieurs reprises, le webhook pouvant arriver en retard | `/payments/:orderId/status` |
| `HelpCenterPage.jsx` | FAQ et centre d'aide (contenu statique FR/AR) | — |
| `LegalPage.jsx` | CGU, confidentialité, politique de retour, livraison (contenu statique FR/AR) | — |
| `VendorRegistration.jsx` | Inscription vendeur en 2 étapes (compte puis boutique), avec acceptation obligatoire des conditions de vente et de retour | `/auth/register`, `/vendor/register`, `/gouvernorats` |
| `VendorDashboard.jsx` (≈1 300 lignes) | Espace vendeur, onglets : **Vue d'ensemble** (chiffre d'affaires, commissions, séquestre, solde, commandes et mise à jour de livraison, bordereau PDF, notation des clients) ; **Produits** (CRUD, variantes, upload d'images, ajustement de stock, **import en masse**) ; **Retours** (approuver, refuser, rembourser) ; **Messages** ; **KYC** (CIN, RIB et justificatifs) ; **Retraits** | `/vendor/*`, `/upload`, `/categories`, `/retours`, `/commandes/:id/livraison`, `/livraisons/:id/awb`, `/avis/client` |
| `AdminDashboard.jsx` (≈900 lignes) | Panneau admin, onglets : **Vue d'ensemble** (statistiques), **Vendeurs** (valider, suspendre), **KYC**, **Produits** (activer, désactiver), **Commandes**, **Utilisateurs**, **Avis** (modération), **Retours** (médiation des litiges), **Virements** (valider ou rejeter un virement client), **Retraits** (approuver, verser, rejeter), **Règlement** | `/admin/*`, `/retours` |
| `components/OrderTimeline.jsx` *(composant)* | Suivi de commande dans « Mes commandes » : barre de progression, carte du livreur (distance, arrivée estimée, appel), historique daté dépliable. | — |
| `AdminPage.jsx` | ⚠️ **Code mort** : ancienne page admin avec des données factices, importée nulle part. Peut être supprimée. | — |
| `LivreurLoginPage.jsx` | Connexion livreur | `/livreur/auth/login` |
| `LivreurRegistrationPage.jsx` | Inscription livreur (véhicule, coordonnées) | `/livreur/register` |
| `LivreurDashboardPage.jsx` | Espace livreur : passage en ligne ou hors ligne, **position GPS envoyée toutes les 30 s**, **notifications Socket.io** de nouvelles courses, onglets *Courses*, *Historique* et *Statistiques* | `/livreur/*` |

### 5.5 `src/components/`

| Fichier | Rôle |
|---|---|
| `ProductCard.jsx` | Carte produit : image, prix et prix barré, note, ajout au panier, favori |
| `BoutiqueCard.jsx` | Carte boutique : bannière, logo superposé, badges, bouton d'accès |
| `CategoryDrawer.jsx` | Tiroir latéral des catégories et sous-catégories, avec icônes |
| `ChatWidget.jsx` | Messagerie flottante ou intégrée : liste des conversations et fil de messages. **Recharge les messages toutes les 6 s** (pas de websocket). Peut s'ouvrir directement sur un vendeur et un sujet donnés. |
| `PolicyConsentModal.jsx` | Fenêtre d'acceptation des conditions de vente et de retour. Un refus bloque l'inscription. |
| `home/HomeDashboard.jsx` | Bloc d'accueil personnalisé pour un client connecté : commande en cours avec barre de progression, raccourcis |
| `livreur/LivreurCourseCard.jsx` | Résumé d'une course |
| `livreur/LivreurCourseDetail.jsx` | Détail d'une course : adresses, changement de statut, chat |
| `livreur/LivreurHistorique.jsx` | Historique des courses livrées |
| `livreur/LivreurNotificationOverlay.jsx` | Plein écran « Nouvelle course » avec compte à rebours, bip sonore (Web Audio), boutons accepter et refuser |
| `livreur/LivreurProofModal.jsx` | Envoi d'une preuve de livraison (photo), puis passage en `livree` |
| `livreur/LivreurStatsPanel.jsx` | Statistiques du livreur |
| `vendor/QuickAddModal.jsx` | **Ajout rapide par photos** : une photo = un produit (nom pré-rempli depuis le nom du fichier), catégorie et stock communs, saisie du prix. Photos compressées dans le navigateur (≤ 1600 px, JPEG), 3 envois en parallèle, 2 nouvelles tentatives sur coupure, `Idempotency-Key` par fiche (pas de doublon). Bouton « Ajout rapide (photos) » de l'onglet Produits du tableau de bord vendeur. |
| `vendor/ProductImportModal.jsx` | Assistant d'import en 3 étapes : téléchargement du modèle, dépôt du fichier et **prévisualisation** des lignes valides ou en erreur, puis confirmation ou annulation |
| `ui/Avatar.jsx` | Photo ou initiales |
| `ui/Badge.jsx`, `ui/Button.jsx`, `ui/Card.jsx`, `ui/Input.jsx`, `ui/Modal.jsx` | Composants d'interface de base |
| `ui/Logo.jsx` | Logo « buyhere. » en 3 formes (horizontal, compact, symbole) |
| `NotificationBell.jsx` | Cloche des notifications in-app (en-tête du site, tableau de bord vendeur) : compteur relevé chaque minute, liste, marquer lu. |
| `vendor/VendorStatsPanel.jsx` | Statistiques vendeur : tuiles CA/panier moyen/taux de retour/solde/séquestre, graphique du CA quotidien (7 ou 30 jours) avec infobulle et vue tableau, bandeau stock faible. |
| `admin/AdminAuditLog.jsx` | Onglet « Journal d'audit » de l'admin, filtrable et paginé. |
| `ui/Toast.jsx` | Notifications éphémères : `toast.success()` et `toast.error()` utilisables partout, avec `<ToastHost/>` monté une seule fois |

---

## 6. Application mobile et API alternative — `buyhere/`

### 6.1 `buyhere/README.md`

Décrit un projet « BuyHere » complet : une API Express 5 + Prisma + PostgreSQL et une application Expo.

> ⚠️ **Important** : malgré ce README, **l'application mobile utilise en réalité l'API du site web** (`server/`, port 5000, préfixe `/api`) et non `buyhere/backend` (voir `mobile/src/config.ts` et `mobile/src/api/web.ts`). L'app et le site partagent donc les mêmes comptes, produits et commandes. `buyhere/backend` est une API séparée qui n'est utilisée par aucune autre partie du dépôt.

### 6.2 `buyhere/backend/` — API TypeScript + Prisma (séparée)

| Fichier | Rôle |
|---|---|
| `package.json` | Scripts : `dev` (tsx watch), `build`, `start`, `db:migrate`, `db:deploy`, `db:seed`, `db:reset`, `test:e2e`, `typecheck` |
| `.env.example` | `DATABASE_URL`, deux secrets JWT, `CORS_ORIGINS`, `PUBLIC_API_URL`, Cloudinary, Konnect, Flouci |
| `tsconfig.json` | Configuration TypeScript |
| `prisma/schema.prisma` | Schéma PostgreSQL : User, RefreshToken, PasswordReset, Address, Category, Product, ProductImage, ProductVariant, Cart, CartItem, Order, OrderItem, OrderStatusHistory, Review, Favorite, Coupon, Notification, Banner. **Montants stockés en millimes (entiers).** |
| `prisma/migrations/…_init/migration.sql` | Migration SQL initiale |
| `prisma/seed.ts` | 5 catégories, 30 produits, coupons (`BIENVENUE10`, `ETE2026`, `LIVRAISON7`), comptes `client@buyhere.tn` et `admin@buyhere.tn` (mot de passe `BuyHere2026`) |
| `src/index.ts` / `src/app.ts` | Démarrage du serveur et assemblage Express |
| `src/config/env.ts` | Variables d'environnement validées par Zod |
| `src/lib/prisma.ts`, `tokens.ts`, `cloudinary.ts` | Client Prisma ; JWT et **refresh tokens avec rotation** (réutiliser un jeton révoqué révoque toute la session) ; upload d'avatar |
| `src/middleware/auth.ts`, `validate.ts`, `error.ts` | Authentification JWT, validation Zod, format d'erreur unique `{error:{code,message,details}}` |
| `src/modules/*.routes.ts` | auth, cart, categories, favorites, home, notifications, orders, payments, products, reviews, users |
| `src/services/pricing.ts` | Calcul du panier, des coupons et de la livraison |
| `src/services/productView.ts` | Mise en forme des produits pour l'API |
| `src/services/notify.ts` | Notifications in-app et push Expo |
| `src/services/payments.ts` | Konnect et Flouci, avec vérification côté serveur |
| `src/utils/*` | `AppError`, gouvernorats, langue (`Accept-Language`), pagination, validateurs |
| `tests/e2e.mjs` | 74 scénarios de bout en bout |

### 6.3 `buyhere/mobile/` — application Expo

| Fichier ou dossier | Rôle |
|---|---|
| `package.json`, `app.json` | Expo ~57, React 19, React Native 0.86. `app.json` contient le nom, les icônes et le schéma d'URL `buyhere://`. |
| `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts` | Configuration de NativeWind (Tailwind pour React Native) |
| `eslint.config.js`, `tsconfig.json` | Lint et typage |
| `.env.example` | `EXPO_PUBLIC_API_URL` — **obligatoire pour un APK** : sans elle, un APK installé sur un téléphone vise `10.0.2.2` (émulateur) et ne joint pas le serveur. La valeur est figée à la compilation : la changer impose de recompiler. |
| `AGENTS.md`, `CLAUDE.md` | Consignes pour assistants IA (Expo évolue vite : consulter la documentation de la version utilisée) |
| `LICENSE` | Licence MIT |
| `index.ts` | Point d'entrée Expo |
| `src/App.tsx` | Providers (TanStack Query, navigation, thème, i18n), écran de démarrage animé |
| `src/config.ts` | Résolution de l'URL de l'API : `EXPO_PUBLIC_API_URL`, sinon IP du PC détectée par Expo `:5000/api`, sinon `10.0.2.2` (émulateur Android). Contient aussi `PAYMENT_RETURN_URL` et le téléphone du support. |
| `src/api/client.ts` | Client HTTP qui ajoute le jeton et gère les erreurs |
| `src/api/web.ts` | **Adaptateur** entre l'API du site (champs en français, identifiants numériques, montants en TND) et les types de l'app (millimes, identifiants texte) |
| `src/api/endpoints.ts` | Toutes les fonctions d'appel : catalogue, panier, commandes, paiement via navigateur intégré, favoris, profil, adresses… |
| `src/api/types.ts` | Types TypeScript du domaine |
| `src/store/auth.ts`, `settings.ts`, `local.ts` | Zustand : session (SecureStore), préférences (langue, thème, onboarding), données locales (panier, favoris) |
| `src/hooks/queries.ts` | Hooks TanStack Query (cache, favoris optimistes) |
| `src/hooks/useCountdown.ts`, `useDebounce.ts`, `usePushNotifications.ts`, `useRequireAuth.ts` | Compte à rebours des ventes flash, anti-rebond de la recherche, notifications push, redirection vers la connexion |
| `src/i18n/fr.ts`, `ar.ts`, `index.ts` | Traductions (le fichier arabe est typé sur le français, donc aucune clé ne peut manquer) et bascule RTL |
| `src/navigation/` | `RootNavigator` (pile) ; `MainTabs` (Accueil, Catégories, Recherche, Panier, Compte) ; `types.ts` ; `navigationRef.ts` |
| `src/theme/useTheme.ts`, `interop.ts` | Thème clair, sombre ou système |
| `src/utils/format.ts`, `governorates.ts` | Formatage des prix (« 49,900 DT »), liste des gouvernorats |
| `src/components/` | AddressCard, BannerCarousel, CartItemRow, CategoryItem, FiltersSheet, FlashCountdown, Logo, OrderCard, OrderStatus, OrderSummary, ProductCard, ProductGrid (défilement infini), ReviewItem, SectionHeader, SocialLogin, StoreCard |
| `src/components/ui/` | Button, Chip, Header, Input, Price, QuantityStepper, Rating, Screen, Skeleton, States (chargement, vide, erreur), toast |
| `src/screens/` | AnimatedSplash, Onboarding, Home, Categories, CategoryProducts, Search, ProductDetail, Reviews, Stores, Store, Cart, Checkout, OrderConfirmation, Orders, OrderDetail, Favorites, Notifications, BecomeVendor |
| `src/screens/auth/` | Login, Register, ForgotPassword |
| `src/screens/profile/` | Profile, EditProfile, Addresses, AddressForm |
| `src/screens/PromotionScreen.tsx` | Cible de `buyhere://promotion/CODE` : mémorise le code dans le panier. |
| `src/api/account.ts` | Espaces client : messagerie, retours (envoi multipart des photos), portefeuille, coupons, moyens de paiement, facture PDF (téléchargée puis partagée). |
| `src/screens/messages/` | `ConversationsScreen` (une conversation par boutique) et `ChatScreen` (rechargé toutes les 6 s, envoi immédiat à l'écran). Ouverts par « Contacter la boutique » sur la fiche produit, la boutique et la commande (`hooks/useStartChat.ts`). |
| `src/screens/returns/` | `ReturnRequestScreen` (motif, description, 1 à 5 photos depuis l'appareil photo ou la galerie) et `ReturnsScreen` (« Mes retours » : Envoyée → Examen → Acceptée → Remboursée). |
| `src/screens/WalletScreen.tsx` | Solde et historique (cashback, remboursements, utilisation). Le solde peut être utilisé au paiement (articles uniquement, pas la livraison). |
| `src/screens/CouponsScreen.tsx` | Codes promo en cours, ajoutés au panier en un geste. |
| `src/api/vendor.ts` | **Espace vendeur** : tableau de bord, statistiques, commandes (avancement de la livraison, historique, bordereau AWB), produits (création, modification, photos, stock), retours, retraits, KYC. Mêmes routes que le tableau de bord vendeur du site. |
| `src/screens/seller/` | `SellerHome` (chiffres clés, graphique du CA, alertes stock/KYC), `SellerOrders` / `SellerOrderDetail`, `SellerProducts` / `SellerProductForm`, `SellerQuickAdd` (ajout rapide : appareil photo en rafale ou galerie, une photo = un produit, brouillon sauvegardé sur le téléphone, envoi fiable sans doublon), `SellerReturns`, `SellerWithdrawals`, `SellerKyc`. Accès : Profil → « Espace vendeur », carte sur l'accueil, fin de l'inscription vendeur, et les notifications vendeur (`vendeur/...`). |
| `src/api/courier.ts` | **Espace livreur** : courses libres et en cours, statistiques, historique des gains, disponibilité, position GPS, acceptation, retrait du colis, preuve photo, livraison ou échec, propositions de course (lecture, acceptation, refus) et inscription livreur. Mêmes routes que le tableau de bord livreur du site (`livreurRoutes.js`). |
| `src/components/courier/CourierRuntime.tsx` | Service de fond monté dans la navigation pour un compte livreur en service (hors « Hors ligne ») et app ouverte : envoie la position GPS (au plus toutes les 30 s, via `expo-location`) et interroge `/livreur/notifications/pending` toutes les 5 s pour afficher la fenêtre « Nouvelle course » avec compte à rebours, par-dessus n'importe quel écran. |
| `src/screens/courier/` | `CourierHome` (disponibilité, gains, courses en cours et libres), `CourierCourse` (trajet, montant à encaisser en COD, itinéraire Google Maps, appel du client, retrait, photo de preuve, livraison ou échec), `CourierHistory`, `CourierRegister` (« Devenir livreur », compte dédié). Accès : Profil, carte sur l'accueil, lien `livreur` des notifications. |
| `src/api/admin.ts` | **Espace administrateur** (rôles administrateur et super_admin) : statistiques, boutiques (activation, suspension, KYC), retraits, virements bancaires, commandes (historique, changement de statut manuel avec commentaire), produits (statut, stock faible), avis, utilisateurs, journal d'audit, photos de catégorie. Mêmes routes que le tableau de bord admin du site (`adminRoutes.js`). |
| `src/screens/admin/` | `AdminHome` (chiffres clés, files à traiter avec compteurs), `AdminStores` / `AdminStore`, `AdminWithdrawals`, `AdminTransfers`, `AdminOrders` / `AdminOrder`, `AdminProducts`, `AdminReviews`, `AdminUsers`, `AdminAudit`, `AdminCategories`. Les retours et litiges réutilisent `SellerReturns`, qui s'adapte au rôle (l'admin tranche les litiges). Accès : Profil → « Administration », carte sur l'accueil, liens `admin/...`. |
| `src/components/OrderMap.tsx` | Carte de suivi du détail de commande (commande en cours) : boutique, adresse de livraison (cercle si position approximative) et livreur en direct. Leaflet / OpenStreetMap dans une WebView (`react-native-webview`), sans clé API ; positions mises à jour sans recharger la carte. Le site a l'équivalent dans `client/src/components/OrderMap.jsx` (page « Mes commandes », rafraîchie toutes les 30 s pendant la livraison). |
| `src/components/CourierCard.tsx` | Livreur assigné : véhicule, note, distance, arrivée estimée, appel et WhatsApp. |
| `src/navigation/linking.ts` | **Deep linking** : `buyhere://produit/123`, `boutique/5`, `commande/789`, `promotion/ETE2026`, et les liens du site `https://buyhere.tn/produits/123` (alias). |

Lancement : `cd buyhere/mobile && npm install && npx expo start`, puis scanner le QR code avec Expo Go. Le PC et le téléphone doivent être sur le même Wi-Fi, et le serveur du site doit tourner.

---

## 7. Parcours métier de bout en bout

### 7.1 Passer une commande

`POST /api/commandes` → `createCommande`, exécuté dans **une transaction SQL** (tout est annulé en cas d'erreur).

1. **Qui commande ?** Un client connecté, ou un invité qui doit fournir nom, prénom, email et téléphone. Les comptes vendeur, admin et livreur ne peuvent pas commander.
2. **Validation des lignes** : produit `actif`, variante existante, prix recalculé **côté serveur** (avec le supplément de variante), stock suffisant.
3. **Découpage par boutique** : un panier qui contient 3 boutiques produit **3 commandes** liées par un `groupeCommande`. Le paiement en ligne n'est accepté que pour une seule boutique ; sinon, seul le paiement à la livraison est possible.
4. **Montants** :
   - remise du coupon (vérification de la validité, du montant minimum et de la limite d'utilisation), répartie entre les boutiques au prorata ;
   - frais de livraison = frais du gouvernorat × nombre de boutiques, gratuits au-delà du seuil s'il est configuré ;
   - **wallet** : plafonné au solde réel et au sous-total des produits (il ne couvre jamais la livraison) ;
   - **commission** = 15 % du sous-total ; `montantVendeur` = sous-total − commission.
5. **Création** pour chaque boutique : Commande, LignesCommande, **décrément du stock**, Paiement, Commission, Livraison (suivi et AWB).
6. **Paiement à la livraison** : un `confirmationToken` valable 48 h est envoyé par email et SMS, et le client confirme sur `/confirmer-commande/:token`.
7. **Konnect / Flouci** : initialisation du paiement et URL de redirection renvoyée au site.
8. **Virement** : le paiement reste `en_attente_validation` et le site affiche le RIB de la plateforme ; un admin valide ensuite dans l'onglet *Virements*.
9. **Emails** : confirmation, garantie, contrat de retour, **facture PDF**, lien de confirmation.
10. Si le total est déjà couvert (coupon et wallet), la commande est directement `payee` et le **cashback** est crédité.

### 7.2 Paiement en ligne sécurisé

1. `POST /payments/initiate` : le montant est **relu depuis la base**, jamais pris dans la requête du client. Une clé d'idempotence (en-tête `Idempotency-Key`, ou une clé par défaut) empêche le double débit.
2. Le prestataire appelle `POST /payments/webhook/:provider`, signé en **HMAC** sur le corps brut. Le serveur vérifie la signature et le montant (tolérance de 0,001 DT), passe la commande en `payee`, crédite le cashback et envoie le reçu.
3. Le site interroge `GET /payments/:orderId/status` jusqu'à recevoir la confirmation.
4. Chaque étape est tracée dans `Transaction` et `PaymentLog`.

### 7.3 Livraison par livreur

1. La livraison passe en `statutAssignation = en_attente`. `matchAndNotifyCourierForLivraison` construit la liste des livreurs `disponible` dans un rayon de 10 km autour de la boutique, triés par distance.
2. Le premier reçoit `notification:nouvelle` par Socket.io. S'il ne répond pas en 60 s ou s'il refuse, le suivant est notifié.
3. Acceptation : `PATCH /livreur/notifications/:id/accepter`. La course est assignée et le livreur passe en `occupe`.
4. `en_cours` → `livree` (avec preuve photo) ou `echec` (la course retourne dans le pool).
5. À l'état `livree` : la commande passe en `livree` ; si le paiement se faisait à la livraison, il passe en `paye_livraison` et le **cashback** est crédité ; un SMS est envoyé au client ; le livreur redevient `disponible`.

### 7.4 Retours (RMA) et séquestre

1. Le client ouvre une demande avec un **motif catégorisé** et **au moins une photo**, dans la fenêtre de retour (le délai le plus court parmi les produits de la commande, compté à partir de la livraison).
2. Le vendeur a **48 h** pour répondre. Passé ce délai, la demande passe automatiquement en **`litige`** (vérifié à chaque lecture), et seul un admin peut alors trancher.
3. Les frais de retour sont à la charge du vendeur pour un défaut ou une non-conformité, du client pour un changement d'avis.
4. À l'état `rembourse` : la commande passe en `retournee`, **le stock est restitué** et le montant est **crédité sur le solde site** du client (pas sur le moyen de paiement d'origine).
5. **Séquestre** : l'argent d'une commande n'est retirable par le vendeur qu'après la fin de la fenêtre de retour, sans retour actif (`finance.js`).

### 7.5 Cycle de vie d'un vendeur

Inscription (compte et boutique, `statut = en_attente`) → validation par l'admin → **KYC** (CIN et RIB avec justificatifs, puis `valide` ou `rejete` par l'admin, ce qui donne le badge « boutique vérifiée ») → ajout de produits (unitaire ou **import Excel/CSV/ZIP**) → traitement des commandes → **demande de retrait** (minimum 50 DT, dans la limite du solde libéré) → l'admin approuve puis verse.

---

## 8. Référence complète de l'API

Toutes les routes sont préfixées par `/api`. 🔒 = en-tête `Authorization: Bearer <jwt>` requis.

### Public et catalogue
| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | État du serveur |
| GET | `/config/payment-methods` | Moyens de paiement disponibles (virement seulement si un RIB est configuré) |
| GET | `/gouvernorats` | Les 24 gouvernorats |
| GET | `/gouvernorats/:id/delegations` | Délégations d'un gouvernorat |
| GET | `/gouvernorats/:id/frais` | Frais de livraison |
| GET | `/produits` | Liste filtrée et paginée (`page`, `limit`, `search`, `categoryId`, `storeId`, `minPrice`, `maxPrice`, `minRating`, `inStock`, `promotion`, `sort`) |
| GET | `/produits/:id` | Détail d'un produit |
| GET | `/produits/:produitId/avis` | Avis d'un produit |
| GET | `/boutiques`, `/boutiques/:id` | Boutiques |
| GET | `/categories` | Arborescence des catégories |
| GET | `/coupons/actifs` | Codes promo actifs |
| GET | `/livraisons/track/:trackingId` | Suivi d'un colis |
| GET / POST | `/commandes/confirmation/:token` | Confirmation d'une commande payée à la livraison |
| GET | `/vendor/shop/:vendeurId` | Vitrine publique d'un vendeur |

### Authentification et profil
| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Inscription (`accepteConditions: true` obligatoire) |
| POST | `/auth/login` | Connexion → `{token, user}` |
| POST | `/auth/forgot-password` | Envoi du lien de réinitialisation |
| POST | `/auth/reset-password` | Nouveau mot de passe |
| GET | `/auth/google`, `/auth/facebook` (+ `/callback`) | Connexion OAuth |
| GET / PATCH 🔒 | `/users/me` | Lire ou modifier son profil |
| PATCH 🔒 | `/users/me/password` | Changer de mot de passe |

### Client
| Méthode | Route | Description |
|---|---|---|
| POST | `/commandes` | Passer commande (invité ou connecté) |
| POST 🔒 | `/paiements/confirm` | Confirmation d'un paiement sandbox |
| GET 🔒 | `/commandes/mes-commandes` | Historique des commandes |
| PUT 🔒 | `/commandes/:id/annuler` | Annuler une commande |
| GET 🔒 | `/commandes/:id/facture` | Facture PDF (`?lang=fr` ou `ar`) |
| POST 🔒 | `/coupons/valider` | Vérifier un coupon |
| GET / POST / DELETE 🔒 | `/wishlist`, `/wishlist/:produitId`, `/wishlist/check` | Favoris |
| POST 🔒 | `/avis` | Laisser un avis |
| GET 🔒 | `/avis/mes-avis` | Mes avis |
| GET 🔒 | `/wallet/me` | Solde et historique |
| POST / GET 🔒 | `/retours` | Créer (multipart, 5 photos maximum) ou lister ses retours |
| POST / GET 🔒 | `/chat/conversations`, `/chat/conversations/:id/messages`, `/chat/messages` | Messagerie |

### Paiements
| Méthode | Route | Description |
|---|---|---|
| POST 🔒 | `/payments/initiate` | Initier un paiement (`commandeId`, `provider`) |
| POST | `/payments/webhook/:provider` | Webhook signé (HMAC) |
| GET 🔒 | `/payments/:orderId/status` | Statut d'un paiement |

### Vendeur 🔒 (vendeur, admin_boutique, admins)
| Méthode | Route | Description |
|---|---|---|
| POST | `/vendor/register` | Créer sa boutique |
| GET | `/vendor/dashboard/:vendeurId` | Statistiques, finances, commandes |
| PUT | `/vendor/boutique/:vendeurId` | Modifier la boutique |
| POST | `/vendor/kyc/:vendeurId` | Soumettre le KYC (multipart `documentCin`, `documentRib`) |
| GET / POST | `/vendor/products/:vendeurId` | Lister ou créer des produits. En création, l'en-tête facultatif `Idempotency-Key` (8 à 128 caractères) renvoie le produit déjà créé avec la même clé (statut 200, `replayed: true`) au lieu d'un doublon — registre en mémoire de 24 h (`utils/idempotency.js`). |
| PUT / DELETE | `/vendor/products/:produitId` | Modifier ou supprimer un produit |
| PATCH | `/vendor/products/:produitId/stock` | Ajuster le stock |
| GET | `/vendor/products/:produitId/stock-history` | Historique du stock |
| GET | `/vendor/products/import/template` | Modèle Excel d'import |
| POST | `/vendor/products/:vendeurId/import/preview` | Prévisualisation d'un import (champ `fichier`) |
| POST | `/vendor/products/:vendeurId/import/commit` | Valider un import |
| DELETE | `/vendor/products/import/:importId` | Annuler un import |
| POST | `/vendor/withdrawal` | Demander un retrait |
| PUT | `/commandes/:commandeId/livraison` | Mettre à jour le statut de livraison |
| POST | `/orders/:id/assign-delivery` | Assigner un livreur manuellement |
| GET | `/livraisons/:commandeId/awb` | Bordereau d'expédition PDF |
| POST | `/upload` | Envoyer une image |
| POST | `/avis/client` | Noter un client |
| GET | `/clients/:clientId/reputation` | Réputation d'un client |
| PUT | `/retours/:id/statut` | Approuver, refuser ou rembourser un retour |

### Livreur 🔒
| Méthode | Route | Description |
|---|---|---|
| POST | `/livreur/register`, `/livreur/auth/login` | Inscription et connexion (publiques) |
| PATCH | `/livreur/statut` | Passer disponible ou hors ligne |
| PATCH | `/livreur/position` | Envoyer sa position GPS |
| GET | `/livreur/courses` | Courses disponibles et assignées |
| PATCH | `/livreur/courses/:id/accepter` | Accepter une course |
| PATCH | `/livreur/courses/:id/statut` | Passer en `en_cours`, `livree` ou `echec` |
| POST | `/livreur/courses/:id/preuve` | Envoyer la preuve de livraison (champ `preuve`) |
| GET | `/livreur/historique`, `/livreur/stats` | Historique et statistiques |
| GET | `/livreur/notifications/pending` | Offres en attente |
| PATCH | `/livreur/notifications/:id/accepter` ou `/refuser` | Répondre à une offre |

### Admin 🔒 (administrateur, super_admin)
| Méthode | Route | Description |
|---|---|---|
| GET | `/admin/stats` | Statistiques globales |
| GET | `/admin/vendors` | Boutiques et vendeurs |
| PUT | `/admin/vendors/:boutiqueId/status` | Changer le statut d'une boutique |
| PATCH | `/admin/boutiques/:id/statut` | Changer le statut d'une boutique (variante) |
| PATCH | `/admin/boutiques/:id/kyc` | Valider ou rejeter le KYC |
| GET | `/admin/withdrawals` | Demandes de retrait |
| PUT | `/admin/withdrawals/:retraitId` | Approuver, verser ou rejeter un retrait |
| GET | `/admin/virements` | Virements clients à valider |
| PATCH | `/admin/virements/:paiementId/valider` ou `/rejeter` | Traiter un virement |
| GET | `/admin/commissions` | Analyse des commissions |
| GET / PATCH | `/admin/avis`, `/admin/avis/:id` | Modération des avis |
| GET | `/admin/orders`, `/admin/users` | Commandes et utilisateurs |
| GET / PATCH / DELETE | `/admin/products`, `/admin/products/:id/status`, `/admin/products/:id` | Gestion des produits |
| GET | `/admin/settlement-report` | Rapport de règlement des vendeurs |

### Temps réel (Socket.io)
| Événement | Sens | Contenu |
|---|---|---|
| `notification:nouvelle` | serveur → livreur (salon `livreur:<id>`) | `notificationId`, `livraisonId`, `trackingId`, `distanceKm`, adresses de départ et d'arrivée, `fraisLivraison`, `expiresAt` |

---

## 9. Variables d'environnement

### Serveur (`server/.env`)

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 5000 | Port de l'API |
| `NODE_ENV` | development | `production` désactive les simulations de paiement et les origines CORS de développement |
| `PAYMENT_MODE` | sandbox | Mode des paiements |
| `JWT_SECRET` | — | **À changer impérativement** (secret de signature des JWT) |
| `DATABASE_URL` | `sqlite://./data/marketplace.db` | `postgres://…` pour utiliser PostgreSQL |
| `DATABASE_SSL` | true | `false` pour un PostgreSQL sans certificat TLS |
| `API_BASE_URL`, `CLIENT_URL`, `FRONTEND_URL` | localhost | Redirections OAuth, liens dans les emails, retours de paiement, CORS |
| `COMMISSION_RATE` | 0.15 | Taux de commission |
| `MIN_WITHDRAWAL_AMOUNT` | 50 | Retrait minimum (DT) |
| `FREE_SHIPPING_THRESHOLD` | 0 | Seuil de livraison gratuite (0 = désactivé) |
| `SHIPPING_CHARGE_PER_STORE` | true | Facturer la livraison par boutique |
| `COURIER_SEARCH_RADIUS_KM` | 10 | Rayon de recherche des livreurs |
| `COURIER_NOTIFICATION_TIMEOUT_SECONDS` | 60 | Délai avant de passer au livreur suivant |
| `WALLET_CASHBACK_RATE` | 0.01 | Taux de cashback |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Connexion Google |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | — | Connexion Facebook |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | — | Envoi d'emails |
| `KONNECT_API_KEY`, `KONNECT_WALLET_ID`, `KONNECT_WEBHOOK_SECRET` | — | Paiement Konnect (vide = simulation) |
| `FLOUCI_APP_TOKEN`, `FLOUCI_APP_SECRET`, `FLOUCI_WEBHOOK_SECRET` | — | Paiement Flouci (vide = simulation) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | — | Stockage des images (vide = disque local) |
| `SMS_PROVIDER` | mock | `mock`, `twilio` ou `winsms` |
| `WINSMS_API_KEY`, `WINSMS_SENDER`, `TWILIO_*` | — | Identifiants SMS |
| `PLATFORM_BANK_TITULAIRE`, `PLATFORM_BANK_RIB`, `PLATFORM_BANK_NAME` | — | RIB affiché pour le virement (vide = option masquée) |
| `DEMO_*_EMAIL`, `DEMO_*_PASSWORD` | voir §2 | Remplacent les identifiants des comptes de démo |
| `SQLITE_STORAGE` | — | Fichier SQLite alternatif (tests) |

### Client (`client/.env`)

| Variable | Rôle |
|---|---|
| `VITE_API_URL` | URL de l'API (`/api` en production sur le même domaine) |
| `VITE_DEFAULT_LANGUAGE` | `fr` ou `ar` |

### Mobile (`buyhere/mobile/.env`)

| Variable | Rôle |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL de l'API du site, par exemple `https://here-tn.onrender.com/api` |

---

## 10. Points d'attention et limites connues

**Sécurité et production**
- Changer `JWT_SECRET` et les mots de passe de démo avant toute mise en ligne : ils sont publics dans le README.
- Le JWT est stocké dans `localStorage` (exposé en cas de faille XSS) et dure 7 jours, sans refresh token côté site.
- Aucun paiement réel n'est actif tant que les clés Konnect ou Flouci ne sont pas configurées et qu'un webhook n'a pas été testé. Le format exact de signature de chaque prestataire est à ajuster dans `services/payments/hmac.js`.

**Services externes non configurés par défaut**
- **Emails** : sans SMTP, les envois échouent (erreurs dans les logs, sans bloquer la commande).
- **SMS** : en mode `mock`, ils sont seulement affichés dans la console.
- **Images** : sans Cloudinary, elles sont stockées dans `server/uploads/`, qui **ne survit pas à un redéploiement** sur Render.

**Architecture**
- L'état de la cascade d'attribution des livreurs et les imports en attente sont gardés **en mémoire** : ils sont perdus au redémarrage (la cascade se reconstruit en partie) et l'application ne peut pas tourner en plusieurs instances.
- La migration automatique **ajoute** les colonnes manquantes mais ne modifie ni ne supprime jamais une colonne existante.
- Le chat recharge les messages toutes les 6 s : ce n'est pas du vrai temps réel.
- Le paiement en ligne n'est pas possible pour un panier qui contient plusieurs boutiques.

**Code**
- `buyhere/backend` est une API complète que ni le site ni l'app mobile n'utilisent : le README de `buyhere/` est trompeur sur ce point.
- `IMPLEMENTATION_SUMMARY.md` est partiellement obsolète (port, fonctionnalités indiquées comme « à faire »).

---

## 11. Machine d'états, stock, notifications, audit (Phase 1)

### 11.1 Statuts de commande

Seul `server/src/utils/orderStatus.js` modifie `Commande.statut`. Chaque transition est validée, écrite par un UPDATE conditionnel (deux requêtes simultanées ne peuvent pas partir du même état), historisée dans `HistoriqueCommande` et notifiée au client.

```
en_attente → payee → preparation → expediee → en_cours_livraison → livree
en_attente | payee | preparation → annulee
en_cours_livraison → expediee            (échec de livraison, nouvelle tentative)
livree → retour → litige | livree (retour refusé) | retournee (remboursée)
litige → livree | retournee
```

- On peut avancer de plusieurs crans : une commande payée à la livraison passe d'`en_attente` à `preparation` sans être `payee` (elle est encaissée à la livraison).
- Toute marche arrière hors des branches ci-dessus est refusée (409) : `livree → payee`, `annulee → expediee`, `retournee → livree`…
- `annulee` et `retournee` sont terminaux.
- Une commande payable en ligne mais non payée ne peut pas être préparée ni expédiée.
- Le statut de livraison choisi par le vendeur (`en_preparation`, `expedie`, `en_cours_livraison`, `livre`) fait avancer la commande ; seul le vendeur de la boutique ou un admin peut le faire.

### 11.2 Stock

- Décrément **atomique** à la commande : `UPDATE … SET stock = stock - q WHERE stock >= q`. Deux clients qui achètent le dernier article en même temps : un seul réussit, l'autre reçoit **409 « Stock insuffisant »**. Le stock ne devient jamais négatif.
- Le stock d'un produit à variantes est recalculé comme la somme de ses variantes.
- **Restitution** du stock à l'annulation client, au refus de confirmation COD, au rejet d'un virement, à l'annulation admin et au remboursement d'un retour.
- Chaque mouvement est journalisé (`MouvementStock`, motifs `vente`, `annulation`, `retour`).
- **Alerte vendeur** quand le stock passe à ≤ `LOW_STOCK_THRESHOLD` (5 par défaut), puis à 0 (rupture). Filtres « stock faible » côté vendeur (`?stock=faible|rupture`) et admin (`/admin/products?stock=faible`).
- SQLite : les transactions démarrent en mode `IMMEDIATE` avec 5 s d'attente du verrou, et la base est en mode WAL. Les écritures concurrentes s'exécutent l'une après l'autre au lieu d'échouer en `SQLITE_BUSY`.

### 11.3 Notifications

Une notification = une ligne `Notification` (cloche du site, écran Notifications de l'app) + un push Expo sur chaque appareil du compte.

| Destinataire | Événements |
|---|---|
| Client | commande confirmée, paiement confirmé/refusé/annulé, en préparation, expédiée, livreur trouvé, livreur en route, livrée, annulée, retour accepté/refusé, remboursement, nouveau message |
| Vendeur | nouvelle commande, stock faible, rupture, nouveau retour, nouveau message, KYC validé/refusé, boutique validée/suspendue, retrait accepté/versé/refusé |

Le `lien` d'une notification (`commande/12`, `messages/3`…) ouvre l'écran correspondant : deep link dans l'app, onglet ou page sur le site.

### 11.4 Journal d'audit

Toutes les actions admin sensibles sont journalisées avec l'état avant/après : validation KYC, statut de boutique, retraits, virements, statut de commande (`PATCH /admin/orders/:id/statut`, commentaire obligatoire), décisions de retour, statut et suppression de produit, modération d'avis. Consultation : `GET /admin/audit-logs` (onglet « Journal d'audit »).

### 11.5 Nouvelles routes

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/commandes/:id/historique` | client, vendeur, admin | Chronologie et suivi livreur |
| GET | `/vendor/stats/:vendeurId?jours=7` (ou 30) | vendeur | Statistiques et série quotidienne |
| GET | `/vendor/products/:vendeurId?stock=faible` (ou `rupture`) | vendeur | Filtre de stock |
| GET | `/admin/products?stock=faible` | admin | Produits presque épuisés |
| PATCH | `/admin/orders/:id/statut` | admin | Statut manuel (machine d'états + audit) |
| GET | `/admin/orders/:id/historique` | admin | Chronologie détaillée |
| GET | `/admin/audit-logs` | admin | Journal d'audit (`entite`, `entiteId`, `action`, `acteurId`, `page`) |
| GET | `/notifications`, `/notifications/non-lues` | authentifié | Notifications |
| PATCH | `/notifications/:id/lu`, `/notifications/tout-lu` | authentifié | Marquer lu |
| PUT / DELETE | `/users/me/push-token` | authentifié | Jeton Expo Push |
| POST | `/payments/sandbox/simulate` | client (sandbox) | Joue un scénario de paiement |

### 11.6 Paiement : comportements ajoutés

- Une tentative échouée, annulée ou expirée permet un nouvel essai (nouvelle transaction) ; une tentative en cours est rejouée (idempotence).
- Une transaction sans webhook depuis `PAYMENT_TIMEOUT_MINUTES` (30 par défaut) est marquée en échec à la lecture du statut ; un webhook « validée » tardif reste honoré.
- Validation de webhook atomique : des webhooks dupliqués, même simultanés, ne créditent le cashback et n'historisent la commande qu'une fois.

### 11.7 Liens d'application (mobile)

L'app déclare les domaines `here.tn` / `www.here.tn` dans `app.json` : `intentFilters` Android avec `autoVerify`, `associatedDomains` iOS. Pour que la vérification réussisse, renseigner `ANDROID_SHA256_CERT_FINGERPRINTS` et `APPLE_APP_ID` côté serveur, qui sert alors `/.well-known/assetlinks.json` et `apple-app-site-association`. Le domaine doit être celui où l'API est servie. Les liens `buyhere://…` fonctionnent sans configuration.
