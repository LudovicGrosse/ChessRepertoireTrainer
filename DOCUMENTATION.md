# Architecture et Fonctionnement : La Boîte à Ouvertures

Ce document détaille les choix techniques et l'architecture logicielle de l'application.

## 1. Vue d'Ensemble
L'application est une Single Page Application (SPA) robuste utilisant un backend Node.js. Elle permet aux utilisateurs de transformer des études Lichess (PGN) en un outil d'entraînement interactif avec suivi de progression.

## 2. Choix Technologiques (Stack Production)

### Backend
-   **Node.js & Express :** Serveur web asynchrone gérant l'API REST.
-   **PostgreSQL (Neon.tech) :** Choisi pour la production à la place de SQLite pour garantir la persistance des données sur les hébergeurs cloud comme Render.
-   **Brevo API (HTTP) :** Utilisé pour l'envoi d'emails transactionnels (activation, oubli de mot de passe) afin de contourner le blocage des ports SMTP (25, 465, 587) sur les offres gratuites de Render.

### Frontend
-   **Chessground :** Bibliothèque de rendu d'échiquier (la même que Lichess) pour une fluidité maximale.
-   **Chess.js :** Moteur de validation des règles d'échecs et gestion du format FEN/SAN.
-   **Vanilla JS :** Aucun framework lourd (React/Vue) n'est utilisé, garantissant un chargement instantané.

## 3. Mécanismes Clés

### Système de Cache (Performance)
Pour éviter de saturer l'API Lichess et offrir une navigation fluide, l'application utilise un cache intelligent :
-   Les données PGN et les calculs de coups sont stockés dans le **LocalStorage** du navigateur.
-   **Durée :** 1 heure.
-   **Forçage :** Un bouton "Synchroniser" permet de rafraîchir manuellement les données si l'utilisateur modifie son étude sur Lichess.

### Gestion des Mises à Jour (MAJ)
L'application compare le nombre de coups actuels sur Lichess avec les statistiques enregistrées lors de la dernière révision. Si une différence est détectée :
1.  Un badge **MAJ** apparaît sur le chapitre.
2.  Le taux de succès est ajusté proportionnellement (les nouveaux coups sont considérés comme non appris).

### Optimisation Mobile (UX)
-   **Échiquier Sticky :** L'échiquier reste visible en haut de l'écran pendant que l'utilisateur fait défiler la notation ou les commentaires.
-   **Scroll Ciblé :** La notation PGN défile dans son propre conteneur sans faire sauter la page web globale.

## 4. Sécurité
-   **Mots de passe :** Hachés avec BcryptJS (10 rounds).
-   **Sessions :** Authentification via JSON Web Tokens (JWT) stockés de manière sécurisée.
-   **Validation :** Double vérification des tokens par email avant activation du compte.
