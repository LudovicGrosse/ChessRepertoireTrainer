# Architecture et Fonctionnement du Chess Repertoire Trainer

Ce document a pour but de vous donner une vue d'ensemble claire de l'architecture de votre application, des outils utilisés, et de la façon dont le code est structuré.

---

## 1. Architecture Globale

L'application est construite sur un modèle **Client-Serveur (Full-Stack)** léger :

*   **Le Backend (Serveur) :** Construit avec Node.js et Express.js. Il s'occupe de servir la page web, de gérer l'authentification (connexion/inscription), d'envoyer les emails de vérification et de dialoguer avec la base de données.
*   **La Base de Données :** Une base SQLite locale (`database.db`). C'est un fichier unique qui contient les tables pour les utilisateurs (avec leurs tokens de sécurité) et leur historique.
*   **Le Frontend (Client) :** Une Single Page Application (SPA) contenue dans `chess.html`. Elle gère toute l'interface utilisateur, la logique d'entraînement, l'affichage de l'échiquier et les requêtes vers le serveur.

---

## 2. Les Outils et Librairies Utilisés

### Côté Backend (Node.js)
*   **Express.js :** Framework web pour créer le serveur et les routes API.
*   **better-sqlite3 :** Gestion rapide de la base de données SQLite.
*   **bcryptjs :** Hachage sécurisé des mots de passe.
*   **jsonwebtoken (JWT) :** Gestion des sessions utilisateurs via des jetons sécurisés.
*   **nodemailer :** Envoi d'emails réels (via SMTP) pour la vérification de compte et la récupération de mot de passe.
*   **dotenv :** Gestion des variables d'environnement (mots de passe SMTP, clés secrètes) via un fichier `.env`.
*   **express-rate-limit :** Protection contre les attaques par force brute sur les routes d'authentification.

### Côté Frontend (Navigateur)
*   **Chessground :** Librairie de Lichess pour l'affichage et l'interaction avec l'échiquier.
*   **chess.js :** Moteur de règles d'échecs (validation des coups, détection échec et mat).

---

## 3. Nouveau Système d'Authentification et Sécurité

Le système a été renforcé pour inclure des fonctionnalités de production :

### A. Inscription et Vérification d'Email
1.  L'utilisateur s'inscrit avec un pseudo, un email et un mot de passe.
2.  Le serveur crée le compte avec un `is_verified = 0` et génère un `verification_token` unique.
3.  Un email est envoyé à l'utilisateur via le service configuré dans le `.env`.
4.  L'utilisateur clique sur le lien, le serveur valide le token et active le compte (`is_verified = 1`).
5.  **Connexion impossible** tant que l'email n'est pas vérifié.

### B. Récupération de Mot de Passe
1.  L'utilisateur saisit son email dans la vue "Mot de passe oublié".
2.  Le serveur génère un `reset_token` et une date d'expiration (1 heure).
3.  Un email contenant le pseudo du compte et un lien spécial est envoyé.
4.  L'utilisateur choisit un nouveau mot de passe via ce lien sécurisé.

### C. Variables d'Environnement (`.env`)
Toutes les informations sensibles sont stockées dans le fichier `.env` (non suivi par Git pour la sécurité) :
*   `SMTP_USER` / `SMTP_PASS` : Identifiants de l'expéditeur de mails (ex: Gmail).
*   `JWT_SECRET` : Clé secrète pour signer les jetons de session.
*   `APP_URL` : L'adresse de votre site pour que les liens dans les mails pointent au bon endroit.

---

## 4. Structure des Fichiers Clés

*   `database.js` : Initialise SQLite et définit le schéma des tables `users` (avec colonnes email/tokens) et `history`.
*   `server.js` : Contient toute la logique API. Gère les inscriptions, les connexions, la vérification des tokens et le stockage de l'historique de révision.
*   `mailer.js` : Utilitaire central pour l'envoi de mails. Il bascule automatiquement en mode "Mock" (affichage dans la console) si aucun identifiant SMTP n'est configuré, facilitant le développement.
*   `chess.html` : 
    *   **Vues dynamiques :** Gère l'affichage des formulaires (Login, Register, Forgot, Reset) et du Dashboard.
    *   **Gestion des URLs :** Détecte automatiquement les paramètres `?verify=...` ou `?reset=...` dans l'adresse pour afficher la bonne interface à l'utilisateur.
    *   **Moteur d'entraînement :** Compare chaque coup joué par l'utilisateur à l'arbre théorique généré à partir du PGN Lichess.

---

## 5. Cycle de Vie des Données d'Entraînement

1.  **Chargement :** Le PGN est récupéré depuis Lichess et transformé en arbre de coups par `data.js`.
2.  **Pratique :** L'utilisateur joue ses coups. En mode **Révision**, les erreurs sont comptabilisées.
3.  **Calcul :** À la fin du chapitre, le score est calculé : `(Total coups - Erreurs) / Total coups`.
4.  **Persistance :** Le résultat est envoyé au serveur et stocké dans SQLite uniquement si la session est une "Révision" complète.
5.  **Visualisation :** Le Dashboard récupère ces données pour afficher la progression (dernière date de révision, taux de succès moyen, nombre de tentatives).
