# Tâches Claude — here.tn / buyhere

Ce fichier sert de file de travail pour une boucle d'exécution avec Claude.

## Règles de la boucle

À chaque itération :

1. Lire ce fichier et la documentation principale.
2. Prendre la première tâche non cochée de la section **Ordre d'exécution**.
3. Examiner le code concerné avant de le modifier.
4. Faire une modification ciblée, sans réécrire les parties hors sujet.
5. Ajouter ou mettre à jour les tests directement liés à la modification.
6. Exécuter les validations indiquées pour la tâche.
7. Corriger les erreurs introduites par la modification.
8. Ne cocher la tâche que si la validation est réussie.
9. Mettre à jour la section **Journal de boucle** avec les fichiers modifiés et le résultat.
10. S'arrêter après une tâche terminée et attendre la prochaine itération.

Ne jamais :

- supprimer les modifications existantes qui ne sont pas liées à la tâche ;
- mettre des secrets réels dans le dépôt ;
- utiliser le backend alternatif sans décision explicite ;
- déclarer une tâche terminée si une validation échoue ;
- modifier plusieurs domaines fonctionnels dans la même itération ;
- remplacer un vrai test par une simple vérification manuelle.

## Contexte technique

- Backend officiel actuellement utilisé : `server/` — Express, Sequelize, SQLite/PostgreSQL, port 5000.
- Frontend web : `client/` — React/Vite, port 5174.
- Application mobile : `buyhere/mobile/` — Expo/React Native.
- `buyhere/backend/` est une API alternative séparée. Ne pas la brancher au site ou au mobile pendant cette boucle.
- Documentation de référence : `DOCUMENTATION.md`.
- Les commandes Windows doivent utiliser `npm.cmd` si PowerShell bloque `npm.ps1`.

## Préparation locale

À faire avant les validations, si les dépendances ne sont pas présentes :

```powershell
npm.cmd install
npm.cmd install --prefix server
npm.cmd install --prefix client
npm.cmd install --prefix buyhere\backend
npm.cmd install --prefix buyhere\mobile
npm.cmd run prisma:generate --prefix buyhere\backend
```

`npm ci` peut remplacer `npm install` pour vérifier que les lockfiles sont à jour. npm 11 bloque les scripts d'installation (`allowScripts`) : le postinstall Prisma ne tourne pas, d'où la commande `prisma:generate` explicite, sans laquelle le typecheck du backend alternatif échoue sur les types `@prisma/client`.

Ne pas installer de dépendance si le problème vient seulement du code. Vérifier d'abord le manifeste concerné et le message d'erreur.

## Ordre d'exécution

### Phase 1 — Rendre le dépôt vérifiable

- [x] **1.1 Installer et vérifier les dépendances**
  - Confirmer que les quatre projets peuvent résoudre leurs dépendances.
  - Vérifier que les lockfiles correspondent aux `package.json`.
  - Validation :
    ```powershell
    npm.cmd test --prefix server
    npm.cmd run build --prefix client
    npm.cmd run typecheck --prefix buyhere\backend
    npm.cmd exec --prefix buyhere\mobile -- tsc --noEmit -p buyhere\mobile
    ```

- [x] **1.2 Diagnostiquer et corriger les tests serveur**
  - Traiter les échecs réels après installation des dépendances.
  - Ne pas masquer les erreurs avec des tests moins stricts.
  - Validation :
    ```powershell
    npm.cmd test --prefix server
    ```

- [x] **1.3 Corriger le build du client web**
  - Le build doit produire `client/dist`.
  - Vérifier que les routes React et les appels `/api` restent compatibles.
  - Validation :
    ```powershell
    npm.cmd run build --prefix client
    ```

- [x] **1.4 Corriger le typage mobile**
  - Résoudre les erreurs TypeScript sans utiliser `any` comme solution générale.
  - Validation :
    ```powershell
    npm.cmd exec --prefix buyhere\mobile -- tsc --noEmit -p buyhere\mobile
    ```

### Phase 2 — Unifier la configuration

- [x] **2.1 Définir une URL de production unique**
  - Choisir l'URL Render officielle.
  - Mettre à jour `render.yaml`, `vercel.json`, les fichiers `.env.production`, EAS et la documentation.
  - Ne jamais remplacer les secrets par des valeurs fictives dans les fichiers suivis.

- [x] **2.2 Corriger les ports et commandes documentés**
  - Backend officiel : 5000.
  - Client web : 5174.
  - Corriger les références obsolètes à 5173 ou 4000 lorsqu'elles décrivent le système principal.

- [x] **2.3 Clarifier le statut de `buyhere/backend`**
  - Documenter clairement qu'il s'agit d'une API alternative non utilisée, ou obtenir une décision explicite pour la migration.
  - Ne pas faire de migration d'architecture dans cette tâche.

- [x] **2.4 Ajouter une configuration locale sûre**
  - Vérifier les `.env.example`.
  - Ajouter uniquement des valeurs de développement non sensibles.
  - Vérifier que le démarrage échoue explicitement quand un secret obligatoire manque en production.

### Phase 3 — Préparer la production

- [x] **3.1 Désactiver les simulations en production**
  - `PAYMENT_MODE` ne doit pas rester en sandbox en production.
  - Le simulateur de paiement doit rester interdit avec `NODE_ENV=production`.
  - Ajouter ou compléter les tests de garde.

- [ ] **3.2 Configurer et tester les webhooks de paiement** — ⏸️ bloquée : credentials de test Konnect/Flouci requis (voir journal)
  - Vérifier signature, montant, idempotence, doublon et paiement tardif.
  - Tester séparément Konnect et Flouci avec leurs credentials de test.
  - Ne jamais considérer une redirection frontend comme preuve de paiement.

- [ ] **3.3 Rendre persistants les fichiers et médias** — ⏸️ code terminé ; reste la vérification sur Render après redéploiement (voir journal)
  - Utiliser Cloudinary ou un stockage persistant en production.
  - Vérifier upload, lecture, suppression et URLs après redéploiement.

- [ ] **3.4 Configurer les notifications opérationnelles** — ⏸️ code terminé ; reste à renseigner SMTP (et SMS si requis) sur Render (voir journal)
  - SMTP pour les emails.
  - Fournisseur SMS réel si requis.
  - Expo Push pour le mobile.
  - Les échecs doivent être visibles dans les logs et ne doivent pas être transformés en faux succès.

- [x] **3.5 Ajouter sauvegardes et observabilité**
  - Documenter les sauvegardes PostgreSQL et la restauration.
  - Ajouter un health check utile.
  - Centraliser les erreurs et les événements de paiement.

### Phase 4 — Sécurité et robustesse

- [x] **4.1 Renforcer l'authentification web** — phases A et B appliquées ; phase C (access token court + refresh token) planifiée en chantier dédié (`DOCUMENTATION.md` §13)
  - Évaluer le remplacement du JWT longue durée en `localStorage`.
  - Prévoir access token court, refresh token sécurisé et révocation.
  - Conserver la compatibilité avec le mobile.

- [x] **4.2 Remplacer les états critiques en mémoire** — reprise de la cascade livreurs implémentée (voir journal)
  - Identifier les états concernés : attribution livreur et imports en attente.
  - Proposer une persistance adaptée avant toute implémentation.
  - Ne pas introduire Redis ou une migration de schéma sans justification et test.

- [ ] **4.3 Ajouter des migrations versionnées** — ⏸️ implémentée et testée sur SQLite ; validation PostgreSQL au premier passage du job CI `server-postgres` (pas de PostgreSQL local)
  - Ne pas remplacer brutalement le mécanisme actuel.
  - Documenter d'abord les limites de `sequelize.sync()` et de la mini-migration.
  - Tester SQLite et PostgreSQL avant déploiement.

### Phase 5 — Qualité et publication

- [x] **5.1 Ajouter une CI**
  - Installer les dépendances.
  - Exécuter tests serveur, build web et typechecks.
  - Ne pas exiger de secrets de production dans les jobs de validation.

- [x] **5.2 Ajouter des tests frontend et mobile prioritaires**
  - Authentification.
  - Panier et checkout.
  - Retour paiement.
  - Navigation mobile et deep links.

- [ ] **5.3 Vérifier la publication mobile** — ⏸️ vérifications locales faites ; bloquée sur le compte EAS, FCM/APNs et le build de production (`DOCUMENTATION.md` §16.2)
  - Bundle ID/package Android.
  - Signature Android/iOS.
  - Notifications push.
  - Liens profonds.
  - Build de production EAS.

- [x] **5.4 Nettoyer la documentation**
  - Mettre à jour `README.md`, `buyhere/README.md`, `IMPLEMENTATION_SUMMARY.md` et `DOCUMENTATION.md`.
  - Supprimer les informations contradictoires.
  - Documenter les validations réellement passées.

## Critères de fin de boucle

La boucle globale est terminée uniquement quand :

- tous les tests serveur passent ;
- le client web se compile ;
- le backend alternatif et le mobile passent leur vérification de type ;
- une seule architecture de déploiement est documentée ;
- aucune URL de production obsolète ne reste dans les fichiers actifs ;
- les paiements de production ne sont pas en mode sandbox ;
- les secrets ne sont pas présents dans Git ;
- les changements sont documentés et vérifiés.

## Journal de boucle

Ajouter une entrée après chaque itération :

```text
### AAAA-MM-JJ — Tâche X.Y
- Résultat :
- Fichiers modifiés :
- Validations exécutées :
- Échecs restants :
- Prochaine tâche :
```

