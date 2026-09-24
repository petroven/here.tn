# BuyHere 🛒

Application mobile e-commerce pour le marché tunisien : parcourir, ajouter au panier,
commander (paiement à la livraison, Konnect ou Flouci) et suivre ses livraisons.
Français et arabe (RTL), mode sombre, prix en dinars (« 49,900 DT »).

```
buyhere/
├── backend/   API REST — Node.js, Express 5, Prisma 6, PostgreSQL, Zod, JWT
└── mobile/    App — React Native (Expo SDK 57), TypeScript, React Navigation,
               Zustand, TanStack Query, NativeWind, i18next
```

---

## 1. Prérequis

| Outil | Version |
|---|---|
| Node.js | 20 ou plus |
| PostgreSQL | 14 ou plus |
| Expo Go / development build | sur votre téléphone, ou un émulateur Android / simulateur iOS |

Comptes facultatifs : [Cloudinary](https://cloudinary.com) (photos de profil),
[Konnect](https://dashboard.sandbox.konnect.network) et [Flouci](https://developers.flouci.com) (paiement en ligne, sandbox).

---

## 2. Lancer le backend

```bash
cd buyhere/backend
npm install
cp .env.example .env          # puis renseigner DATABASE_URL et les 2 secrets JWT
```

Créez la base, puis appliquez le schéma et les données de test :

```bash
createdb buyhere        # ou via pgAdmin
npm run db:migrate            # crée les tables (prisma migrate dev)
npm run db:seed               # 5 catégories, 30 produits, coupons, comptes démo
npm run dev                   # API sur http://localhost:4000
```

Vérification : `curl http://localhost:4000/health` → `{"status":"ok"}`.

**Comptes de démonstration** (mot de passe `BuyHere2026`) :

| Email | Rôle |
|---|---|
| `client@buyhere.tn` (ou tél. `22 123 456`) | Client : adresses, 2 commandes (dont une livrée), favoris, notifications |
| `admin@buyhere.tn` | Admin : peut faire avancer les commandes (`PATCH /orders/:id/status`) |

**Codes promo** : `BIENVENUE10` (-10 %, max 30 DT), `ETE2026` (-20 % dès 100 DT), `LIVRAISON7` (-7 DT dès 50 DT).

### Tests

```bash
npm run db:reset && npm run dev     # base propre + API lancée
npm run test:e2e                    # 74 scénarios de bout en bout
npm run typecheck
```

### Production

```bash
npm run build          # prisma generate + compilation TypeScript -> dist/
npm run db:deploy      # applique les migrations (sans seed)
npm start
```

Mettre `NODE_ENV=production`, des secrets JWT aléatoires (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`),
`CORS_ORIGINS` et `PUBLIC_API_URL` (URL publique, nécessaire aux webhooks de paiement).

---

## 3. Lancer l'application mobile

```bash
cd buyhere/mobile
npm install
npx expo start
```

Scannez le QR code avec **Expo Go** (même Wi-Fi que le PC). L'app trouve l'API
automatiquement (`http://<IP-du-PC>:4000`) ; sinon, renseignez `EXPO_PUBLIC_API_URL`
dans `mobile/.env` (voir `.env.example`).

Émulateur : touche `a` (Android) ou `i` (iOS) dans le terminal Expo.

> **Limites d'Expo Go** — deux fonctions exigent un *development build*
> (`npx expo run:android` ou `eas build --profile development`) :
> - les **notifications push** distantes (non disponibles dans Expo Go Android depuis le SDK 53) ;
> - le **passage en arabe (RTL)** : Expo Go réinitialise l'orientation RTL. Les textes arabes s'affichent, mais la mise en page reste de gauche à droite.

Contrôles qualité :

```bash
npx tsc --noEmit       # typage
npx expo-doctor        # dépendances et configuration
```

---

## 4. Architecture

### Backend (`backend/src`)

```
config/env.ts          Variables d'environnement validées par Zod au démarrage
lib/                   Prisma, JWT + refresh tokens, Cloudinary
middleware/            auth (JWT), validate (Zod), error (gestion centralisée)
services/              pricing (panier, coupons, livraison), productView,
                       notify (in-app + push Expo), payments (Konnect / Flouci)
modules/*.routes.ts    Une route Express par ressource
prisma/schema.prisma   Schéma PostgreSQL complet · prisma/seed.ts : données de test
tests/e2e.mjs          Tests de bout en bout
```

Choix importants :
- **Montants en millimes (entiers)** : 49,900 DT = `49900`. Aucune erreur d'arrondi.
- **Stock décrémenté de façon atomique** dans la transaction de commande
  (`UPDATE … WHERE stock >= qty`) : deux clients ne peuvent pas acheter le dernier article.
- **Refresh tokens avec rotation** : seul le hash est stocké ; réutiliser un jeton
  révoqué révoque toute la session (détection de vol).
- **Commande figée** : adresse et produits sont copiés dans la commande (lisible
  même si le produit ou l'adresse change ensuite).
- **Paiement en ligne vérifié côté serveur** auprès de la passerelle, jamais sur la
  seule foi de la redirection. Sans clés sandbox, l'API répond `503 PAYMENT_UNAVAILABLE`.
- **Erreurs** : toujours `{ "error": { "code", "message", "details?" } }`.

### Mobile (`mobile/src`)

```
api/          client axios (jeton + refresh automatique), endpoints typés, types
store/        Zustand : session (SecureStore), préférences (langue, thème, onboarding)
hooks/        TanStack Query (cache serveur, favoris optimistes), push, compte à rebours
i18n/         fr.ts (référence) et ar.ts (typé : aucune clé manquante possible)
navigation/   Stack racine + 5 onglets (Accueil, Recherche, Panier, Favoris, Profil)
components/   UI réutilisable : Button, Input, Skeleton, Price, Chip, ProductCard,
              ProductGrid (scroll infini), BannerCarousel, OrderTimeline…
screens/      Tous les écrans
```

- Le catalogue est consultable **sans compte** ; panier, favoris et commande
  ouvrent la connexion puis reviennent à l'écran d'origine.
- Mode sombre : Système / Clair / Sombre (Profil).
- Arabe : bascule RTL avec redémarrage automatique de l'app.

---

## 5. API REST

Toutes les routes acceptent `Accept-Language: fr|ar` (ou `?lang=`) pour les textes traduits.
🔒 = en-tête `Authorization: Bearer <accessToken>` requis.

| Méthode | Route | Description |
|---|---|---|
| POST | `/auth/register` | Inscription (email, téléphone facultatif) |
| POST | `/auth/login` | Connexion par email **ou** téléphone (`identifier`) |
| POST | `/auth/refresh` | Nouvelle paire de jetons (rotation) |
| POST | `/auth/logout` | Révoque le refresh token |
| POST | `/auth/forgot-password` | Envoie un code à 6 chiffres (15 min) |
| POST | `/auth/reset-password` | Code + nouveau mot de passe |
| GET | `/home` | Bannières, catégories, flash, populaires, nouveautés |
| GET | `/categories` | Catégories + nombre de produits |
| GET | `/products` | Liste paginée : `q, category, minPrice, maxPrice, minRating, onSale, flash, featured, inStock, sort, page, limit` |
| GET | `/products/suggestions?q=` | Auto-complétion |
| GET | `/products/:idOrSlug` | Détail + variantes + similaires |
| GET | `/reviews/product/:id` | Avis paginés + répartition des notes |
| POST | `/reviews` 🔒 | Noter un produit reçu (commande livrée) |
| GET/DELETE | `/cart` 🔒 | Panier recalculé / vider |
| POST | `/cart/items` 🔒 | Ajouter (`productId`, `variantId`, `quantity`) |
| PATCH/DELETE | `/cart/items/:id` 🔒 | Quantité / retirer |
| POST/DELETE | `/cart/coupon` 🔒 | Appliquer / retirer un code promo |
| POST | `/orders` 🔒 | Commander (`addressId`, `paymentMethod`, `note`) |
| GET | `/orders` 🔒 | Historique paginé (`status` facultatif) |
| GET | `/orders/:id` 🔒 | Détail + historique de statuts |
| POST | `/orders/:id/cancel` 🔒 | Annuler (avant expédition), stock restitué |
| POST | `/orders/:id/pay` 🔒 | Relancer un paiement en ligne |
| PATCH | `/orders/:id/status` 🔒 admin | Confirmée → Expédiée → Livrée (notifie le client) |
| POST | `/payments/verify/:orderId` 🔒 | Vérifie le paiement auprès de la passerelle |
| GET | `/payments/konnect/webhook` | Webhook Konnect |
| GET/PUT/DELETE | `/favorites`, `/favorites/ids`, `/favorites/:productId` 🔒 | Liste de souhaits |
| GET/PATCH/DELETE | `/users/me` 🔒 | Profil / suppression du compte |
| POST | `/users/me/avatar` 🔒 | Photo de profil (multipart, Cloudinary) |
| POST | `/users/me/password` 🔒 | Changer le mot de passe |
| PUT | `/users/me/push-token` 🔒 | Jeton Expo Notifications |
| CRUD | `/users/me/addresses` 🔒 | Adresses (24 gouvernorats) |
| GET/POST | `/notifications`, `/notifications/unread-count`, `/notifications/read-all`, `/notifications/:id/read` 🔒 | Notifications |

---

## 6. À brancher avant la mise en production

- **Email / SMS** pour « mot de passe oublié » : le code est pour l'instant écrit dans les
  logs du serveur (et renvoyé dans `devCode` hors production). Ajouter l'envoi dans
  `backend/src/modules/auth.routes.ts` (ex. Brevo, Twilio, TunisieSMS).
- **Clés Konnect / Flouci** (sandbox puis production) dans `.env`.
- **Cloudinary** pour les photos de profil (sans clés : `503 UPLOAD_DISABLED`).
- **Back-office** : l'API expose le changement de statut admin, mais aucune interface
  d'administration n'est incluse (gestion des produits, commandes).
- **Build des stores** : `npx eas-cli@latest build` (configurer `eas.json` et le `projectId`
  EAS, nécessaire aussi aux notifications push).
