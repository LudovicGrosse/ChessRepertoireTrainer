# Architecture et Fonctionnement du Chess Repertoire Trainer

Ce document a pour but de vous donner une vue d'ensemble claire de l'architecture de votre application, des outils utilisés, et de la façon dont le code est structuré.

---

## 1. Architecture Globale

L'application est construite sur un modèle **Client-Serveur (Full-Stack)** léger :

*   **Le Backend (Serveur) :** Construit avec Node.js et Express.js. Il s'occupe de servir la page web, de gérer l'authentification (connexion/inscription) et de dialoguer avec la base de données pour enregistrer ou récupérer l'historique de l'utilisateur.
*   **La Base de Données :** Une base SQLite locale (`database.db`). C'est un fichier unique, facile à gérer, qui contient les tables pour les utilisateurs et leurs statistiques.
*   **Le Frontend (Client) :** Une Single Page Application (SPA) contenue dans un seul fichier `chess.html`. Elle gère toute l'interface utilisateur, la logique d'entraînement aux échecs, l'affichage de l'échiquier et les requêtes vers le backend et vers Lichess.

---

## 2. Les Outils et Librairies Utilisés

### Côté Backend (Node.js)
*   **Express.js :** Le framework web qui permet de créer le serveur, de définir les "routes" (les adresses URL comme `/api/login`) et de traiter les requêtes HTTP.
*   **better-sqlite3 :** La librairie qui permet à Node.js de lire et d'écrire dans la base de données SQLite de manière très rapide et synchrone.
*   **bcryptjs :** Utilisé pour la sécurité. Il "hashe" (crypte) les mots de passe avant de les stocker en base de données. Même si la base est lue, les mots de passe restent secrets.
*   **jsonwebtoken (JWT) :** Utilisé pour maintenir la session de l'utilisateur. Lors de la connexion, le serveur crée un jeton (token) chiffré qu'il donne au navigateur. Le navigateur le renvoie à chaque requête pour prouver l'identité de l'utilisateur.

### Côté Frontend (Navigateur)
*   **Chessground :** Une librairie open-source créée par Lichess. C'est elle qui dessine l'échiquier, gère le déplacement des pièces à la souris, dessine les flèches et surligne les cases.
*   **chess.js :** Le "cerveau" des échecs en arrière-plan. Il ne dessine rien, mais il connaît les règles : il valide si un coup est légal, détecte les échecs et mats, et génère le code FEN (la position) après chaque coup.

---

## 3. Structure des Fichiers et Logique du Code

### `database.js`
C'est le point d'entrée de la base de données.
*   Il initialise la connexion au fichier `database.db`.
*   Il exécute des requêtes `CREATE TABLE IF NOT EXISTS` pour s'assurer que les tables `users` et `history` sont prêtes.

### `server.js`
Le cœur du backend.
*   **Middlewares :** Il utilise `express.json()` pour lire les données envoyées par le client, et `authenticateToken` pour vérifier que le JWT est valide avant d'autoriser l'accès à l'historique.
*   **Routes Auth :** `POST /api/register` (crée un compte et hashe le mot de passe) et `POST /api/login` (vérifie le mot de passe et génère un JWT).
*   **Routes Data :** `POST /api/history` (enregistre une session d'entraînement) et `GET /api/history` (récupère l'historique de l'utilisateur connecté).

### `data.js`
Le moteur de traitement des fichiers PGN (Portable Game Notation).
*   **`parseMultiPgn(pgnText)` :** Lichess renvoie souvent plusieurs chapitres dans un seul fichier texte. Cette fonction découpe le texte pour isoler chaque chapitre.
*   **`buildRepertoireTree(pgn)` :** La fonction la plus complexe. Elle lit un texte PGN et construit un "Arbre" (Tree). Chaque nœud de l'arbre est un coup d'échec. S'il y a des variantes, un nœud aura plusieurs "enfants". Cet arbre est crucial pour permettre à l'application de savoir quel coup est correct pendant l'entraînement.

### `chess.html`
Le fichier massif qui fait tout le travail côté navigateur. Il est divisé en grandes sections :

#### A. Le CSS (Styles)
Gère l'apparence, avec des couleurs sombres, la disposition de l'échiquier et les animations des menus.

#### B. Le HTML (Structure)
Trois grandes "vues" qui s'affichent ou se cachent selon l'état (`.hidden`) :
1.  **Auth Section :** Formulaire de connexion/inscription.
2.  **Setup View (Dashboard) :** L'historique des répertoires, le champ pour coller un lien Lichess, et les options de configuration (Blancs/Noirs, Mode).
3.  **Training View :** L'échiquier, les boutons de navigation, le panneau de statistiques et les commentaires.

#### C. Le Javascript (Logique Frontend)
C'est là que la magie opère. Voici les fonctions clés à comprendre :

*   **Logique d'Authentification :** `handleAuthResponse` sauvegarde le JWT dans le `localStorage` du navigateur. `updateAuthUI` vérifie si ce jeton existe pour décider d'afficher le tableau de bord ou l'écran de connexion.
*   **Tableau de Bord (`renderInteractiveDashboard`) :** Cette fonction prend les données brutes de la base de données, les regroupe par répertoire (titre + couleur), et génère le HTML dynamique pour afficher la liste avec les petits boutons `+` et `-`.
*   **Chargement Lichess (`loadLichessStudy`) :** Elle utilise `fetch` pour aller chercher le fichier `.pgn` sur l'API publique de Lichess. Elle utilise des expressions régulières (`match`) pour extraire le vrai nom de l'étude depuis les balises PGN.
*   **Le Moteur d'Entraînement :**
    *   `startTrainingSession` : Initialise l'arbre (`buildRepertoireTree`), met les compteurs à zéro, et affiche l'échiquier. Elle envoie aussi immédiatement un "ping" à l'historique pour dire que le chapitre a été ouvert.
    *   `preparePlayerTurn` : Dit à Chessground (l'échiquier visuel) quelles pièces le joueur a le droit de bouger. Si on est en mode "Découverte", elle dessine une flèche verte.
    *   `onUserMove` : Déclenchée quand vous relâchez une pièce. Elle vérifie avec `chess.js` si le coup est légal, puis cherche dans l'arbre PGN si ce coup correspond à la théorie. Si oui -> succès, sinon -> erreur.
    *   `playOpponentMove` : Fait jouer l'ordinateur automatiquement en suivant l'arbre PGN.
    *   `handleVariationEnd` : S'exécute quand on arrive à la fin d'une ligne. Si l'arbre entier est complété, elle affiche le score final, envoie les données au serveur (`saveHistory`), et fait apparaître les boutons pour rejouer ou passer au chapitre suivant.

---

## En résumé : Le cycle de vie d'une action

1. Vous copiez un lien Lichess et cliquez sur Charger.
2. `chess.html` envoie une requête à l'API Lichess, télécharge le texte PGN, et appelle `data.js` pour découper les chapitres.
3. Vous cliquez sur "Démarrer". `data.js` transforme le texte du chapitre en un arbre de coups. `chess.html` affiche l'échiquier. Une requête est envoyée au `server.js` pour noter dans SQLite que vous avez commencé ce chapitre.
4. Vous jouez un coup. `chess.js` vérifie les règles, le code JS compare votre coup à l'arbre.
5. Vous finissez la révision. `chess.html` calcule votre % de réussite et envoie les statistiques finales à `server.js` qui met à jour la base de données SQLite.
6. Vous retournez au menu. `chess.html` demande l'historique à `server.js`, qui lit SQLite, renvoie les données, et le code JS reconstruit l'affichage de votre tableau de bord.