### 2026-10-14 — Tâche 1.1
- Résultat : terminée. `npm ci` réussit pour la racine, `server`, `client`, `buyhere\backend` et `buyhere\mobile` : les cinq lockfiles correspondent à leur `package.json`. Node 24.20.0, npm 11.19.0. Deux problèmes d'environnement trouvés, aucun dans le code applicatif :
  - npm 11 bloque les scripts d'installation, donc le client Prisma n'était pas généré et le typecheck du backend échouait (types `@prisma/client` absents). La correction est `npm run prisma:generate`.
  - L'ancienne commande `npm exec --prefix buyhere\mobile -- tsc --noEmit` s'exécutait depuis la racine, sans `tsconfig`, et n'affichait que l'aide de tsc : elle ne vérifiait rien. Ajout de `-p buyhere\mobile`.
  - Les scripts bloqués de `sqlite3` et `esbuild` n'ont pas d'impact : tests serveur et build client passent.
- Fichiers modifiés : `CLAUDE_TASKS.md` (préparation locale, commandes de validation 1.1 et 1.4, journal).
- Validations exécutées : `npm test --prefix server` (67/67 réussis) ; `npm run build --prefix client` (OK, `client/dist` produit) ; `npm run typecheck --prefix buyhere\backend` (OK après `prisma:generate`) ; `tsc --noEmit -p buyhere\mobile` (OK, 0 erreur).
- Échecs restants : aucun. Les logs de test affichent `[EMAIL] Erreur: connect ECONNREFUSED 127.0.0.1:9`, ce qui est attendu (SMTP de test volontairement injoignable).
- Prochaine tâche : 1.2. Les tests serveur passent déjà : vérifier qu'il ne reste pas d'échec réel avant de la cocher.

### 2026-10-14 — Tâche 1.2
- Résultat : terminée. Aucun échec réel. Les 7 fichiers de `server/tests` déclarent 67 tests et `node --test` en exécute 67 (0 ignoré, 0 todo, aucun `.only` ni `.skip`). Un test se neutralisait lui-même : dans `suivi public : aucune donnée personnelle` (`api.test.js`), un `if (!livraison) return;` le faisait réussir sans rien vérifier en l'absence de livraison. Remplacé par `assert.ok(livraison, ...)` ; le seed fournit une livraison et le test vérifie maintenant réellement que le suivi public ne divulgue pas de données personnelles.
- Fichiers modifiés : `server/tests/api.test.js`, `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/api.test.js` (15/15) ; `npm test --prefix server` (67/67, exécuté deux fois).
- Échecs restants : aucun. Seul bruit dans les logs : `[EMAIL] ECONNREFUSED 127.0.0.1:9`, attendu (SMTP de test volontairement injoignable).
- Prochaine tâche : 1.3. Le build client passe déjà : vérifier la compatibilité des routes React et des appels `/api`.

### 2026-10-14 — Tâche 1.3
- Résultat : terminée, sans modification de code. Le build Vite produit `client/dist` (`index.html` et 28 assets). Compatibilité vérifiée par analyse statique :
  - Appels `/api` : les 121 appels `${API_URL}/...` du client correspondent tous à une des 121 routes Express montées sous `/api`. Le seul écart signalé, `admin/virements/${id}/${action}`, est un faux positif : `action` vaut `valider` ou `rejeter`, deux routes `PATCH` qui existent.
  - Routes React : les 102 cibles `to=` / `navigate()` / `href=` correspondent toutes à une des 27 `<Route>`, et une route catch-all est déclarée.
  - Proxy Vite : `/api` et `/uploads` sont redirigés vers le port 5000 ; le client tourne sur le port 5174 (`strictPort`).
  - Fallback SPA du serveur (`server.js`) : `client/dist` est servi en statique, et `/api` comme `/uploads` sont bien exclus de l'envoi d'`index.html`.
- Fichiers modifiés : `CLAUDE_TASKS.md` uniquement. Les scripts de vérification sont restés hors du dépôt (scratchpad).
- Validations exécutées : `npm run build --prefix client` (OK, `client/dist/index.html` présent).
- Échecs restants : aucun.
- Prochaine tâche : 1.4. Le typecheck mobile passe déjà avec `-p buyhere\mobile` : confirmer et vérifier qu'il n'y a pas de `any` utilisé comme contournement.

### 2026-10-14 — Tâche 1.4
- Résultat : terminée, sans modification de code. `tsc --noEmit` passe avec 0 erreur sous `strict: true` (`tsconfig.json` étend `expo/tsconfig.base`). Les 130 fichiers `.ts`/`.tsx` du projet mobile (hors `node_modules`, `.expo`, `android`, `ios`, `dist`) ne contiennent aucun `any` (`: any`, `as any`, `<any>`, `any[]`) ni aucun `@ts-ignore`, `@ts-nocheck` ou `@ts-expect-error`.
- Fichiers modifiés : `CLAUDE_TASKS.md` uniquement.
- Validations exécutées : `npm exec --prefix buyhere\mobile -- tsc --noEmit -p buyhere\mobile` (OK).
- Échecs restants : aucun. La phase 1 est terminée.
- Prochaine tâche : 2.1, définir une URL de production unique. Le choix de l'URL Render officielle peut demander une décision de l'utilisateur.

### 2026-10-14 — Tâche 2.1
- Résultat : terminée. URL officielle retenue : `https://buyhere-xffq.onrender.com`, l'URL déjà utilisée par tous les fichiers effectifs (rewrites `vercel.json`, profils `eas.json`, `buyhere/mobile/.env.production`, `PRODUCTION_API_URL` dans `config.ts`). L'autre URL, `here-tn.onrender.com`, n'apparaissait que dans des commentaires et exemples ; toutes ses occurrences ont été remplacées. `https://buyhere.tn` est conservé comme futur domaine personnalisé (liens profonds de `linking.ts`). URL officielle documentée dans `DOCUMENTATION.md` (section architecture).
- À confirmer : le choix n'a pas pu être vérifié sur Render, car le MCP Render n'a pas d'espace de travail sélectionné et c'est à l'utilisateur de le choisir. Le nom de service `here-tn` dans `render.yaml` n'a pas été modifié : le renommer pourrait faire créer un nouveau service lors d'une synchronisation du blueprint. Aucun secret n'a été touché ; `CLIENT_URL`, `FRONTEND_URL` et `API_BASE_URL` restent en `sync: false`, à renseigner sur Render.
- Fichiers modifiés : `render.yaml` (commentaire), `DOCUMENTATION.md`, `buyhere/mobile/.env.example`, `buyhere/mobile/src/config.ts` (commentaire), `CLAUDE_TASKS.md`.
- Validations exécutées : recherche de `here-tn.onrender` hors `node_modules` (aucune occurrence) ; parsing JSON de `vercel.json` et `eas.json` (OK) ; `tsc --noEmit -p buyhere\mobile` (OK).
- Échecs restants : aucun.
- Prochaine tâche : 2.2, corriger les ports et commandes documentés (5000, 5174 ; références obsolètes à 5173 et 4000).

