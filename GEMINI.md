# Instructions Système & Contexte du Projet (La Boîte à Ouvertures)

Ce fichier `GEMINI.md` contient les règles absolues et l'architecture du projet. En tant qu'assistant IA, tu DOIS lire et respecter scrupuleusement ces consignes avant d'effectuer la moindre modification.

## 1. Règles d'Or et Style de Code
*   **Langue de l'Interface :** L'interface utilisateur (UI), les textes affichés à l'écran, les alertes (toasts) et les emails générés DOIVENT IMPÉRATIVEMENT rester en **Français**. Ne jamais les traduire en anglais.
*   **Langue des Développeurs :** Les commentaires dans le code, le nom des variables, les commits Git et la documentation technique (`README.md`, `TESTING.md`, `DOCUMENTATION.md`) doivent être en **Anglais**.
*   **Syntaxe Stricte (ESLint/Prettier) :** 
    *   Utilisation obligatoire des accolades `{}` pour TOUTES les structures de contrôle (`if`, `for`, `while`), même pour une seule ligne.
    *   Guillemets simples `'` privilégiés en JS (géré par Prettier).
    *   Variables : Ne jamais modifier les noms de variables attendus par l'API existante (ex: `moves_learned`, `total_moves`, `errors`).

## 2. Architecture & Stack Technique
*   **Frontend (`public/`) :** Vanilla JavaScript (ES Modules), HTML5, CSS3. Aucun framework lourd (pas de React/Vue). Utilise **Chessground** pour l'échiquier et **Chess.js** pour la validation des coups.
*   **Backend (`server/`) :** Node.js, Express, PostgreSQL (`pg-pool`). Authentification par JWT.
*   **Point d'Entrée Serveur :** Le fichier `server.js` à la racine est un simple proxy qui appelle `require('./server/server.js')`. Ceci est requis par la configuration de déploiement (Render). Ne pas le supprimer.
*   **Mailing (`server/mailer.js`) :** Utilise l'API HTTP de Brevo (Sendinblue). Ne pas utiliser SMTP standard (ports bloqués sur l'hébergement gratuit Render).
*   **Cache Lichess :** Le frontend utilise agressivement le `localStorage` (`repertoire_cache`) pour stocker les PGN de Lichess pendant 1 heure afin d'éviter le "Rate Limiting" de leur API.

## 3. Stratégie de Test (Crucial)
*   **Backend & Frontend Logic (Jest) :** Les tests unitaires/intégration se trouvent dans `__tests__/`.
    *   *Mocks :* La base de données et l'envoi d'email sont systématiquement mockés globalement via `__tests__/setup.js`.
    *   *Frontend :* Les tests du dossier `public/js/` nécessitent Babel (`babel.config.js`) pour transpiler les ES Modules pour Jest.
*   **Interface / E2E (Playwright) :** Les tests interactifs se trouvent dans `tests/e2e/`.
    *   *Mocks Réseau :* Playwright NE DOIT PAS utiliser la vraie base de données. Tous les appels `/api/*` et `https://lichess.org/api/study/*` DOIVENT être interceptés et mockés via `page.route()`.
    *   *Configuration :* Si un serveur tourne déjà localement sur le port 3000, Playwright doit le réutiliser (`reuseExistingServer: true`).

## 4. Déploiement & CI/CD (GitHub Actions -> Render)
*   **Workflow (`.github/workflows/test.yml`) :** S'exécute sur Node 24.x uniquement.
*   **Tests Conditionnels :** Les tests unitaires et le linting s'exécutent à chaque commit. Les tests lourds de Playwright (téléchargement des navigateurs) ne se déclenchent **QUE SI** le message du commit contient le mot-clé `[ui]`.
*   **Déploiement Automatique :** Le site est déployé automatiquement sur Render (via un Webhook caché) *uniquement* si l'étape de test réussit (`success()`). Render est configuré avec l'Auto-Deploy désactivé pour laisser GitHub Actions prendre la décision.

## 5. Flux de Travail Autorisé
1.  Comprendre la demande et consulter les fichiers existants.
2.  Écrire ou modifier le code.
3.  Lancer `npm run format` et `npm run lint:fix` avant toute validation.
4.  Lancer `npm test` pour s'assurer qu'aucune régression backend n'est introduite.
5.  Ne jamais lancer les tests E2E localement sans s'assurer que les mocks API sont bien définis.