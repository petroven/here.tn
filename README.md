# here.tn / BuyHere — marketplace multi-vendeurs tunisienne

Site web, application mobile et API pour une marketplace bilingue (français / arabe) : catalogue multi-boutiques, panier et commande (paiement à la livraison, Konnect, Flouci, virement), livraison par livreurs, retours, portefeuille, chat, administration.

La documentation technique complète (architecture, fichiers, API, variables, exploitation) est dans [`DOCUMENTATION.md`](DOCUMENTATION.md).

## Architecture

| Partie | Dossier | Stack | Port local |
|---|---|---|---|
| **API officielle** | `server/` | Node.js, Express, Sequelize ; SQLite en dev, PostgreSQL en production | 5000 |
| **Site web** | `client/` | React 18, Vite, Tailwind CSS | 5174 |
| **Application mobile** | `buyhere/mobile/` | Expo / React Native, TypeScript ; appelle l'API officielle | — |
| API alternative (**non utilisée**) | `buyhere/backend/` | Express 5, Prisma, PostgreSQL | 4000 |

`buyhere/backend/` n'est branchée ni au site, ni au mobile, ni au déploiement (voir [`buyhere/README.md`](buyhere/README.md)).

**Production** : un seul service Render (`render.yaml`) sert l'API et le site compilé sur **`https://buyhere-xffq.onrender.com`** (API sous `/api`), avec une base PostgreSQL. `vercel.json` permet aussi de servir le site depuis Vercel, en relayant `/api` et `/uploads` vers ce service.

## Démarrage local

Prérequis : Node.js 20 ou plus. Sous PowerShell, utiliser `npm.cmd` si `npm.ps1` est bloqué.

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run dev                    # API (5000) + site (5174)
```

Vérifier l'API : `curl http://localhost:5000/api/health` → `{"status":"ok","database":"ok",…}`.

Application mobile : `cd buyhere/mobile && npm install && npx expo start`. En développement, l'app trouve l'API sur `http://<IP-du-PC>:5000/api`.

Les variables d'environnement sont décrites dans `server/.env.example`, `client/.env.example` et `buyhere/mobile/.env.example` (valeurs de développement uniquement, aucun secret).

## Comptes de démonstration

Créés automatiquement au démarrage du serveur, **pour les tests locaux uniquement** (mots de passe publics : à remplacer en production via `DEMO_*_PASSWORD`).

| Accès | Email | Mot de passe |
|---|---|---|
| Client | `client.demo@here.tn` | `ClientDemo2026!` |
| Admin boutique | `boutique.admin@here.tn` | `BoutiqueDemo2026!` |
| Super admin | `super.admin@here.tn` | `SuperAdminDemo2026!` |
| Livreur | `livreur.demo@here.tn` | `LivreurDemo2026!` |

Le compte admin boutique possède la boutique de test `Demo Market TN`. Le catalogue, les boutiques et les pages produit sont accessibles sans compte.

## Tests et CI

| Commande | Contenu |
|---|---|
| `npm test --prefix server` | Tests d'API (`node --test`, SQLite isolée) : commandes, paiements et webhooks Konnect/Flouci/sandbox, uploads, notifications, gardes de production, observabilité |
| `npm test --prefix client` | Vitest + Testing Library : retour paiement, checkout, authentification |
| `npm run build --prefix client` | Build de production dans `client/dist` |
| `npm test --prefix buyhere/mobile` | Jest (`jest-expo`) : deep links, configuration de publication |
| `npm exec --prefix buyhere/mobile -- tsc --noEmit -p buyhere/mobile` | Typecheck mobile |
| `npm run typecheck --prefix buyhere/backend` | Typecheck de l'API alternative (après `npm run prisma:generate --prefix buyhere/backend`) |

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute ces vérifications sous Node 20, sans aucun secret. Les validations effectivement passées sont listées dans le journal de [`CLAUDE_TASKS.md`](CLAUDE_TASKS.md).

## Paiements

En développement, `PAYMENT_MODE=sandbox` active un prestataire simulé. Avec `NODE_ENV=production`, le simulateur et les confirmations de test sont toujours refusés, et `render.yaml` fixe `PAYMENT_MODE=production`. Un paiement n'est confirmé que par le **webhook signé** du prestataire, jamais par la page de retour. Sans `KONNECT_WEBHOOK_SECRET` / `FLOUCI_WEBHOOK_SECRET`, tous les webhooks sont refusés en production.

## Avant une mise en production réelle

Plusieurs configurations demandent des comptes ou des décisions et ne sont **pas** encore faites. Le détail se trouve dans `CLAUDE_TASKS.md` (tâches marquées ⏸️) et `DOCUMENTATION.md` §12 à §16 :

- identifiants et secrets de webhook Konnect et Flouci, avec un test réel ;
- SMTP pour les emails, fournisseur SMS si requis ;
- base PostgreSQL payante avec sauvegardes (la base gratuite Render n'en a pas) ;
- projet EAS, FCM/APNs et signature pour publier l'app mobile ;
- décisions en attente : renforcement de l'authentification web, reprise de la cascade livreurs, migrations versionnées.
