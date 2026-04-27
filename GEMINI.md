# Instructions Système & Contexte du Projet (La Boîte à Ouvertures)

Ce fichier `GEMINI.md` contient les règles absolues et l'architecture du projet. En tant qu'assistant IA, tu DOIS lire et respecter scrupuleusement ces consignes avant d'effectuer la moindre modification.

## 1. Règles d'Or et Style de Code

- **Langue de l'Interface :** L'interface utilisateur (UI), les textes affichés à l'écran, les alertes (toasts) et les emails générés DOIVENT IMPÉRATIVEMENT rester en **Français**. Ne jamais les traduire en anglais.
- **Langue des Développeurs :** Les commentaires dans le code, le nom des variables, les commits Git et la documentation technique (`README.md`, `TESTING.md`, `DOCUMENTATION.md`) doivent être en **Anglais**.
- **Syntaxe Stricte (ESLint/Prettier) :**
  - Utilisation obligatoire des accolades `{}` pour TOUTES les structures de contrôle (`if`, `for`, `while`), même pour une seule ligne.
  - Guillemets simples `'` privilégiés en JS (géré par Prettier).
- **Propriété Intellectuelle :** L'application est une solution logicielle propriétaire dont le code source demeure privé. Ce n'est pas un projet open-source.

## 2. Architecture & Stack Technique

- **Frontend (`public/`) :** Vanilla JavaScript (ES Modules), HTML5, CSS3. L'interface principale réside dans `public/index.html`. Modales (Paramètres, Aide) intégrées pour optimiser l'UI/UX mobile.
- **Backend (`server/`) :** Node.js, Express, PostgreSQL (`pg-pool`). Authentification par JWT. Middleware de sécurité via `helmet`, `express-validator`, et `express-rate-limit`.
- **Base de Données (3NF) :** Architecture relationnelle stricte :
  - `users` : Gestion des utilisateurs et de leurs tokens Lichess OAuth (PKCE).
  - `repertoires` et `chapters` : Structure universelle des études Lichess (titres, ID, nombre exact de coups blancs/noirs).
  - `user_repertoires` : Abonnements des joueurs à des études spécifiques (avec choix de la couleur).
  - `history` : Journal d'entraînement personnel (identifiants, date, erreurs, coups réussis).
- **Point d'Entrée Serveur :** Le fichier `server.js` à la racine est un simple proxy qui appelle `require('./server/server.js')`. Ceci est requis par la configuration de déploiement (Render). Ne pas le supprimer.
- **Mailing (`server/mailer.js`) :** Utilise l'API HTTP de Brevo (Sendinblue). Ne pas utiliser SMTP standard (ports bloqués sur l'hébergement gratuit Render).

## 3. Logique Métier & Synchronisation (Crucial)

- **Calcul des Scores :** Le pourcentage de réussite global d'un répertoire est calculé dynamiquement sur le frontend. Il se base sur les totaux de coups (`white_moves`/`black_moves` fournis par la table `chapters`) et l'historique des sessions.
- **Lichess OAuth & Proxy :** Les utilisateurs lient leur compte Lichess via le flux OAuth PKCE. Les requêtes PGN sont faites via le backend proxy (`/api/lichess/study/:id.pgn`) afin d'insérer le jeton utilisateur en toute sécurité et d'accéder aux études privées.
- **Synchronisation Lichess (Auto-Sync) :** Le cache `localStorage` est utilisé pour stocker les PGN complets pendant 1 heure pour éviter le "Rate Limiting" et les appels inutiles (aucune donnée PGN n'est conservée côté backend). À l'ouverture d'un répertoire, si la MAJ date de plus d'une heure, une synchronisation silencieuse est déclenchée pour mettre à jour la structure des chapitres en BDD.

## 4. Stratégie de Test (Crucial)

- **Backend & Frontend Logic (Jest) :** Les tests unitaires/intégration se trouvent dans `__tests__/`. (Authentification, Historique, Répertoires, Lichess, Utils).
- **Interface / E2E (Playwright) :** Les tests interactifs se trouvent dans `tests/e2e/`.

## 5. Déploiement & CI/CD (GitHub Actions -> Render)

- **Workflow (`.github/workflows/test.yml`) :** S'exécute sur Node 24.x uniquement.
- **Tests Conditionnels :** Les tests unitaires et le linting s'exécutent à chaque commit. Les tests lourds de Playwright ne se déclenchent **QUE SI** le message du commit contient le mot-clé `[ui]`.

## 6. Flux de Travail Autorisé

1.  Comprendre la demande et consulter les fichiers existants.
2.  Écrire ou modifier le code.
3.  Lancer `npm run format` et `npm run lint:fix` avant toute validation.
4.  Lancer `npm test` pour s'assurer qu'aucune régression backend n'est introduite.
5.  Ne jamais lancer les tests E2E localement sans s'assurer que les mocks API sont bien définis.
