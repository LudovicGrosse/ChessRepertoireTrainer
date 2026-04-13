const { test, expect } = require('@playwright/test');

test.describe('Dashboard Management', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock endpoints
    await page.route('/api/history', async (route) => {
      const history = [
        {
          id: 1,
          user_id: 1,
          study_id: 'test1234',
          repertoire_title: 'My Test Study',
          chapter_title: 'Chapter 1',
          player_color: 'white', // Backend uses player_color or color? Let's check dashboard.js
          color: 'white',
          is_revision: 1,
          total_moves: 10,
          errors: 0,
          date: new Date().toISOString(),
          total_chapters: 1,
        },
      ];
      await route.fulfill({ status: 200, json: history });
    });

    // Mock Lichess API for the expansion
    await page.route('https://lichess.org/api/study/test1234.pgn?*', async (route) => {
      const pgn = `[Event "Chapter 1"]\n[Site "https://lichess.org/study/test1234/test"]\n[Result "*"]\n[Variant "Standard"]\n[ECO "C20"]\n[Opening "King's Pawn Game"]\n[Annotator "https://lichess.org/@/testuser"]\n[StudyName "My Test Study"]\n\n1. e4 e5`;
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: pgn,
      });
    });

    // 2. Inject mock auth token to bypass login UI
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('chess_token', 'fake-token');
      localStorage.setItem('chess_user', JSON.stringify({ id: 1, username: 'testuser' }));
    });
    // Reload to apply the token
    await page.reload();
  });

  test('should display and delete a repertoire', async ({ page }) => {
    // 3. Verify the repertoire s'affiche
    await expect(page.getByText('My Test Study')).toBeVisible();
    await expect(page.getByText('(1 chapitre)')).toBeVisible();

    // 4. Déplier le répertoire (cliquer sur l'accordéon)
    await page.locator('.repertoire-header').first().click();

    // Verify detail is visible
    await expect(page.locator('.chapters-detail')).toHaveClass(/open/);
    await expect(page.getByText('Chapter 1')).toBeVisible();

    // 5. Handle the confirm dialog before clicking delete
    page.on('dialog', (dialog) => dialog.accept());

    // 6. Mocker la requête DELETE
    let deleteCalled = false;
    await page.route('/api/history/repertoire?study_id=test1234&color=white', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        await route.fulfill({ status: 200, json: { message: 'Supprimé' } });
      } else {
        await route.continue();
      }
    });

    // 7. Mock history again to return empty after delete
    await page.route(
      '/api/history',
      async (route) => {
        if (deleteCalled) {
          await route.fulfill({ status: 200, json: [] });
        } else {
          // This might not be needed if we don't reload, but fetchHistory() is called after delete
          const history = [
            {
              id: 1,
              user_id: 1,
              study_id: 'test1234',
              repertoire_title: 'My Test Study',
              chapter_title: 'Chapter 1',
              color: 'white',
              is_revision: 1,
              total_moves: 10,
              errors: 0,
              date: new Date().toISOString(),
              total_chapters: 1,
            },
          ];
          await route.fulfill({ status: 200, json: history });
        }
      },
      { times: 2 }
    ); // Allow it to be called again

    // Click "Supprimer"
    await page.getByRole('button', { name: 'Supprimer' }).click();

    // 8. Vérifier que le répertoire disparaît visuellement
    await expect(page.getByText('Répertoire supprimé')).toBeVisible();
    await expect(page.getByText('Aucun historique.')).toBeVisible();
    await expect(page.getByText('My Test Study')).toBeHidden();
  });
});
