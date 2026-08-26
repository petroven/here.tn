# Plateforme E-commerce Multi-vendeurs

## Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Base de données: SQLite (prototype de démonstration)

## Démarrage

### 1. Installer les dépendances
```bash
npm install --prefix server
npm install --prefix client
```

### 2. Lancer le backend
```bash
npm --prefix server run dev
```

### 3. Lancer le frontend
```bash
npm --prefix client run dev -- --host 0.0.0.0
```

### 4. Vérifier l'API
```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/produits
```

## Fonctionnalités incluses
- Catalogue produit
- Boutique vendeur
- Dashboard vendeur
- Modèle de commande multi-vendeurs
- API REST de démonstration

## Points d'amélioration
- Ajouter les modèles Sequelize complets (Utilisateur, Boutique, Produit, Commande...)
- Mettre en place JWT et authentification
- Ajouter Stripe Connect ou service de paiement tiers
- Construire les écrans React complets pour checkout, gestion admin, chat
- Sécuriser les transactions et la validation du stock

## Comptes de démonstration

Ces comptes sont créés automatiquement au démarrage du serveur uniquement pour les tests locaux. Ils ne doivent pas être utilisés en production.

| Accès | Email | Mot de passe |
|---|---|---|
| Client | `client.demo@here.tn` | `ClientDemo2026!` |
| Admin boutique | `boutique.admin@here.tn` | `BoutiqueDemo2026!` |
| Super admin | `super.admin@here.tn` | `SuperAdminDemo2026!` |

Le compte admin boutique possède automatiquement la boutique de test `Demo Market TN`. Le visiteur n'a pas besoin de compte pour consulter la page d'accueil, le catalogue, les boutiques et les pages produit. La connexion est requise pour le panier, les commandes, les favoris et les espaces d'administration.

## Paiements

Le projet reste en mode `PAYMENT_MODE=sandbox` en développement. Les réponses simulées ne sont jamais autorisées lorsque `NODE_ENV=production`. Avant d'activer un paiement réel, configurer les identifiants marchands et les URLs de callback Konnect/Flouci (voir `server/.env.example`). Aucun paiement réel ne doit être considéré comme actif sans ces credentials et un test de webhook validé.
