const { test, expect } = require('@playwright/test');

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Registration Endpoint
    await page.route('/api/register', async (route) => {
      const body = route.request().postDataJSON();
      if (body.username === 'testuser' && body.email === 'test@example.com') {
        await route.fulfill({
          status: 201,
          json: { message: 'Compte créé ! Veuillez vérifier votre boîte mail.' },
        });
      } else {
        await route.fulfill({ status: 400, json: { error: 'Erreur' } });
      }
    });

    // Mock Login Endpoint
    await page.route('/api/login', async (route) => {
      const body = route.request().postDataJSON();
      if (body.username === 'testuser' && body.password === 'password123') {
        await route.fulfill({
          status: 200,
          json: {
            token: 'fake-jwt-token',
            user: { id: 1, username: 'testuser' },
          },
        });
      } else {
        await route.fulfill({ status: 401, json: { error: 'Identifiants invalides.' } });
      }
    });

    // Mock History Endpoint (used when logging in)
    await page.route('/api/history', async (route) => {
      await route.fulfill({ status: 200, json: [] });
    });
  });

  test('should register and login successfully', async ({ page }) => {
    // Go to homepage
    await page.goto('/');

    // Expect the page to show the Auth Section
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

    // 1. REGISTER
    await page.getByText('Créer un compte').click();
    await expect(page.getByRole('heading', { name: 'Inscription' })).toBeVisible();

    // Fill form
    await page.locator('#regUsername').fill('testuser');
    await page.locator('#regEmail').fill('test@example.com');
    await page.locator('#regPassword').fill('password123');
    await page.getByRole('button', { name: "S'inscrire" }).click();

    // Expect success toast
    await expect(page.getByText('Compte créé ! Veuillez vérifier votre boîte mail.')).toBeVisible();

    // App automatically returns to Login view after registration success
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

    // 2. LOGIN
    await page.locator('#loginUsername').fill('testuser');
    await page.locator('#loginPassword').fill('password123');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Expect success toast and dashboard
    await expect(page.getByText('Connexion réussie')).toBeVisible();

    // Expect to see user greeting and dashboard titles
    await expect(page.locator('#displayUsername')).toHaveText('testuser');
    await expect(page.getByRole('heading', { name: 'Répertoires' })).toBeVisible();
  });
});
