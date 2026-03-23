# Chess Repertoire Trainer

A full-stack, web-based tool designed to help chess players build, learn, and track their opening repertoires directly from Lichess studies. 

This application provides a personalized experience where users can log in, practice lines, and monitor their learning progress over time through an interactive dashboard.

## 🚀 Features

-   **User Authentication:** Secure login and registration system with JWT session management.
-   **Email Verification:** New accounts require email verification via a clickable link sent automatically after registration.
-   **Password Recovery:** Secure "Forgot Password" functionality that sends a 1-hour valid reset link to the user's email.
-   **Lichess Integration:** Seamlessly load any public Lichess study by pasting its URL or ID. The app automatically extracts the real study name and all chapters.
-   **Interactive Dashboard:** 
    -   Track all your loaded repertoires, grouped by color.
    -   View detailed statistics for every chapter: last revision date, total revisions, and success percentages.
    -   **One-Click Re-launch:** Instantly reload a specific chapter from your history to practice it again.
-   **Multiple Training Modes:**
    -   **Discovery Mode:** Learn new lines with visual hints and arrows showing the correct moves.
    -   **Revision Mode:** Test your knowledge! Practice without hints. Only successfully completed revision sessions are logged into your success statistics.
-   **Dynamic Navigation:** Easily switch between Revision and Discovery modes or jump to the next chapter directly from the training completion screen.
-   **Dual Perspective:** Train as either White or Black.
-   **Interactive Board:** Powered by [Chessground](https://github.com/lichess-org/chessground) and [chess.js](https://github.com/jhlywa/chess.js), providing a smooth, Lichess-like experience.

## 🛠️ Installation & Setup

The project uses a Node.js/Express backend with a local SQLite database for zero-config persistence.

### Prerequisites

-   [Node.js](https://nodejs.org/) installed on your system.

### Running the Application

1.  Clone or download this repository.
2.  Open a terminal in the project directory.
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  **Configure Environment Variables:**
    -   Copy `.env.example` to `.env`.
    -   Fill in your SMTP credentials (e.g., Gmail App Password) to enable email features.
5.  Start the local server:
    ```bash
    npm start
    ```
6.  Open your browser and navigate to: `http://localhost:3000`

## 📖 How to Use

1.  **Register:** Create an account with your email.
2.  **Verify:** Check your email (or terminal in mock mode) and click the verification link.
3.  **Log In:** Access your dashboard with your verified account.
4.  **Load Content:** Enter a Lichess Study URL and click **"Charger le répertoire"**.
5.  **Configure:** Select side, mode, and chapter.
6.  **Train:** Click **"Démarrer l'entraînement"**. Follow the moves or test your memory.
7.  **Review:** After a session, check your Dashboard to see your updated success rate and history.

## 📂 Project Structure

-   `server.js`: The Express.js backend handling API routes, JWT authentication, and database queries.
-   `database.js`: SQLite database initialization and schema definitions (`users` and `history` tables).
-   `mailer.js`: Email utility using `nodemailer` for verification and password reset.
-   `chess.html`: The main frontend SPA containing the UI, routing logic, and training engine.
-   `data.js`: Handles PGN parsing and tree building for the repertoire navigation.
-   `.env`: Local configuration for SMTP and JWT secrets (ignored by git).

## 📜 License

This project is open-source and available under the MIT License.
