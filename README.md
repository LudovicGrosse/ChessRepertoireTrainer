# Chess Repertoire Trainer

A lightweight, web-based tool designed to help chess players learn and practice their opening repertoires. This application allows users to load PGN files or Lichess studies and practice them in two modes: **Discovery** and **Revision**.

## 🚀 Features

-   **Lichess Integration:** Load any public Lichess study by simply pasting the URL or ID.
-   **PGN Support:** Paste your own PGN text (multi-chapter PGNs are supported).
-   **Multiple Training Modes:**
    -   **Discovery Mode:** Learn new lines with visual hints and arrows showing the correct moves.
    -   **Revision Mode:** Test your knowledge! Practice without hints and track your errors.
-   **Dual Perspective:** Train as either White or Black.
-   **Interactive Board:** Powered by [Chessground](https://github.com/lichess-org/chessground) and [chess.js](https://github.com/jhlywa/chess.js), providing a smooth and responsive experience similar to Lichess.
-   **Progress Tracking:** Monitor your progress through variations and chapters with real-time statistics.
-   **Move Comments & Annotations:** View PGN comments and notes directly during training.
-   **Analysis Link:** Quickly jump to the Lichess analysis board for any position.

## 🛠️ Installation & Setup

The project consists of a simple Node.js static file server and a client-side web application.

### Prerequisites

-   [Node.js](https://nodejs.org/) installed on your system.

### Running the Application

1.  Clone or download this repository.
2.  Open a terminal in the project directory.
3.  Start the local server:
    ```bash
    node server.js
    ```
4.  Open your browser and navigate to: `http://localhost:3000`

## 📖 How to Use

1.  **Select Source:** Choose between "Étude Lichess" (Lichess Study) or "Coller un PGN" (Paste PGN).
2.  **Load Content:** Enter the URL/ID or paste your PGN and click **"Charger le répertoire"**.
3.  **Configure:**
    -   Select the side you want to train (**Blancs** or **Noirs**).
    -   Choose the mode (**Découverte** or **Révision**).
    -   Select a specific chapter if the repertoire contains multiple.
4.  **Train:** Click **"Démarrer l'entraînement"** and start making moves on the board!

## 📂 Project Structure

-   `chess.html`: The main user interface and application logic.
-   `data.js`: Handles PGN parsing and tree building for the repertoire.
-   `server.js`: A minimal Node.js server to serve the static files and handle CORS for Lichess API calls.

## 📜 License

This project is open-source and available under the MIT License.
