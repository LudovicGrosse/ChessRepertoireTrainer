# Testing Documentation

This project follows the **Testing Pyramid** principles to ensure high reliability, maintainability, and fast execution.

## 1. Unit Tests (Logic & Utilities)
**Tool:** Jest  
**Execution:** `npm test`  
**Location:** `__tests__/frontend/` and `__tests__/backend/`

Focuses on pure functions and business logic without side effects (no network, no database).

### Frontend Utilities (`public/js/utils.js`)
- **Lichess ID Extraction:** Validates that `extractStudyId` correctly parses IDs from full URLs, chapter URLs, or raw strings.
- **Date Formatting:** Ensures `formatRelativeTime` returns human-readable strings like "2 days ago" or "Just now".

### PGN & Data Engine (`public/js/data.js`)
- **Multi-PGN Parsing:** Validates that the engine can split a Lichess study into multiple chapters correctly.
- **Move Tree Construction:** Verifies that the PGN string is correctly converted into a tree of chess nodes for the training engine.

### Backend Extraction (`server/extractor.js`)
- **Game End Parsing:** Ensures the server can correctly identify the end of a PGN sequence.

---

## 2. Integration Tests (API & Database)
**Tool:** Jest + Supertest  
**Execution:** `npm test`  
**Location:** `__tests__/*.test.js`

Focuses on communication between the server and the (mocked) database.

### Authentication API (`/api/auth`)
- **Registration:** Tests successful signup, duplicate email handling (400), and password hashing.
- **Login:** Verifies JWT token issuance and credential validation.
- **Email Verification:** Mocks the mailer to test the verification token flow.

### History API (`/api/history`)
- **Persistence:** Tests saving and retrieving training sessions.
- **Authorization:** Ensures that history data is protected by JWT and users can only access their own data.

---

## 3. End-to-End (E2E) Tests (User Interface)
**Tool:** Playwright  
**Execution:** `npx playwright test`  
**Location:** `tests/e2e/`

Simulates a real user interacting with the application in a headless browser (Chromium/Firefox/WebKit).

### Authentication Flow (`auth.spec.js`)
- **Sign-up to Dashboard:** Automates the process of creating an account, receiving a success message, and logging in to reach the main interface.

### Training Workflow (`training.spec.js`)
- **Study Loading:** Simulates entering a Lichess Study ID, clicking "Load", and verifying the chapters are displayed.
- **Board Rendering:** Verifies that the **Chessground** board is correctly drawn on the screen after starting a session.
- **Training Controls:** Tests the "Notes" and "Quit" buttons to ensure the UI transitions correctly.

### Dashboard Management (`dashboard.spec.js`)
- **Repertoire Display:** Verifies that saved repertoires are visible in the history list.
- **Deletion:** Tests the full flow of expanding a repertoire accordion and deleting it from the UI.

---

## CI/CD Integration
All tests are automatically executed on every **Push** or **Pull Request** via **GitHub Actions** (Node.js 20, 22, 24).
- **Backend/Unit:** Must pass for a successful build.
- **E2E:** Generates an HTML report as a GitHub Artifact in case of failure for visual debugging.