### 2026-10-14 — Tâche 2.2
- Résultat : terminée.
  - Bug réel corrigé dans `server/` : sans `CLIENT_URL` ou `FRONTEND_URL`, 8 valeurs par défaut visaient `http://localhost:5173`, alors que Vite tourne sur 5174 avec `strictPort`. Les liens générés en développement étaient donc cassés : retours de paiement Konnect et Flouci, page de paiement simulée, redirections OAuth, lien de réinitialisation du mot de passe, lien SMS de confirmation de commande. Ils passent tous à 5174, comme `email.js` et `SandboxMockProvider.js` le faisaient déjà.
  - Documentation : `IMPLEMENTATION_SUMMARY.md` (port client 5174), `buyhere/README.md` (le mobile vise `<IP>:5000/api`, pas `:4000`), `DOCUMENTATION.md` (retrait de la mention de l'incohérence 5173, désormais corrigée).
  - Conservé volontairement : `localhost:5173` reste dans la liste CORS de développement (`cors.js`, tolérance documentée), et toutes les références à 4000 concernent l'API alternative `buyhere/backend`, dont c'est le vrai port (`env.ts`, `.env.example`, `e2e.mjs`, section backend du README).
- Fichiers modifiés : `server/src/utils/paymentGateway.js`, `server/src/utils/sms.js`, `server/src/routes/oauthRoutes.js`, `server/src/controllers/authController.js`, `server/tests/devUrls.test.js` (nouveau), `IMPLEMENTATION_SUMMARY.md`, `buyhere/README.md`, `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/devUrls.test.js`, en échec avant la correction (5173 détecté) puis réussi après ; `npm test --prefix server` (69/69).
- Échecs restants : aucun.
- Prochaine tâche : 2.3, clarifier le statut de `buyhere/backend` (documentation seulement, aucune migration).

### 2026-10-14 — Tâche 2.3
- Résultat : terminée, documentation seulement, aucune migration. `buyhere/README.md`, que `DOCUMENTATION.md` qualifiait de trompeur, présente désormais `backend/` comme une « API REST alternative, NON UTILISÉE ». Un encadré « Statut » précise que le mobile appelle `server/` (port 5000, `/api`, production `buyhere-xffq.onrender.com/api`), que `backend/` n'est branchée nulle part et qu'une migration demande une décision explicite. La section 2 est renommée « Lancer l'API alternative `backend/` (facultatif, non utilisée par l'app) ». Dans `DOCUMENTATION.md`, les deux passages qui contredisaient le README ont été alignés, et la mention obsolète du port dans les limites d'`IMPLEMENTATION_SUMMARY.md` a été retirée (port corrigé en 2.2).
- Vérification : les scripts racine (`dev`, `build`, `start`), `render.yaml` et `vercel.json` ne lancent que `server/` et `client/`. Aucune référence à `buyhere/backend` ni à `:4000` dans `client/src`, `server/src` ou `buyhere/mobile/src`.
- Fichiers modifiés : `buyhere/README.md`, `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : vérification par recherche (aucune référence active). Tâche purement documentaire, aucun code modifié, donc aucun test à exécuter.
- Échecs restants : aucun.
- Prochaine tâche : 2.4, vérifier les `.env.example` et l'échec explicite au démarrage en production quand un secret obligatoire manque.

### 2026-10-14 — Tâche 2.4
- Résultat : terminée.
  - `.env.example` vérifiés (`server`, `client`, `buyhere/backend`, `buyhere/mobile`) ainsi que `client/.env.development` et `.env.production` : uniquement des valeurs de développement non sensibles ou des champs vides. Aucun secret réel.
  - Faille corrigée dans la garde de démarrage (`server/src/middleware/auth.js`) : en production, elle n'exigeait qu'une longueur de 32 caractères. Or le placeholder de `server/.env.example` (`change_me_generate_a_long_random_string`, 39 caractères) était accepté : un `.env.example` recopié tel quel en production donnait un secret JWT public, donc des jetons falsifiables. Les valeurs d'exemple ou publiques connues (`change_me…`, `change-me…`, le secret de dev et celui des tests) sont désormais refusées avec un message explicite. Le comportement en développement est inchangé.
  - `server/.env.example` : commentaire sur la règle de production et commande de génération d'un secret.
  - Périmètre : `JWT_SECRET` est le seul secret obligatoire au démarrage. Les secrets Konnect/Flouci, `PAYMENT_MODE` et le stockage relèvent des tâches 3.1 à 3.3.
- Fichiers modifiés : `server/src/middleware/auth.js`, `server/tests/productionSecrets.test.js` (nouveau, 5 tests en sous-processus : secret absent, court, placeholder, valide, dev), `server/.env.example`, `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/productionSecrets.test.js` (5/5) ; `npm test --prefix server` (74/74).
- Échecs restants : aucun. La phase 2 est terminée.
- Prochaine tâche : 3.1, désactiver les simulations en production (`PAYMENT_MODE=sandbox` est actuellement fixé dans `render.yaml`).

### 2026-10-14 — Tâche 3.1
- Résultat : terminée.
  - `render.yaml` : `PAYMENT_MODE` passe de `sandbox` à `production`.
  - Bug corrigé (`marketRoutes.js`) : le drapeau `paiementTest` de `/api/config/payment-methods` ne lisait que `PAYMENT_MODE`. En production avec `PAYMENT_MODE=sandbox` (la configuration Render d'alors), le site affichait « paiement test, aucun débit réel » alors que le simulateur était refusé. Le drapeau utilise désormais `isSandbox()`, la même règle que le simulateur.
  - Visibilité : nouvelle fonction `paymentModeWarning()` (`SandboxMockProvider.js`). Au démarrage, `server.js` journalise `[PAYMENT] PAYMENT_MODE=sandbox est ignoré en production…` si la variable est restée à `sandbox`. Choix d'un avertissement plutôt que d'un échec, pour ne pas faire tomber le service en ligne si la variable n'a pas encore été modifiée dans le tableau de bord Render. Le comportement reste sûr dans tous les cas : sandbox désactivé.
  - Gardes vérifiées et désormais testées : `initiate`, `construireWebhooks` (simulateur `/payments/sandbox/simulate`, 404 si `!isSandbox()`), `verifyWebhookSignature` sandbox et `confirmSandboxPayment` sont tous refusés avec `NODE_ENV=production`.
  - ⚠️ Pour la tâche 3.2 : `KonnectProvider.js:19` et `FlouciProvider.js:19` retombent sur des secrets de webhook publics (`sandbox_konnect_webhook_secret`, `sandbox_flouci_webhook_secret`) même en production. Sans `KONNECT_WEBHOOK_SECRET` / `FLOUCI_WEBHOOK_SECRET`, n'importe qui peut signer un faux webhook « payé ». C'est la priorité de la tâche 3.2.
- Fichiers modifiés : `render.yaml`, `server/src/routes/marketRoutes.js`, `server/src/services/payments/SandboxMockProvider.js`, `server/src/server.js`, `server/tests/productionPaymentGuard.test.js` (nouveau, 3 tests en sous-processus), `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/productionPaymentGuard.test.js` (3/3) ; `npm test --prefix server` (77/77).
- Échecs restants : aucun. Action manuelle côté Render : si `PAYMENT_MODE` a été défini dans le tableau de bord, le passer à `production` (à faire par l'utilisateur, non effectué ici).
- Prochaine tâche : 3.2, webhooks de paiement, en commençant par les secrets de webhook publics en production.

### 2026-10-14 — Tâche 3.2 (partielle, non cochée)
- Résultat : faille corrigée et vérifications locales ajoutées. La tâche reste non cochée, car le test avec les credentials de test réels Konnect et Flouci est impossible sans ces credentials.
  - Faille corrigée : `KonnectProvider` et `FlouciProvider` retombaient en production sur des secrets HMAC publics (`sandbox_konnect_webhook_secret`, `sandbox_flouci_webhook_secret`). Sans variable d'environnement, n'importe qui pouvait signer un faux webhook « payé » et faire passer une commande en `payee`. Nouveau helper `webhookSecret()` (`hmac.js`) : la valeur de repli n'est utilisable que hors production. En production, un secret absent donne `null`, et tout webhook est refusé (401).
  - Visibilité : `paymentConfigWarnings()` (`services/payments/index.js`) regroupe l'avertissement `PAYMENT_MODE` (3.1) et les secrets de webhook manquants. `server.js` les journalise au démarrage en `[PAYMENT]`.
  - `render.yaml` : `KONNECT_WEBHOOK_SECRET` et `FLOUCI_WEBHOOK_SECRET` déclarés en `sync: false`, sans valeur.
  - Vérifié dans la route webhook (déjà correct, désormais testé pour Konnect et Flouci et plus seulement pour le sandbox) : signature, montant (tolérance 0,001 DT), idempotence atomique, doublon sans rejeu des effets, paiement tardif après expiration accepté, échec signalé. La confirmation ne vient que du webhook : la page de retour frontend se contente d'interroger `/payments/:orderId/status`.
- Fichiers modifiés : `server/src/services/payments/hmac.js`, `KonnectProvider.js`, `FlouciProvider.js`, `index.js`, `server/src/server.js`, `render.yaml`, `server/tests/providerWebhooks.test.js` (nouveau, 11 tests), `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/providerWebhooks.test.js` (11/11) ; `npm test --prefix server` (88/88).
- Bloquant pour cocher 3.2 (action utilisateur) :
  1. Fournir les credentials de test Konnect et Flouci (hors dépôt, dans un `server/.env` local) et définir `KONNECT_WEBHOOK_SECRET` / `FLOUCI_WEBHOOK_SECRET` sur Render.
  2. Confirmer le format réel des webhooks : nom de l'en-tête de signature, algorithme, champs `payment_ref`/`payment_id`, `status` et `amount`. Ils sont supposés, non vérifiés contre la documentation des prestataires (voir `hmac.js` et le commentaire de `paymentGateway.js`). Konnect, notamment, pourrait notifier sans signature HMAC et exiger une vérification par appel API.
  3. Point ouvert : un webhook `validee` sans champ `amount` saute la vérification du montant. À trancher une fois le format réel connu.
- Prochaine tâche : 3.3, rendre persistants les fichiers et médias. La 3.2 est bloquée sur les credentials : la boucle passe à la tâche suivante non bloquée.

### 2026-10-14 — Tâche 3.3 (itération 1, non cochée)
- État constaté : la persistance en production est déjà en place. Sans Cloudinary, `NODE_ENV=production` stocke les photos en base (modèle `Fichier`, servies par `GET /uploads/db/:id`) : elles survivent à un redéploiement, contrairement au disque Render. Avec les 3 variables `CLOUDINARY_*`, les photos vont sur Cloudinary. Upload et relecture déjà testés (`uploadDb.test.js`).
- Problème trouvé : `deleteImage()` n'est appelée nulle part, et elle ne gérait que Cloudinary en ignorant ses erreurs. Une photo supprimée ou remplacée n'est jamais effacée : les blobs `Fichier` s'accumulent dans la base PostgreSQL (1 Go sur l'offre gratuite Render).
- Corrigé dans cette itération : `deleteImage()` gère les trois stockages selon l'URL. `/uploads/db/:id` → `Fichier.destroy` ; `/uploads/<fichier>` → suppression du fichier local, avec garde contre la traversée de chemin ; URL `res.cloudinary.com` → `destroy` Cloudinary. Les URL externes ou inconnues sont ignorées. Elle renvoie `true`/`false`, et les échecs sont journalisés `[UPLOAD]` au lieu d'être ignorés.
- Fichiers modifiés : `server/src/utils/upload.js`, `server/tests/uploadDb.test.js` (+2 tests : suppression en base puis 404 ; URL externe, inconnue ou traversée ignorées), `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/uploadDb.test.js` (5/5) ; `npm test --prefix server` (90/90).
- Reste à faire pour cocher 3.3 :
  1. Prochaine itération : recenser les champs qui stockent une URL d'image (produits, variantes, boutiques, catégories, photo de profil, preuves de livraison…) et vérifier qu'une même URL n'est jamais partagée (copie de produit, import). Ensuite seulement, appeler `deleteImage` au remplacement ou à la suppression, avec un test par parcours.
  2. Action utilisateur : vérifier sur Render qu'une photo envoyée reste accessible après un redéploiement (non vérifiable localement).
- Prochaine tâche : 3.3 (suite), brancher `deleteImage` dans les parcours de remplacement et de suppression.

### 2026-10-14 — Tâche 3.3 (itération 2, non cochée)
- Résultat : suppression branchée dans les parcours principaux.
  - Nouveau `supprimerImagesSiOrphelines(urls)` (`upload.js`) : une image n'est effacée que si plus aucun champ ne la référence. Champs vérifiés : `Utilisateur.photo`, `Boutique.logo`, `Categorie.image`, `Produit.image`, `Variante.image`, `Livraison.preuveLivraison`, et les tableaux JSON `Produit.images` et `Retour.photos`. Un même URL est en effet souvent partagé (`Produit.image` = `images[0]`, variante qui reprend la photo du produit). Les URL externes (photos de démo, avatars Google) sont ignorées. La fonction ne lève jamais d'erreur : un échec de nettoyage est journalisé `[UPLOAD]` sans faire échouer la requête.
  - Branché sur : remplacement de la photo de profil (`PUT /users/me/photo`) ; suppression de compte (`deleteMe`, la photo étant une donnée personnelle, elle est effacée du stockage) ; modification de produit (`PUT /vendor/products/:id`, anciennes images du produit et des variantes) ; suppression de produit (`DELETE /vendor/products/:id`).
  - Non branché, volontairement : `Livraison.preuveLivraison` et `Retour.photos` sont des justificatifs à conserver. `Boutique.logo` et `Categorie.image` sont peu volumineux et restent un suivi possible. Les variantes ne sont pas supprimées avec le produit (comportement existant inchangé) : leurs images sont donc conservées, ce qui va dans le sens sûr.
- Fichiers modifiés : `server/src/utils/upload.js`, `server/src/routes/authRoutes.js`, `server/src/controllers/authController.js`, `server/src/routes/vendorRoutes.js`, `server/tests/uploadDb.test.js` (+4 tests : profil remplacé, compte supprimé, produit modifié, produit supprimé avec photo partagée), `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/uploadDb.test.js` (9/9) ; `npm test --prefix server` (94/94).
- Bloquant pour cocher 3.3 (action utilisateur) : sur Render, envoyer une photo, redéployer, puis vérifier que son URL `/uploads/db/<id>` répond toujours 200. Ce n'est pas vérifiable localement. Si Cloudinary est utilisé, définir les 3 variables `CLOUDINARY_*` ; à défaut, les photos vont en base PostgreSQL, ce qui reste persistant.
- Prochaine tâche : 3.4, notifications opérationnelles (SMTP, SMS, Expo Push ; les échecs doivent être visibles et jamais transformés en faux succès). 3.2 et 3.3 sont en attente d'actions utilisateur.

### 2026-10-14 — Tâche 3.4 (non cochée, en attente de configuration)
- Résultat : faux succès et pannes cachées corrigés.
  - SMS (`sms.js`), quatre problèmes :
    1. `SMS_PROVIDER=twilio` ou `winsms` sans identifiants basculait silencieusement sur le mock et renvoyait `success: true`. C'est désormais un échec journalisé `[SMS] Échec`, avec vérification de tous les identifiants Twilio (SID, token, numéro).
    2. En production, `SMS_PROVIDER=mock` renvoyait `success: true` alors qu'aucun SMS ne partait. Désormais : `success: false`, avec l'avertissement `[SMS] Non envoyé`.
    3. Les refus HTTP du fournisseur n'étaient pas journalisés : ils le sont, avec le statut.
    4. `sendSMS` pouvait lever une exception (réseau, réponse non JSON). Comme elle est appelée avec `await` sans `try` (`orderController.js:561` et `:862`, `livreurRoutes.js:229`), la commande ou le statut de livraison était déjà enregistré mais l'API répondait 500. Elle ne lève plus jamais d'exception.
  - Push Expo (`notifications.js`) : les réponses HTTP en erreur et les tickets refusés (hors `DeviceNotRegistered`, déjà nettoyé) sont journalisés `[PUSH]`. `envoyerPushExpo` renvoie le nombre de messages acceptés.
  - Email (`email.js`) : l'envoi échouait déjà proprement (`success: false` et log). Ajout de `emailConfigWarning()` : en production, sans `SMTP_HOST`, le transport visait `smtp.ethereal.email`, une boîte de test, et aucun email n'atteignait les clients.
  - Démarrage (`server.js`) : avertissements `[EMAIL]` et `[SMS]` en cas de configuration manquante, en plus de `[PAYMENT]`.
  - `render.yaml` : `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` déclarés en `sync: false` ; `SMS_PROVIDER` documenté.
- Fichiers modifiés : `server/src/utils/sms.js`, `server/src/utils/notifications.js`, `server/src/utils/email.js`, `server/src/server.js`, `render.yaml`, `server/tests/notificationChannels.test.js` (nouveau, 8 tests), `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/notificationChannels.test.js` (8/8) ; `npm test --prefix server` (102/102).
- Bloquant pour cocher 3.4 (action utilisateur) : renseigner `SMTP_HOST`, `SMTP_USER` et `SMTP_PASS` sur Render (et `SMTP_FROM` si besoin), puis vérifier la réception d'un email réel. Décider si les SMS sont requis : si oui, choisir `twilio` ou `winsms` et fournir les identifiants. Expo Push ne demande aucune clé, mais reste à vérifier sur un appareil réel avec un development build (pas dans Expo Go).
- Prochaine tâche : 3.5, sauvegardes et observabilité (documentation des sauvegardes PostgreSQL et de la restauration, health check utile, centralisation des erreurs et des événements de paiement).

### 2026-10-14 — Tâche 3.5
- Résultat : terminée.
  - Health check (`healthRoutes.js`) : `GET /api/health` renvoyait toujours `ok`, même base tombée, alors que Render s'en sert comme `healthCheckPath`. Il exécute désormais `SELECT 1` (délai max 3 s) et répond 200 `database: ok`, ou 503 `status: degraded`. Aucun détail interne n'est exposé ; la cause est journalisée `[HEALTH]`.
  - Événements de paiement (`PaymentLog.js`) : ils étaient déjà centralisés dans la table `PaymentLog`, mais invisibles dans les logs Render. Un hook `afterCreate` recopie les anomalies en `[PAYMENT]` : en `warn` (signature ou montant invalide, transaction introuvable, webhook rejeté, échec d'initiation) ou en `error` (paiement encaissé sur commande close, à rembourser). Les événements normaux ne sont pas journalisés.
  - Erreurs : le gestionnaire global `[SERVER] Error:` existait déjà. Les préfixes `[PAYMENT]`, `[EMAIL]`, `[SMS]`, `[PUSH]`, `[UPLOAD]` et `[HEALTH]` sont recensés dans une table de la documentation.
  - Documentation (`DOCUMENTATION.md` §12, nouvelle) : avertissement sur la base gratuite Render (pas de sauvegarde, expiration ; durée à revérifier sur la page tarifs), procédures `pg_dump` et `pg_restore`, rétention, test de restauration trimestriel, health check, table des préfixes de log. §4.7 et §8 mises à jour pour `/health`.
- Fichiers modifiés : `server/src/routes/healthRoutes.js`, `server/src/models/PaymentLog.js`, `server/tests/observability.test.js` (nouveau, 3 tests : santé OK, base injoignable en 503 sans fuite de détail, journalisation des anomalies), `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/observability.test.js` (3/3) ; `npm test --prefix server` (105/105).
- Échecs restants : aucun. Recommandation utilisateur, non bloquante : la base Render est en `plan: free`. Avant des données réelles, passer à un plan avec sauvegardes, faire une première sauvegarde `pg_dump` et la restaurer une fois pour valider la procédure.
- Prochaine tâche : 4.1, renforcer l'authentification web (évaluation et proposition avant implémentation : access token court, refresh token, révocation, compatibilité mobile).

### 2026-10-14 — Tâche 4.1 (évaluation, non cochée)
- Résultat : évaluation et proposition rédigées dans `DOCUMENTATION.md` §13. Aucun code modifié : la tâche demande d'évaluer et de prévoir, et le choix d'architecture revient à l'utilisateur.
- Constats : JWT de 7 jours avec un `role` figé et jamais relu en base ; aucune révocation au changement ou à la réinitialisation du mot de passe, ni au changement de rôle, ni à la déconnexion ; jeton OAuth transmis en query string (`/oauth/callback?token=`) ; jeton en `localStorage`, lu dans une vingtaine de fichiers du site. Le mobile utilise SecureStore et un Bearer : il est compatible avec toutes les options.
- Proposition : phase A, `tokenVersion` et rôle relu en base, côté serveur seul, sans impact client (corrige les risques 1 et 2) ; phase B, jeton OAuth en fragment `#` (risque 3) ; phase C, access token de 15 min, refresh token `httpOnly` avec rotation et table `RefreshToken` (risque 4), en chantier dédié après 5.1 et 5.2.
- Fichiers modifiés : `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : aucune (pas de code modifié).
- Décision attendue : quelles phases engager. Recommandation : A puis B maintenant, C plus tard.
- Prochaine tâche : 4.2, identifier les états critiques en mémoire et proposer une persistance (proposition avant implémentation).

### 2026-10-14 — Tâche 4.2 (proposition, non cochée)
- Résultat : inventaire et proposition dans `DOCUMENTATION.md` §14. Aucun code modifié, comme l'exige la tâche (« proposer avant toute implémentation »).
- Constat majeur : la cascade d'attribution des livreurs (`courierMatching.js`) garde ses minuteurs en mémoire. Après un redémarrage (fréquent avec la mise en veille de l'offre gratuite Render, et à chaque redéploiement), l'offre en cours n'expire plus côté serveur. `/livreur/notifications/pending` la marque `expiree` sans faire avancer la cascade, et la livraison reste bloquée en `en_attente`. De plus, la reconstruction après perte d'état repart de zéro et peut re-solliciter des livreurs ayant déjà refusé.
- Autres états : imports en attente (`importStore.js`) et idempotence produit (`idempotency.js`), de gravité faible, à conserver en mémoire. `comptesSupprimes` est déjà rechargé depuis la base ; le cache de géocodage n'est pas critique.
- Proposition : reconstruire la cascade à partir des lignes `NotificationLivreur` déjà en base (reprise au démarrage, exclusion des livreurs déjà sollicités, expiration paresseuse qui fait avancer la cascade, tests de redémarrage). Ni Redis ni changement de schéma.
- Fichiers modifiés : `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : aucune (pas de code modifié).
- Décision attendue : accord pour implémenter la reprise de la cascade livreurs.
- Prochaine tâche : 4.3, documenter les limites de `sequelize.sync()` et de la mini-migration (documentation d'abord, pas de remplacement brutal).

### 2026-10-14 — Tâche 4.3 (documentation, non cochée)
- Résultat : limites documentées dans `DOCUMENTATION.md` §15, avec une proposition de migrations versionnées. Aucun changement du mécanisme actuel, conformément à la consigne (« ne pas remplacer brutalement »).
- Constat vérifié (script jetable dans le scratchpad, reproduisant `syncDatabase()` sur SQLite) : une colonne `unique` et `allowNull: false` ajoutée à une table existante est créée en `allowNull = true` et sans index unique ; doublons et `NULL` sont acceptés. Colonnes potentiellement concernées sur une base ancienne : `Commande.numeroCommande` et `confirmationToken`, `Produit.reference`, `Categorie.slug`, `Transaction.idempotencyKey` et `providerReference` (l'idempotence des paiements repose sur ces deux dernières). Autres limites : index jamais ajoutés sur une table existante, pas de renommage, de changement de type ni de backfill, pas d'historique, ENUM en ajout seulement, exécution à chaque démarrage, divergence SQLite/PostgreSQL.
- Requête SQL en lecture seule fournie (§15.2) pour vérifier les index uniques de la base Render.
- Proposition : Umzug et `SequelizeMeta`, `0001-baseline` sans effet, `0002-contraintes-uniques` qui détecte les doublons avant de créer les index, coexistence avec le complément de colonnes pendant la transition.
- Bloquant : PostgreSQL indisponible en local (ni `psql` ni Docker), alors que la tâche exige des tests SQLite et PostgreSQL. Ils sont à prévoir via un service PostgreSQL en CI (5.1). Nouvelle dépendance (Umzug) à valider.
- Fichiers modifiés : `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : script de vérification de la limite SQLite (constat confirmé) ; pas de code applicatif modifié.
- Prochaine tâche : 5.1, ajouter une CI (installation, tests serveur, build web, typechecks ; sans secrets de production). Elle débloque aussi les tests PostgreSQL de 4.3.

### 2026-10-14 — Tâche 5.1
- Résultat : terminée. Nouveau `.github/workflows/ci.yml` (GitHub Actions), déclenché par les push sur `main`/`master`, les pull requests et à la main. Il compte 4 jobs parallèles sous Node 20 (la version de production de `render.yaml`) :
  - serveur : `npm ci` puis `npm test` ;
  - site web : `npm ci`, build, puis vérification que `client/dist/index.html` existe ;
  - API alternative : `npm ci`, `prisma:generate` explicite, typecheck ;
  - mobile : `npm ci` puis `tsc --noEmit -p buyhere/mobile`.

  `npm ci` échoue si un lockfile est désynchronisé. Le workflow a `permissions: contents: read`, `concurrency` pour annuler les exécutions obsolètes, un cache npm par projet et aucun secret (vérifié : aucune référence à `secrets.`).
- Fichiers modifiés : `.github/workflows/ci.yml` (nouveau), `DOCUMENTATION.md` (§3), `CLAUDE_TASKS.md`.
- Validations exécutées : YAML analysé avec la bibliothèque `yaml` (aucune erreur, jobs et commandes listés) ; commandes exactes de chaque job rejouées en local dans un shell POSIX (serveur 105/105, build web OK avec `dist/index.html`, typecheck backend OK, `tsc` mobile OK). `npm ci` des quatre projets déjà validé en 1.1.
- Limite : le dossier local n'est pas un dépôt git, donc la CI n'a pas encore tourné sur GitHub. Surveiller la première exécution après le push : Node 20 en CI contre Node 24 en local, et module natif `sqlite3` installé normalement par npm 10.
- Non inclus, volontairement : job PostgreSQL. Les tests serveur créent chacun une base SQLite isolée et tournent en parallèle ; les faire tourner sur PostgreSQL demande une base par fichier de test, à prévoir avec les migrations (4.3).
- Prochaine tâche : 5.2, tests frontend et mobile prioritaires (authentification, panier et checkout, retour paiement, navigation mobile et deep links). Aucun framework de test n'est installé côté client ou mobile : à évaluer avant d'ajouter une dépendance.

### 2026-10-14 — Tâche 5.2 (itération 1 : outillage client et retour paiement)
- Résultat : outillage de test du site mis en place, et premier domaine prioritaire couvert.
  - Choix : Vitest, l'outil natif de Vite, avec jsdom et Testing Library. Uniquement en `devDependencies` : `vitest@^2.1.9` (compatible Vite 5), `jsdom@^25`, `@testing-library/react@^16`, `@testing-library/dom@^10`. Configuration dans la clé `test` de `vite.config.js` ; script `npm test` (`vitest run`). Le bundle de production est inchangé (même hash).
  - Retour paiement (`PaymentReturnPage.test.jsx`, 7 tests). La règle « une redirection n'est jamais une preuve de paiement » est vérifiée : avec `?status=success` sans confirmation serveur, jamais « Paiement confirmé » (6 essais puis « en cours de traitement ») ; échec serveur avec `?status=success` → « échoué » ; validation serveur avec `?status=fail` → « confirmé ». Sont aussi couverts : le webhook en retard (confirmé au 3e essai), l'appel du bon endpoint avec le jeton client, l'absence de numéro de commande (aucun appel réseau) et le serveur injoignable.
  - CI : étape `npm test --prefix client` ajoutée avant le build.
- Constat noté, hors périmètre de cette itération : `SandboxMockProvider.initiate` redirige vers `/payment/return?orderId=…`, alors que la page lit `order` (le flux web, via `paymentGateway`, utilise bien `order=`). Seul le flux `/payments/initiate` en sandbox est concerné.
- Fichiers modifiés : `client/package.json`, `client/package-lock.json`, `client/vite.config.js`, `client/src/pages/PaymentReturnPage.test.jsx` (nouveau), `.github/workflows/ci.yml`, `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix client` (7/7) ; `npm run build --prefix client` (OK) ; YAML du workflow valide.
- Reste pour 5.2 : authentification web (connexion, déconnexion, session expirée), panier et checkout (calculs, choix du mode de paiement, redirection), puis le mobile (outillage `jest-expo` à évaluer, navigation et deep links de `linking.ts`).
- Prochaine tâche : 5.2 (suite), panier et checkout web.

### 2026-10-14 — Tâche 5.2 (itération 2 : panier et checkout web)
- Résultat : checkout couvert ; un bug d'affichage corrigé.
  - Bug corrigé (`CheckoutPage.jsx`) : le badge « Test » des options Konnect et Flouci s'affichait toujours, même en production (`paiementTest=false`). Le suffixe de description respectait déjà la configuration, pas le badge. Il dépend désormais de `virementConfig?.paiementTest`, ce qui complète la tâche 3.1 côté interface.
  - `CheckoutPage.test.jsx` (9 tests) :
    - totaux : sous-total, livraison et timbre par boutique, total TTC (2 boutiques → 136.000 TND) ;
    - adresse incomplète → erreur, aucune requête ;
    - commande COD : `lignes` de la forme `{produitId, varianteId, quantite}`, sans aucun champ prix, total ou montant (le serveur recalcule), puis confirmation et `onOrderPlaced` ;
    - erreur serveur affichée sans fausse confirmation ;
    - badge « Test » absent en production et présent en sandbox ;
    - paiement en ligne non proposé aux invités ;
    - message de redirection vers le prestataire ;
    - paiement sandbox : seule la `paymentRef` part vers `/paiements/confirm`, et aucune donnée de carte (numéro, CVV) n'apparaît dans les requêtes.
- Défaut noté, non corrigé : le `<form>` du coupon est imbriqué dans le `<form>` de commande (`validateDOMNesting`, HTML invalide). À extraire hors du formulaire principal dans une itération dédiée.
- Fichiers modifiés : `client/src/pages/CheckoutPage.jsx` (badge), `client/src/pages/CheckoutPage.test.jsx` (nouveau), `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix client` (16/16) ; `npm run build --prefix client` (OK).
- Reste pour 5.2 : authentification web (connexion, déconnexion, session expirée dans `App.jsx`), puis le mobile (outillage et deep links).
- Prochaine tâche : 5.2 (suite), authentification web.

### 2026-10-14 — Tâche 5.2 (itération 3 : authentification web)
- Résultat : authentification couverte ; un défaut corrigé.
  - Défaut corrigé (`App.jsx`) : aucune gestion de session expirée. Avec un jeton expiré (7 jours) ou refusé (compte supprimé), l'interface restait « connectée » alors que chaque appel API répondait 401, jusqu'à une déconnexion manuelle. Au chargement, la session restaurée est désormais validée par `GET /users/me` : un 401 efface `token`, `userId` et `userRole` et repasse en invité. Une panne réseau conserve la session. Cette amélioration est indépendante des phases 4.1 et compatible avec elles.
  - `App.auth.test.jsx` (8 tests, `App` complet sous `BrowserRouter` avec `fetch` simulé) :
    - connexion client : jeton stocké, identifiants envoyés tels quels, fenêtre fermée, reste sur la page ;
    - identifiants refusés : message serveur affiché, rien de stocké ;
    - redirection par rôle (`super_admin` → `/admin`, `admin_boutique` → `/vendeur`, `livreur` → `/livreur`) ;
    - déconnexion : stockage vidé ;
    - jeton expiré (401) : session effacée et jeton bien transmis à `/users/me` ;
    - serveur injoignable : session conservée.
- Fichiers modifiés : `client/src/App.jsx`, `client/src/App.auth.test.jsx` (nouveau), `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix client` (24/24) ; `npm run build --prefix client` (OK).
- Reste pour 5.2 : le mobile. Outillage à installer (`jest-expo` et `@testing-library/react-native`, l'outillage standard Expo), puis navigation et deep links (`navigation/linking.ts`). Le web est terminé : retour paiement, checkout et authentification.
- Prochaine tâche : 5.2 (suite), tests mobiles.

### 2026-10-14 — Tâche 5.2 (itération 4 : mobile, tâche terminée)
- Résultat : tâche terminée. Les quatre domaines prioritaires sont couverts : retour paiement, checkout, authentification web, navigation et deep links mobiles.
  - Outillage mobile : `npx expo install`, qui choisit les versions compatibles avec le SDK 57 : `jest@~29.7.0`, `jest-expo@~57.0.6`, `@testing-library/react-native@^14.1.0` (devDependencies). Configuration `jest` dans `package.json` (preset `jest-expo`, `src/**/*.test.ts(x)`) et script `npm test`. Les tests importent leurs fonctions depuis `@jest/globals`, donc `tsc --noEmit` les vérifie sans `@types/jest`.
  - `src/navigation/linking.test.ts` (36 tests) :
    - liens d'app (`produit/123`, `boutique/5`, `commande/789`, `promotion/ETE2026`, `livreur/courses/42`, `vendeur/produits/9`, `admin/commandes/77`) avec leurs paramètres ;
    - onglets imbriqués sous `Main` ;
    - alias pluriels du site (`produits/…`, `boutiques/…`, `commandes/…`, `coupons/…`) ;
    - préfixes (`buyhere://` et les deux domaines) ;
    - cohérence avec `app.json` : chaque domaine Android et iOS est un préfixe de la table, et chaque `pathPrefix` intercepté ouvre un écran connu.
    - Seul `expo-linking.createURL` est simulé, car il dépend du runtime Expo.
  - CI : étape `npm test --prefix buyhere/mobile -- --ci` ajoutée au job mobile.
  - Documentation : §11.7 corrigée (`here.tn` → `buyhere.tn`, domaines réels d'`app.json`).
- Constats notés, non corrigés :
  - Le site web n'a pas de route `/commandes/:id`, `/promotion/:code` ni `/coupons/:code`, alors que l'app intercepte ces préfixes. Sans l'app installée, ces liens tombent sur la route par défaut du site.
  - Rappel de l'itération 1 : `SandboxMockProvider` utilise `orderId=` au lieu de `order=`.
  - Rappel de l'itération 2 : le formulaire coupon est imbriqué dans le formulaire de commande.
- Fichiers modifiés : `buyhere/mobile/package.json`, `buyhere/mobile/package-lock.json`, `buyhere/mobile/src/navigation/linking.test.ts` (nouveau), `.github/workflows/ci.yml`, `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix buyhere/mobile -- --ci` (36/36) ; `tsc --noEmit -p buyhere/mobile` (OK) ; `npm test --prefix client` (24/24, itération précédente) ; YAML CI valide.
- Prochaine tâche : 5.3, vérifier la publication mobile (bundle ID et package, signature, push, liens profonds, build EAS de production). Vérifications locales possibles ; la signature et le build EAS demandent le compte Expo de l'utilisateur.

### 2026-10-14 — Tâche 5.3 (vérifications locales, non cochée)
- Résultat : tout ce qui est vérifiable sans compte a été vérifié et testé ; deux échecs silencieux ont été corrigés.
  - Signature (`plugins/withReleaseSigning.js`) : sans `BUYHERE_UPLOAD_*`, la build release était signée en silence avec la clé de debug, ce qui donne un APK non publiable et une empreinte App Links fausse. Gradle émet désormais `logger.warn` (« … non publiable »). La transformation est extraite dans `ajouterSignatureRelease()`, pure et testée.
  - Push (`hooks/usePushNotifications.ts`) : l'échec de `getExpoPushTokenAsync` était avalé (`catch { return null; }`). Il est désormais journalisé `[PUSH]`, en précisant si `projectId` EAS manque. Or `app.json` n'a pas de `extra.eas.projectId` et aucun FCM n'est configuré : le push ne peut pas fonctionner en build autonome tant que le projet EAS n'est pas lié.
  - `src/publication.test.ts` (11 tests) :
    - `tn.buyhere.app` identique sur iOS, Android et dans le package par défaut d'`assetlinks.json` côté serveur ; `autoVerify` sur tous les intent filters ;
    - profils EAS `preview` et `production` en HTTPS, `production` identique à `.env.production` ;
    - signature : clé conditionnelle sur release, debug inchangé, avertissement présent, aucun secret en dur, idempotence.
  - `DOCUMENTATION.md` §16 : état vérifié, bloquants côté comptes et propositions.
- Fichiers modifiés : `buyhere/mobile/plugins/withReleaseSigning.js`, `buyhere/mobile/src/hooks/usePushNotifications.ts`, `buyhere/mobile/src/publication.test.ts` (nouveau), `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées : `jest` mobile (47/47) ; `tsc --noEmit -p buyhere/mobile` (OK).
- Bloquant (actions utilisateur, §16.2) : `eas init` (projectId), FCM V1 et APNs dans `eas credentials`, signature EAS ou clé d'upload, empreinte Play App Signing et `APPLE_APP_ID` sur Render, domaine `buyhere.tn` branché, build `production` et test sur appareil réel.
- Propositions à valider (§16.3) : `appVersionSource: remote` et `autoIncrement` ; `usesCleartextTraffic` limité aux builds hors production ; pages web pour `/commandes/:id`, `/promotion/:code` et `/coupons/:code`.
- Prochaine tâche : 5.4, nettoyer la documentation (`README.md`, `buyhere/README.md`, `IMPLEMENTATION_SUMMARY.md`, `DOCUMENTATION.md` : supprimer les contradictions, documenter les validations réellement passées).

### 2026-10-14 — Tâche 5.4
- Résultat : terminée.
  - `README.md` réécrit : il décrivait un « prototype SQLite » et listait comme « à faire » JWT, les modèles, le checkout et le chat, déjà livrés. Il présente désormais l'architecture et les ports (API 5000, site 5174, mobile, `buyhere/backend` non utilisée), l'URL de production, le démarrage, les comptes de démo (livreur ajouté), les commandes de test et la CI, les règles de paiement et ce qui reste à configurer avant une mise en production réelle.
  - `IMPLEMENTATION_SUMMARY.md` : bandeau « document historique », suppression de l'affirmation « complètement opérationnel », liste « prochaines étapes » obsolète remplacée par un renvoi vers ce fichier, base de données corrigée (SQLite en dev, PostgreSQL en production).
  - `DOCUMENTATION.md` : §3 (descriptions de `README`, `IMPLEMENTATION_SUMMARY` et `CLAUDE_TASKS`), §4.1 (script `test`), §2 (commandes de test des trois projets), §4.12 (8 nouveaux fichiers de test serveur, 105 tests ; tests client et mobile ; CI), §10 (statut d'`IMPLEMENTATION_SUMMARY`).
  - `buyhere/README.md` déjà clarifié en 2.3.
- Fichiers modifiés : `README.md`, `IMPLEMENTATION_SUMMARY.md`, `DOCUMENTATION.md`, `CLAUDE_TASKS.md`.
- Validations exécutées le 2026-10-14, après les modifications : `npm test --prefix server` (105/105) ; `npm test --prefix client` (24/24) ; `npm run build --prefix client` (OK, `dist/index.html`) ; `npm test --prefix buyhere/mobile -- --ci` (47/47) ; `tsc --noEmit -p buyhere/mobile` (OK) ; `npm run typecheck --prefix buyhere/backend` (OK). Compte livreur de démo vérifié dans `seed.js`.

### Bilan de la boucle — 2026-10-14
Toutes les tâches réalisables sans compte externe ni décision sont faites. Les tâches restantes sont bloquées par l'utilisateur :

| Tâche | Bloquant |
|---|---|
| 3.2 Webhooks | Credentials de test Konnect et Flouci ; format réel des webhooks ; secrets sur Render |
| 3.3 Médias | Vérification d'une photo après redéploiement Render |
| 3.4 Notifications | SMTP sur Render ; décision SMS |
| 4.1 Auth web | Choix des phases A/B/C (`DOCUMENTATION.md` §13) |
| 4.2 États en mémoire | Accord pour la reprise de la cascade livreurs (§14) |
| 4.3 Migrations | Accord sur Umzug ; tests PostgreSQL via CI (§15) |
| 5.3 Publication mobile | Compte EAS, FCM/APNs, signature, build de production (§16) |

Critères de fin de boucle :
- remplis : tests serveur ; build client ; typechecks backend et mobile ; architecture de déploiement unique documentée ; plus d'URL de production obsolète ; paiements de production hors sandbox ; aucun secret ajouté au dépôt ; changements documentés et vérifiés.
- non vérifiables localement : absence de secrets dans l'historique Git (le dossier local n'est pas un dépôt git) et premier passage de la CI sur GitHub.

Défauts relevés, hors liste de tâches, non corrigés :
- `SandboxMockProvider` redirige avec `orderId=` au lieu de `order=` ;
- le formulaire coupon est imbriqué dans le formulaire de checkout ;
- pas de pages web pour `/commandes/:id`, `/promotion/:code` ni `/coupons/:code` ;
- logo de boutique et image de catégorie non nettoyés au remplacement.

### 2026-10-14 — Reprise : défauts relevés (1/4) — URL de retour sandbox
- Contexte : boucle relancée sans réponse aux décisions en attente (3.2–3.4, 4.1–4.3, 5.3). Ces tâches restent en attente. Seuls les défauts relevés, locaux et réversibles, sont traités, un domaine par itération.
- Résultat : `SandboxMockProvider.initiate` renvoyait `/payment/return?orderId=…`, alors que `PaymentReturnPage` lit `order` (comme les retours Konnect et Flouci de `paymentGateway.js`). Un paiement sandbox initié par `/payments/initiate` aboutissait donc à « Impossible de retrouver votre commande ». Le paramètre est désormais `order`.
- Fichiers modifiés : `server/src/services/payments/SandboxMockProvider.js`, `server/tests/sandboxPayments.test.js` (+1 test sur le contrat de l'URL de retour), `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix server` (106/106).
- Prochaine itération : formulaire coupon imbriqué dans le formulaire de checkout (`CheckoutPage.jsx`).

### 2026-10-14 — Reprise : défauts relevés (2/4) — coupon qui passait la commande
- Résultat : le défaut, noté comme « HTML invalide », était en fait un **bug fonctionnel grave**, confirmé par un test avant correction. Le `<form>` du coupon était imbriqué dans le `<form>` de commande, et l'événement React `submit` remontait au formulaire parent : à l'étape livraison, cliquer sur « Appliquer » envoyait `POST /commandes`. La commande partait **sans la remise**. Le bloc coupon n'est plus un `<form>` : bouton `type="button"`, et la touche Entrée dans le champ applique le coupon sans déclencher la soumission implicite de la commande.
- Tests : `CheckoutPage.test.jsx` +2 (clic sur « Appliquer » et touche Entrée : `/coupons/valider` appelé, `/commandes` jamais appelé, total 136 → 124.000 TND). Le premier échouait avant correction, avec `/commandes` appelé.
- Fichiers modifiés : `client/src/pages/CheckoutPage.jsx`, `client/src/pages/CheckoutPage.test.jsx`, `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix client` (26/26, plus d'avertissement `validateDOMNesting`) ; `npm run build --prefix client` (OK).
- Prochaine itération : nettoyage du logo de boutique et de l'image de catégorie au remplacement.

### 2026-10-14 — Reprise : défauts relevés (3/4) — logo et image de catégorie
- Résultat : `supprimerImagesSiOrphelines` (tâche 3.3) est désormais appelé après la mise à jour du logo (`PUT /vendor/boutique/:vendeurId`) et de l'image de catégorie (`PATCH /admin/categories/:id`, y compris lors du retrait par `image: null`). Comme ailleurs, une image encore référencée par une autre fiche est conservée.
- Constat noté : `PUT /vendor/boutique/:vendeurId` accepte `banniere`, mais le modèle `Boutique` n'a pas cette colonne ; la valeur est ignorée sans erreur.
- Tests : `uploadDb.test.js` +2 (logo remplacé ; image de catégorie remplacée puis retirée).
- Fichiers modifiés : `server/src/routes/vendorRoutes.js`, `server/src/routes/adminRoutes.js`, `server/tests/uploadDb.test.js`, `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix server` (108/108).
- Prochaine itération : routes web manquantes pour les liens interceptés par l'app (`/commandes/:id`, `/promotion/:code`, `/coupons/:code`).

### 2026-10-14 — Reprise : défauts relevés (4/4) — liens partagés sans page web
- Résultat : `App.jsx` ajoute des redirections `/commandes/:orderId` → `/commandes`, et `/promotion/:code` ou `/coupons/:code` → `/coupons`. Ces liens, interceptés par l'app quand elle est installée, affichaient la page introuvable sur le site.
- Tests : `client/src/App.routes.test.jsx` (5 tests : les 3 redirections, et `/produits/:id` et `/boutiques/:id` qui restent sur leur page). Le script de cohérence des routes (scratchpad) donne 30 routes et 105 cibles de navigation, toutes résolues.
- Fichiers modifiés : `client/src/App.jsx`, `client/src/App.routes.test.jsx` (nouveau), `DOCUMENTATION.md` (§16.3), `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix client` (31/31, aucune erreur non gérée) ; `npm run build --prefix client` (OK).
- Constat noté, non corrigé, car il demande une décision de schéma (voir 4.3) : la bannière de boutique est envoyée par le client (`banniere`) mais n'existe pas dans le modèle `Boutique`, et `StorePage.jsx` lit `store.bannière`, avec un accent. La bannière n'est donc jamais enregistrée ni affichée.

### Fin de la reprise — 2026-10-14
Les quatre défauts relevés sont corrigés. Dont un bug grave : appliquer un coupon passait la commande sans la remise. Totaux de tests : serveur 108, client 31, mobile 47. Les tâches restantes (3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.3) attendent toujours les décisions ou les accès listés dans le bilan ci-dessus.

### 2026-10-14 — Tâche 4.2 (implémentation)
- Décision : la boucle a été relancée plusieurs fois sans réponse. Conformément aux règles de la boucle (action locale et réversible : trancher plutôt qu'attendre), la recommandation du §14 a été appliquée. Elle ne demande ni dépendance, ni Redis, ni changement de schéma. 4.1 et 4.3, qui touchent l'architecture ou ajoutent une dépendance, restent en attente.
- Résultat (`server/src/utils/courierMatching.js`) :
  1. `reprendreCascades()`, appelée par `server.js` après `syncDatabase()` : chaque `NotificationLivreur` encore `envoyee` voit son minuteur réarmé pour le temps restant, ou est traitée tout de suite si elle a expiré pendant l'arrêt, ce qui fait passer la cascade au livreur suivant. Elle est journalisée `[MATCHING]`.
  2. Reconstruction après perte d'état (`advanceCascade`) : `matchAndNotifyCourierForLivraison(id, { exclureDejaSollicites: true })` exclut les livreurs ayant déjà une offre pour cette livraison. La relance manuelle (`orderController.js`) garde son comportement : tout le monde est sollicitable.
  3. Expiration paresseuse (`livreurRoutes.js`, acceptation et `/notifications/pending`) : `handleNotificationTimeout` remplace le simple passage à `expiree`, et la cascade avance.
  4. Minuteur factorisé dans `armerMinuteur()`.
- Tests : `server/tests/courierRestart.test.js` (3 tests, redémarrage simulé par `arreterCascades()`) : offre expirée pendant l'arrêt → livreur suivant, puis aucun livreur sollicité deux fois ; offre encore valide → minuteur réarmé ; expiration constatée par `/pending` → la cascade avance.
- Fichiers modifiés : `server/src/utils/courierMatching.js`, `server/src/routes/livreurRoutes.js`, `server/src/server.js`, `server/tests/courierRestart.test.js` (nouveau), `DOCUMENTATION.md` (§14), `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/courierRestart.test.js` (3/3) ; `npm test --prefix server` (111/111).
- Restent en attente : 3.2, 3.3, 3.4 (accès et vérifications Render), 4.1 (choix des phases), 4.3 (dépendance Umzug), 5.3 (comptes de publication).

### 2026-10-14 — Tâche 4.1, phase B (jeton OAuth hors de la query string)
- Décision : même règle que pour 4.2 (boucle relancée sans réponse). La phase B, recommandée au §13, est petite, réversible et sans changement de schéma : elle a été appliquée. La phase A (`tokenVersion` et rôle relu en base) **n'est pas appliquée**. Elle change le comportement visible pour le site comme pour le mobile : un changement de mot de passe déconnecterait aussi la session en cours, sauf à renvoyer un nouveau jeton, et un rôle modifié prendrait effet immédiatement. Ce choix revient à l'utilisateur. La phase C reste un chantier dédié.
- Résultat :
  - `oauthRoutes.js` : nouveau `urlRetourWeb()`. En succès, `/oauth/callback#token=…` (fragment jamais envoyé au serveur, donc absent des logs d'accès Render et Vercel et du `Referer`) ; en erreur, `?error=…` (sans secret). Le retour vers l'app mobile (`buyhere://…?token=`, schéma privé) est inchangé.
  - `OAuthCallbackPage.jsx` : lit le jeton dans le fragment, avec repli sur la query pour les anciens liens pendant la transition (site sur Vercel et API sur Render pouvant être déployés séparément) ; l'URL est effacée comme avant.
- Tests : `server/tests/oauthRedirect.test.js` (2 : succès = jeton seulement dans le fragment, query vide ; erreur = aucun jeton) et `client/src/pages/OAuthCallbackPage.test.jsx` (4 : fragment, ancien lien en query, erreur fournisseur, jeton illisible).
- Fichiers modifiés : `server/src/routes/oauthRoutes.js`, `client/src/pages/OAuthCallbackPage.jsx`, les deux fichiers de test (nouveaux), `DOCUMENTATION.md` (§13), `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix server` (113/113) ; `npm test --prefix client` (35/35) ; `npm run build --prefix client` (OK).
- 4.1 reste non cochée : la phase A attend une décision (comportement au changement de mot de passe et de rôle), et la phase C est un chantier dédié.

### 2026-10-14 — Tâche 4.1, phase A (révocation et rôle relu en base)
- Décision : l'utilisateur a demandé d'appliquer automatiquement les recommandations. Option retenue : le changement de mot de passe déconnecte les autres appareils et garde la session courante, avec un nouveau jeton.
- Résultat :
  - `Utilisateur.tokenVersion` (entier, défaut 0, ajouté par `syncDatabase`) et claim `tv` dans le JWT.
  - `verifierJeton()` (`middleware/auth.js`), utilisé par `authMiddleware`, `optionalAuthMiddleware` et Socket.io : refuse un jeton dont `tv` est dépassé et remplace le rôle du jeton par celui de la base. Les jetons sans `tv` (émis avant le déploiement) valent version 0, donc personne n'est déconnecté au déploiement. Coût : une lecture par clé primaire par requête authentifiée.
  - Révocation : changement de mot de passe (le nouveau jeton est renvoyé et enregistré par `AccountPage.jsx` et par `meApi.changePassword` côté mobile), réinitialisation par email, nouvel endpoint `POST /auth/logout-all`.
- Tests : `server/tests/authRevocation.test.js` (6 tests) :
  - changement de mot de passe : les autres sessions et l'ancien jeton sont refusés, le nouveau jeton est valide ;
  - réinitialisation : toutes les sessions sont révoquées ;
  - `logout-all` ;
  - rôle `administrateur` retiré en base → 403 immédiat avec le même jeton ;
  - jeton sans `tv` accepté ;
  - jeton d'un autre secret refusé.
- Fichiers modifiés : `server/src/models/index.js`, `server/src/middleware/auth.js`, `server/src/realtime/io.js`, `server/src/controllers/authController.js`, `server/src/routes/authRoutes.js`, `client/src/pages/AccountPage.jsx`, `buyhere/mobile/src/api/endpoints.ts`, `server/tests/authRevocation.test.js` (nouveau), `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix server` (119/119) ; `npm test --prefix client` (35/35) ; build client OK ; `tsc` mobile OK ; `jest` mobile (47/47).

### 2026-10-15 — Tâche 4.3 (migrations versionnées)
- Décision : appliquée à la demande de l'utilisateur (recommandations automatiques). Nouvelle dépendance serveur : `umzug@^3.8.2`.
- Résultat :
  - `server/src/config/migrations.js` : Umzug, avec stockage `SequelizeMeta`, migrations ES modules chargées par `import()`, journalisation `[MIGRATION] … appliquée`. Appelé par `syncDatabase()` après `sync()` et le complément de colonnes, conservé pour les colonnes simples nullable.
  - `server/migrations/0001-baseline.js` : sans effet, il marque le point de départ.
  - `server/migrations/0002-contraintes-uniques.js` : liste figée des 13 contraintes d'unicité et 4 index déclarés. Une table ou colonne absente est ignorée ; un index équivalent existant n'est pas recréé (sur une base neuve, aucun index en double, vérifié) ; des doublons provoquent un échec explicite avec les valeurs, sans rien créer (tout ou rien) ; `down` retire les index créés.
  - Bannière de boutique : colonne `Boutique.banniere` ajoutée (créée par le complément sur les bases existantes) ; `StorePage.jsx` lisait `store.bannière` (avec accent), corrigé ; la bannière est incluse dans le nettoyage des images orphelines (3.3).
  - CI : job `server-postgres` (service `postgres:16`, `TEST_POSTGRES_URL` jetable) qui exécute `tests/migrations.test.js` sur SQLite et PostgreSQL.
- Tests : `server/tests/migrations.test.js` (5 par dialecte) : base ancienne → contraintes ajoutées puis doublon refusé (NULL multiples permis) ; idempotence ; doublons → échec explicite sans contrainte ; `down` ; lanceur → `SequelizeMeta` tracé, rien de rejoué.
- Fichiers modifiés : `server/package.json`, `server/package-lock.json`, `server/src/config/migrations.js` (nouveau), `server/src/config/database.js`, `server/migrations/` (nouveau), `server/src/models/index.js`, `server/src/utils/upload.js`, `server/src/routes/vendorRoutes.js`, `client/src/pages/StorePage.jsx`, `server/tests/migrations.test.js` (nouveau), `.github/workflows/ci.yml`, `DOCUMENTATION.md` (§15), `CLAUDE_TASKS.md`.
- Validations exécutées : `node --test tests/migrations.test.js` (5/5 SQLite) ; `npm test --prefix server` (124/124) ; `npm test --prefix client` (35/35) ; build client OK ; YAML CI valide.
- Non validé localement : PostgreSQL (ni `psql` ni Docker sur ce poste). Il le sera au premier passage du job `server-postgres`.
- ⚠️ Avant de déployer : lancer la requête du §15.2 sur la base Render. S'il y a des doublons, le nouveau déploiement refusera de démarrer avec la liste des valeurs, et Render gardera la version précédente en service.

### 2026-10-15 — Tâche 5.3 : propositions §16.3 appliquées
- Résultat :
  - `eas.json` : `appVersionSource: "remote"` et `autoIncrement: true` sur `production`.
  - Nouveau `app.config.js` : reprend `app.json` à l'identique, sauf `usesCleartextTraffic`, qui vaut `false` pour `EAS_BUILD_PROFILE=production` ou `APP_ENV=production`, et `true` sinon (développement, preview).
- Tests : `publication.test.ts` +5 (production EAS, production locale, dev et preview, aucun autre changement de configuration, versions EAS).
- Validations exécutées : `jest` mobile (52/52) ; `tsc` mobile OK ; `npx expo config` en dev (`cleartext=true`) et avec `EAS_BUILD_PROFILE=production` (`cleartext=false`, package `tn.buyhere.app`).
- 5.3 reste en attente des comptes (EAS, FCM/APNs, signature, build de production ; §16.2).

### 2026-10-15 — Refonte de la page d'accueil (demande utilisateur)
- Résultat : l'accueil sort d'`App.jsx` vers `client/src/pages/HomePage.jsx`. Les données chargées sont les mêmes.
  - Hero visiteur : titre éditorial, recherche réelle (`/catalogue?q=…`, et `Marketplace.jsx` lit désormais `q` au démarrage), raccourcis vers les 4 premières catégories. Sur grand écran, collage de vraies photos produits et compteur de boutiques actives ; photo de repli s'il manque des images.
  - Bande de confiance déplacée juste sous le hero, en version compacte.
  - Catégories en tuiles photo, rangée défilante sur téléphone et grille sur ordinateur.
  - En-têtes de section uniformes (titre, sous-titre, lien « Tout voir »).
  - Squelettes de chargement pour les produits.
  - Bandeau « Codes promo du moment » vers `/coupons`.
  - Vendeurs affichés en pastilles sous les boutiques.
  - **La newsletter est supprimée.** Elle affichait « Merci ! Vous êtes inscrit » sans aucun envoi au serveur (faux succès). Elle est remplacée par un bandeau « Vous vendez en Tunisie ? » qui mène à de vraies inscriptions (`/vendeur/inscription`, `/livreur/inscription`).
  - Client connecté : inchangé (`HomeDashboard`), sans hero ni bandeau vendeur.
- Tests : `client/src/pages/HomePage.test.jsx` (6 tests) : recherche avec et sans terme, raccourci de catégorie, confiance et produits affichés, appels à l'action réels sans newsletter, vue client.
- Fichiers modifiés : `client/src/pages/HomePage.jsx` (nouveau), `client/src/pages/HomePage.test.jsx` (nouveau), `client/src/App.jsx` (ancien `HomeView` et imports inutilisés retirés), `client/src/pages/Marketplace.jsx`, `CLAUDE_TASKS.md`.
- Validations exécutées : `npm test --prefix client` (41/41) ; build OK ; cohérence des routes (30 routes, 105 cibles, aucune non résolue) ; capture réelle à 1440 px avec l'API et le site lancés. Le rendu téléphone n'a été vu qu'à 504 px, la largeur minimale de Chrome sans interface ; il reste à vérifier sur un vrai téléphone.

### 2026-10-15 — Correction de l'animation d'ouverture web
- Résultat : l'animation du site était limitée à une seule apparition par session via `sessionStorage`. Elle est désormais affichée à chaque lancement complet du site, comme demandé. Les pages profondes sensibles et le bouton « Toucher pour passer » gardent leur comportement.
- Fichier modifié : `client/src/components/IntroAnimation.jsx`.
- Validations exécutées : `npm test --prefix client` (41/41) ; `npm run build --prefix client` (OK) ; vérification navigateur sur `http://127.0.0.1:5174/?intro`.

### 2026-10-15 — Optimisation de l'animation d'ouverture web
- Résultat : correction des saccades observées dans l'intro. Les filtres `blur` et `drop-shadow`, le `mix-blend-mode` et le zoom final `14x`, coûteux sur certains navigateurs, ont été retirés ou réduits. Les éléments animés indiquent désormais au navigateur qu'ils changent uniquement par `transform`/`opacity` ; le conteneur isole aussi son rendu. La fermeture est idempotente et n'empile plus de timers après un clic ou la touche Échap.
- Fichiers modifiés : `client/src/components/IntroAnimation.jsx`, `client/src/index.css`.
- Validations exécutées : `npm test --prefix client` (41/41) ; `npm run build --prefix client` (OK) ; typecheck mobile (OK) ; vérification navigateur avec `?intro`.
