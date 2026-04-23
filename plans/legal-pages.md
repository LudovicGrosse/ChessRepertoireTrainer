# Plan : Pages Légales

## 1. Objectifs

Mettre en place une page statique dédiée aux Mentions Légales, à la Politique de Confidentialité (RGPD) et aux Conditions Générales d'Utilisation (CGU).

## 2. Contenu à rédiger

- **Contact:** `chessrepertoiretrainer@gmail.com`
- **Hébergement:** Serveur et Base de données hébergés sur Render (selon localisation du service Render).
- **Propriété intellectuelle:** Le code source du projet **n'est pas open source**. Crédits accordés aux librairies open source tierces (Chessground, Chess.js).
- **Politique de confidentialité:**
  - Données collectées (email, mot de passe haché, Lichess OAuth, historique).
  - Utilisation strictement fonctionnelle.
  - Tiers (Lichess, Brevo).
  - Suppression totale des données à la suppression du compte.
- **CGU:** Service fourni "en l'état" (best effort), pas de garantie de disponibilité continue.

## 3. Intégration technique (Option B choisie)

- **Fichier HTML:** Création du fichier `public/legal.html`.
  - Intégrera les mêmes polices et styles de base (`public/css/style.css`).
  - Bouton de retour vers l'application (`/`).
- **Lien depuis l'application:**
  - Ajout d'un pied de page (Footer) discret sur l'écran d'accueil/connexion (`public/index.html`) contenant le lien vers `/legal.html`.
  - Pas d'impact sur le routage du serveur backend puisque `express.static` servira le fichier directement.

## 4. Étapes de validation

- Linting/Formatting (`npm run lint:fix`, `npm run format`).
- Validation visuelle.
