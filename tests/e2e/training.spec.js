const { test, expect } = require('@playwright/test');

test.describe('Training Engine Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock endpoints
    await page.route('/api/history', async (route) => {
      await route.fulfill({ status: 200, json: [] });
    });

    let added = false;
    await page.route('/api/repertoires', async (route) => {
      if (route.request().method() === 'POST') {
        added = true;
        await route.fulfill({ status: 201, json: { message: 'Created' } });
      } else if (route.request().method() === 'GET') {
        if (added) {
          await route.fulfill({
            status: 200,
            json: [
              {
                id: 1,
                user_id: 1,
                study_id: 'test1234',
                color: 'white',
                title: 'My Test Study',
                total_chapters: 1,
                added_at: new Date().toISOString(),
              },
            ],
          });
        } else {
          await route.fulfill({ status: 200, json: [] });
        }
      } else {
        await route.continue();
      }
    });

    // 2. Mock a specific Lichess API study response
    await page.route('https://lichess.org/api/study/test1234.pgn?*', async (route) => {
      const pgn = `[Event "Chapter 1"]\n[Site "https://lichess.org/study/test1234/test"]\n[Result "*"]\n[Variant "Standard"]\n[ECO "C20"]\n[Opening "King's Pawn Game"]\n[Annotator "https://lichess.org/@/testuser"]\n[StudyName "My Test Study"]\n\n1. e4 e5`;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: pgn,
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

  test('should load a Lichess study, add it to repertoires, and start training', async ({
    page,
  }) => {
    page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

    // Wait for dashboard to be visible
    await expect(page.getByRole('heading', { name: 'Répertoires' })).toBeVisible();

    // Input the study ID
    await page.locator('#lichessInput').fill('test1234');

    // Click the load button
    await page.getByRole('button', { name: "Charger l'étude" }).click();

    // Verify study loaded successfully and the title is displayed
    await expect(
      page.getByText("Étude chargée avec succès, vous pouvez maintenant l'ajouter.")
    ).toBeVisible();
    await expect(page.locator('#config-title')).toHaveText('Répertoire : My Test Study');

    // Click Add
    await page.getByRole('button', { name: 'Ajouter au répertoire' }).click();

    // Verify added successfully
    await expect(page.getByText('Répertoire ajouté avec succès')).toBeVisible();

    // The repertoire should now be in the dashboard list, click it
    await page.locator('.repertoire-header').first().click();
    await expect(page.locator('.chapters-detail')).toHaveClass(/open/);

    // Click the chapter row to expand actions
    await page.getByText('Chapter 1').click();

    // Click Mode découverte
    await page.getByRole('button', { name: 'Mode découverte' }).click();

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
