# Test Suite Specifications

This project implements a multi-layered testing strategy to ensure reliability across the entire application stack.

## 1. Unit & Integration Tests (Backend & Logic)
**Framework:** Jest | **Execution:** `npm test` | **Environment:** Node.js / JSDOM

### 1.1 Authentication & User Management (`__tests__/auth.test.js`)
1.  **POST /api/register** - Successfully creates a new user and sends a verification email.
2.  **POST /api/register (Conflict)** - Returns 400 when attempting to register an existing email/username.
3.  **POST /api/login (Success)** - Returns a valid JWT token and user object for correct credentials.
4.  **POST /api/login (Failure)** - Returns 401 for incorrect password or non-existent user.
5.  **GET /api/verify-email/:token** - Successfully verifies a user account via a valid token.

### 1.2 Training History API (`__tests__/history.test.js`)
6.  **POST /api/history** - Persists a new training session for an authenticated user.
7.  **GET /api/history** - Retrieves the complete training history for the logged-in user.
8.  **DELETE /api/history/repertoire** - Removes all history records for a specific Lichess study ID.

### 1.3 Logic & Utilities (`__tests__/frontend/` & `__tests__/backend/`)
9.  **extractStudyId (Full URL)** - Parses study ID from standard Lichess study links.
10. **extractStudyId (Chapter URL)** - Parses study ID correctly even from specific chapter links.
11. **extractStudyId (Raw ID)** - Returns the input unchanged if a raw ID is provided.
12. **formatRelativeTime (Recent)** - Returns "À l'instant" for timestamps within the last minute.
13. **formatRelativeTime (Days)** - Returns "Il y a X jours" for older timestamps.
14. **parseMultiPgn (Chapters)** - Correctly splits a multi-chapter PGN into individual chapter objects.
15. **parseMultiPgn (Metadata)** - Extracts [StudyName] and [Event] tags accurately.
16. **buildRepertoireTree (Structure)** - Converts a PGN string into a valid recursive tree of chess moves.
17. **buildRepertoireTree (Colors)** - Assigns correct player colors to each node in the move tree.
18. **extractGameEndPgn** - Identifies and extracts the final move and result from a PGN sequence.

---

## 2. End-to-End Interactive Tests (UI & UX)
**Framework:** Playwright | **Execution:** `npx playwright test` | **Environment:** Headless Browsers

### 2.1 User Flows (`tests/e2e/auth.spec.js`)
19. **Registration & Login Flow** - Simulates full user signup, automated redirect, and successful login.

### 2.2 Dashboard Interactions (`tests/e2e/dashboard.spec.js`)
20. **Repertoire Management** - Validates the UI's ability to display, expand, and delete a repertoire accordion.

### 2.3 Training Engine (`tests/e2e/training.spec.js`)
21. **Study Loading** - Verifies that entering a Lichess ID correctly renders the study title and chapter list.
22. **Chessboard Rendering** - Confirms the **Chessground** board is visible and interactive after starting training.
23. **Session Termination** - Tests the "Quit" button to ensure clean exit from training back to the dashboard.

---

## CI/CD Automation
Tests are automatically triggered on every push to `master` or `deploy-online` via GitHub Actions across Node.js versions 20, 22, and 24. Failure in any test prevents deployment.
