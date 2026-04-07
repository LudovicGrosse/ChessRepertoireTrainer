const { test, expect } = require('@playwright/test');

test.describe('Training Engine Flow', () => {

  test.beforeEach(async ({ page }) => {
    // 1. Mock endpoints
    await page.route('/api/history', async route => {
      await route.fulfill({ status: 200, json: [] });
    });

    // 2. Mock a specific Lichess API study response
    await page.route('https://lichess.org/api/study/test1234.pgn?*', async route => {
      const pgn = `[Event "Chapter 1"]\n[Site "https://lichess.org/study/test1234/test"]\n[Result "*"]\n[Variant "Standard"]\n[ECO "C20"]\n[Opening "King's Pawn Game"]\n[Annotator "https://lichess.org/@/testuser"]\n[StudyName "My Test Study"]\n\n1. e4 e5`;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: pgn
      });
    });

    // 3. Inject mock auth token to bypass login UI
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('chess_token', 'fake-token');
      localStorage.setItem('chess_user', JSON.stringify({ id: 1, username: 'testuser' }));
    });
    // Reload to apply the token
    await page.reload();
  });

  test('should load a Lichess study and start training', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    // Wait for dashboard to be visible
    await expect(page.getByRole('heading', { name: 'Répertoires' })).toBeVisible();

    // Input the study ID
    await page.locator('#lichessInput').fill('test1234');
    
    // Click the load button
    await page.getByRole('button', { name: 'Charger le répertoire' }).click();

    // Verify study loaded successfully and the title is displayed
    await expect(page.getByText('Étude chargée avec succès')).toBeVisible();
    await expect(page.locator('#config-title')).toHaveText('Répertoire : My Test Study');

    // The single chapter should be automatically selected
    await expect(page.getByRole('button', { name: 'Démarrer l\'entraînement' })).toBeEnabled();

    // Click start
    await page.getByRole('button', { name: 'Démarrer l\'entraînement' }).click();

    // Verify the training view appears
    const trainingHeader = page.locator('#trainingHeader');
    await expect(trainingHeader).toBeVisible();
    await expect(trainingHeader).toContainText('My Test Study');
    await expect(trainingHeader).toContainText('Chapter 1');

    // Verify the Chessground board is drawn
    await expect(page.locator('cg-board')).toBeVisible();

    // Verify training controls are present
    await expect(page.getByRole('button', { name: 'Notes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Solution' })).toBeHidden(); // Hidden in Discovery mode
    await expect(page.getByRole('button', { name: 'Quitter' })).toBeVisible();

    // Click "Quitter"
    await page.getByRole('button', { name: 'Quitter' }).click();

    // Verify that we return to the setup/dashboard view
    await expect(page.locator('#setup-view')).toBeVisible();
    await expect(page.locator('#training-view')).toBeHidden();
  });
});
