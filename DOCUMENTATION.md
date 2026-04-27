# Architecture et Fonctionnement : La Boîte à Ouvertures

Ce document détaille les choix techniques et l'architecture logicielle de l'application.

## 1. Vue d'Ensemble

L'application est une Single Page Application (SPA) robuste utilisant un backend Node.js. Elle permet aux utilisateurs de transformer des études Lichess publiques ou privées (via connexion de compte) en un outil d'entraînement interactif avec suivi de progression.

## 2. Choix Technologiques (Stack Production)

### Backend

- **Node.js & Express :** Serveur web asynchrone gérant l'API REST.
- **PostgreSQL (Neon.tech / Render) :** Choisi pour la production à la place de SQLite pour garantir la persistance des données sur les hébergeurs cloud.
- **Brevo API (HTTP) :** Utilisé pour l'envoi d'emails transactionnels (activation, oubli de mot de passe) afin de contourner le blocage des ports SMTP sur les offres gratuites de Render.
- **Sécurité :** Helmet (En-têtes sécurisés, CSP), Express-Validator (Validation des entrées), Express-Rate-Limit (Limitation des requêtes pour prévenir les abus API).

### Frontend

- **Chessground :** Bibliothèque de rendu d'échiquier (la même que Lichess) pour une fluidité maximale.
- **Chess.js :** Moteur de validation des règles d'échecs et gestion du format FEN/SAN.
- **Vanilla JS :** Aucun framework lourd (React/Vue) n'est utilisé, garantissant un chargement instantané.

## 3. Mécanismes Clés

### Intégration Lichess (OAuth PKCE & Proxy)

- L'application utilise le flux **OAuth2 PKCE** pour s'authentifier auprès de Lichess sans nécessiter de `Client Secret` côté backend, ce qui permet l'accès aux études privées de l'utilisateur.
- Les requêtes PGN passent par un **proxy backend** (`/api/lichess/study/`) pour intégrer silencieusement le jeton Lichess d'accès de l'utilisateur, tout en évitant les problèmes de requêtes directes côté navigateur et les blocages CORS.

### Système de Cache (Performance)

Pour éviter de saturer l'API Lichess et offrir une navigation fluide, l'application utilise un cache intelligent :

- Les données PGN et les calculs de coups sont stockés dans le **LocalStorage** du navigateur.
- **Durée :** 1 heure.
- Le serveur backend gère lui une limitation de requêtes stricte (`lichessLimiter`) pour éviter le bannissement de l'API externe par des utilisateurs abusifs.

### Gestion des Mises à Jour (MAJ)

L'application compare le nombre de coups actuels sur Lichess avec les statistiques enregistrées lors de la dernière révision. Si une différence est détectée :

1.  Un badge **MAJ** apparaît sur le chapitre.
2.  Le taux de succès est ajusté proportionnellement.

### Optimisation Mobile (UX)

- **Échiquier Sticky :** L'échiquier reste visible en haut de l'écran pendant que l'utilisateur fait défiler la notation ou les commentaires.
- **Modales adaptatives :** Les menus Paramètres et Aide s'affichent sous forme de superpositions plein écran sur mobile.

## 4. Sécurité

- **Mots de passe :** Hachés avec BcryptJS (10 rounds).
- **Sessions :** Authentification via JSON Web Tokens (JWT) stockés de manière sécurisée (LocalStorage).
- **Validation :** Double vérification des tokens par email avant activation du compte.
- **Suppression du Compte :** Demande de mot de passe avant suppression définitive (suppression en cascade des répertoires et de l'historique de la BDD).
- **Limitation d'accès (Rate Limit) :** Appliquée sur la création de compte, connexion, mot de passe oublié et les appels à l'API Lichess.
