# Instructions Système & Contexte du Projet (La Boîte à Ouvertures)

Ce fichier `GEMINI.md` contient les règles absolues et l'architecture du projet. En tant qu'assistant IA, tu DOIS lire et respecter scrupuleusement ces consignes avant d'effectuer la moindre modification.

## 1. Règles d'Or et Style de Code

- **Langue de l'Interface :** L'interface utilisateur (UI), les textes affichés à l'écran, les alertes (toasts) et les emails générés DOIVENT IMPÉRATIVEMENT rester en **Français**. Ne jamais les traduire en anglais.
- **Langue des Développeurs :** Les commentaires dans le code, le nom des variables, les commits Git et la documentation technique (`README.md`, `TESTING.md`, `DOCUMENTATION.md`) doivent être en **Anglais**.
- **Syntaxe Stricte (ESLint/Prettier) :**
  - Utilisation obligatoire des accolades `{}` pour TOUTES les structures de contrôle (`if`, `for`, `while`), même pour une seule ligne.
  - Guillemets simples `'` privilégiés en JS (géré par Prettier).

## 2. Architecture & Stack Technique

- **Frontend (`public/`) :** Vanilla JavaScript (ES Modules), HTML5, CSS3. L'interface principale réside dans `public/index.html`. Aucun framework lourd (pas de React/Vue). Utilise **Chessground** pour l'échiquier et **Chess.js** pour la validation des coups.
- **Backend (`server/`) :** Node.js, Express, PostgreSQL (`pg-pool`). Authentification par JWT.
- **Base de Données (3NF) :** Architecture relationnelle stricte séparant les données globales des données utilisateurs :
  - `repertoires` et `chapters` : Structure universelle des études Lichess (titres, ID, nombre exact de coups blancs/noirs).
  - `user_repertoires` : Abonnements des joueurs à des études spécifiques (avec choix de la couleur).
  - `history` : Journal d'entraînement personnel (identifiants, date, erreurs, coups réussis).
- **Point d'Entrée Serveur :** Le fichier `server.js` à la racine est un simple proxy qui appelle `require('./server/server.js')`. Ceci est requis par la configuration de déploiement (Render). Ne pas le supprimer.
- **Mailing (`server/mailer.js`) :** Utilise l'API HTTP de Brevo (Sendinblue). Ne pas utiliser SMTP standard (ports bloqués sur l'hébergement gratuit Render).

## 3. Logique Métier & Synchronisation (Crucial)

- **Calcul des Scores :** Le pourcentage de réussite global d'un répertoire est calculé dynamiquement sur le frontend. Il se base sur les totaux de coups (`white_moves`/`black_moves` fournis par la table `chapters`) et l'historique des sessions, ce qui garantit un calcul exact à 100% (incluant les chapitres non travaillés à 0%).
- **Affichage Dashboard :** Les répertoires qui possèdent 0 coup total pour la couleur sélectionnée sont automatiquement masqués de l'interface.
- **Synchronisation Lichess (Auto-Sync) :** Le cache `localStorage` est utilisé pour stocker les PGN complets pendant 1 heure pour éviter le "Rate Limiting". De plus, à l'ouverture d'un répertoire sur le Dashboard, si sa dernière mise à jour (`lichess_updated_at` en base de données) date de plus d'une heure, une synchronisation silencieuse avec Lichess est déclenchée pour mettre à jour la structure des chapitres en base de données de manière globale.

## 4. Stratégie de Test (Crucial)

- **Backend & Frontend Logic (Jest) :** Les tests unitaires/intégration se trouvent dans `__tests__/`.
  - _Mocks :_ La base de données et l'envoi d'email sont systématiquement mockés globalement via `__tests__/setup.js`.
  - _Frontend :_ Les tests du dossier `public/js/` nécessitent Babel (`babel.config.js`) pour transpiler les ES Modules pour Jest.
- **Interface / E2E (Playwright) :** Les tests interactifs se trouvent dans `tests/e2e/`.
  - _Mocks Réseau :_ Playwright NE DOIT PAS utiliser la vraie base de données. Tous les appels `/api/*` et `https://lichess.org/api/study/*` DOIVENT être interceptés et mockés via `page.route()`.
  - _Configuration :_ Si un serveur tourne déjà localement sur le port 3000, Playwright doit le réutiliser (`reuseExistingServer: true`).

## 5. Déploiement & CI/CD (GitHub Actions -> Render)

- **Workflow (`.github/workflows/test.yml`) :** S'exécute sur Node 24.x uniquement.
- **Tests Conditionnels :** Les tests unitaires et le linting s'exécutent à chaque commit. Les tests lourds de Playwright (téléchargement des navigateurs) ne se déclenchent **QUE SI** le message du commit contient le mot-clé `[ui]`.

## 6. Flux de Travail Autorisé

1.  Comprendre la demande et consulter les fichiers existants.
2.  Écrire ou modifier le code.
3.  Lancer `npm run format` et `npm run lint:fix` avant toute validation.
4.  Lancer `npm test` pour s'assurer qu'aucune régression backend n'est introduite.
5.  Ne jamais lancer les tests E2E localement sans s'assurer que les mocks API sont bien définis.
