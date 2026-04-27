# La Boîte à Ouvertures 📦

Une application web complète conçue pour aider les joueurs d'échecs à construire, apprendre et réviser leur répertoire d'ouvertures en utilisant les études Lichess.

## 🚀 Fonctionnalités

- **Intégration Lichess :** Connectez votre compte (via OAuth PKCE) pour importer instantanément vos études privées, ou collez l'URL d'une étude publique.
- **Tableau de Bord Interactif :** Suivez votre progression par répertoire et par chapitre avec des statistiques détaillées.
- **Système de Cache Intelligent :** Navigation instantanée grâce à une mise en cache locale (1h) des données d'études.
- **Modes d'Entraînement :**
  - **Mode Découverte :** Apprenez de nouvelles lignes avec des flèches d'aide visuelles.
  - **Mode Révision :** Testez votre mémoire ! Pas d'aide, les erreurs sont comptabilisées pour calculer votre taux de succès.
- **Optimisé pour Mobile :** Échiquier fixé en haut de l'écran et interface responsive pour s'entraîner partout.
- **Gestion Multi-utilisateurs & Sécurité :** Comptes personnels avec vérification d'email et récupération de mot de passe, suppression de compte sécurisée, et protection des données (Helmet, Rate Limiting, Validation stricte des entrées).

## 🛠️ Stack Technique

- **Frontend :** HTML5, CSS3 (Vanilla), JavaScript (ES6+).
- **Échiquier :** [Chessground](https://github.com/lichess-org/chessground) (le moteur de Lichess).
- **Logique Échecs :** [Chess.js](https://github.com/jhlywa/chess.js).
- **Backend :** Node.js avec Express.
- **Base de Données :** PostgreSQL (hébergé sur Neon.tech / Render).
- **Emails :** API HTTP Brevo (pour contourner les limitations SMTP des hébergeurs cloud).
- **Authentification :** JSON Web Tokens (JWT) et Bcrypt pour le hachage des mots de passe. Intégration Lichess via OAuth2 PKCE.

## 📦 Installation et Déploiement

### Local (Développement)

1.  Clonez le dépôt.
2.  Installez les dépendances : `npm install`.
3.  Configurez votre fichier `.env` (voir `.env.example`).
4.  Lancez le serveur : `node server.js` ou `npm run dev`.
5.  Accédez à l'application via `http://localhost:3000`.

### Production

L'application est configurée pour être déployée sur **Render.com**.

- Utilisez la branche `deploy-online`.
- Configurez les variables d'environnement sur Render (`DATABASE_URL`, `BREVO_API_KEY`, `JWT_SECRET`, `APP_URL`, `LICHESS_CLIENT_ID`, `LICHESS_REDIRECT_URI`).

## 📜 Légal

L'application "La Boîte à Ouvertures" est une solution logicielle propriétaire dont le code source demeure privé.
