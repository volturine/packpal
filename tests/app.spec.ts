import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
	test('displays landing page with CTA', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('body')).toBeVisible();
		await expect(page.locator('a[href="/app"]').first()).toBeVisible();
	});
});

test.describe('Auth Flow', () => {
	const testUser = `testuser_${Date.now()}`;
	const testPassword = 'TestPass123!';

	test('shows login form on /app', async ({ page }) => {
		await page.goto('/app');
		await expect(page.locator('input#username')).toBeVisible();
		await expect(page.locator('input#password')).toBeVisible();
	});

	test('can register a new user', async ({ page }) => {
		await page.goto('/app');
		await page.getByRole('button', { name: 'Sign up' }).click();
		await page.locator('input#username').fill(testUser);
		await page.locator('input#password').fill(testPassword);
		await page.getByRole('button', { name: 'Create Account' }).click();
		await expect(page.getByText('No trips yet')).toBeVisible({ timeout: 5000 });
	});

	test('can login with existing user', async ({ page }) => {
		await page.goto('/app');
		await page.getByRole('button', { name: 'Sign up' }).click();
		await page.locator('input#username').fill(testUser + '_login');
		await page.locator('input#password').fill(testPassword);
		await page.getByRole('button', { name: 'Create Account' }).click();
		await expect(page.getByText('No trips yet')).toBeVisible({ timeout: 5000 });

		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page.locator('input#username')).toBeVisible({ timeout: 5000 });
		await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();

		await page.locator('input#username').fill(testUser + '_login');
		await page.locator('input#password').fill(testPassword);
		await page.getByRole('button', { name: 'Sign In', exact: true }).click();
		await expect(page.getByText('No trips yet')).toBeVisible({ timeout: 5000 });
	});

	test('shows error for wrong password', async ({ page }) => {
		await page.goto('/app');
		await page.locator('input#username').fill('nonexistent_user_xyz');
		await page.locator('input#password').fill('wrongpass');
		await page.getByRole('button', { name: 'Sign In' }).click();
		await expect(page.getByText(/Invalid|not found|error/i)).toBeVisible({ timeout: 5000 });
	});
});

test.describe('Trip CRUD', () => {
	const testPassword = 'TestPass123!';
	const tripName = 'Summer in Lisbon';
	const editedTripName = 'Updated Lisbon Adventure';

	test.beforeEach(async ({ page }, testInfo) => {
		const testUser = `tripuser_${Date.now()}_${testInfo.retry}_${testInfo.title.replace(/\W+/g, '_')}`;
		await page.goto('/app');
		await page.getByRole('button', { name: 'Sign up' }).click();
		await page.locator('input#username').fill(testUser);
		await page.locator('input#password').fill(testPassword);
		await page.getByRole('button', { name: 'Create Account' }).click();
		await expect(page.getByText('No trips yet')).toBeVisible({ timeout: 5000 });
	});

	test('can navigate to new trip wizard', async ({ page }) => {
		await page.getByRole('link', { name: /new trip/i }).click();
		await expect(page).toHaveURL(/\/app\/trips\/new/);
	});

	test('can create and manage a trip with new dashboard and packing flows', async ({ page }) => {
		await page.getByRole('link', { name: /new trip/i }).click();
		await expect(page).toHaveURL(/\/app\/trips\/new/);

		await page.locator('#name').fill(tripName);
		await page.locator('#destination').fill('Lisbon');
		await page.locator('#country').fill('Portugal');
		await page.locator('#start-date').fill('2026-07-10');
		await page.locator('#end-date').fill('2026-07-14');
		await page.locator('#travelers').fill('2');
		await page.locator('#notes').fill('Need room for souvenirs');
		await page.getByRole('button', { name: /next: activities & preset/i }).click();

		await page.getByRole('button', { name: /city break/i }).click();
		await page.getByRole('button', { name: /food & culinary tour/i }).click();
		await page.getByRole('button', { name: /next: review/i }).click();

		await expect(page.getByText(tripName)).toBeVisible();
		await page.getByRole('button', { name: /create trip & generate list/i }).click();

		await expect(page).toHaveURL(/\/app\/trips\/[a-f0-9]+$/);
		await expect(page.getByRole('heading', { name: tripName })).toBeVisible({ timeout: 5000 });
		await expect(page.getByText('Lisbon, Portugal')).toBeVisible();
		await expect(page.getByText('2 travelers')).toBeVisible();
		await expect(page.getByText('Need room for souvenirs')).toBeVisible();

		await page.getByRole('button', { name: /edit details/i }).click();
		await page.locator('#trip-name').fill(editedTripName);
		await page.locator('#trip-destination').fill('Porto');
		await page.locator('#trip-country').fill('Portugal');
		await page.locator('#trip-climate').selectOption('cold');
		await page.locator('#trip-travelers').fill('3');
		await page.locator('#trip-notes').fill('Bring an extra tote bag');
		await page.getByRole('button', { name: /skiing/i }).click();
		await page.getByRole('button', { name: /^save changes$/i }).click();

		await expect(page.getByRole('heading', { name: editedTripName })).toBeVisible();
		await expect(page.getByText('Porto, Portugal')).toBeVisible();
		await expect(page.getByText('3 travelers')).toBeVisible();
		await expect(page.getByText(/climate:/i)).toContainText('cold');
		await expect(page.getByText('Skiing')).toBeVisible();
		await expect(page.getByText('Bring an extra tote bag')).toBeVisible();
		await expect(page.getByText(/Packing warnings/i)).toBeVisible();

		await page.locator('button:has-text("+ Add Item")').click();
		await page.locator('#new-item-name').fill('Reusable shopping bag');
		await page.locator('#new-item-category').selectOption('Travel Essentials');
		await page.locator('#new-item-qty').fill('1');
		await page.getByRole('combobox').last().selectOption('must');
		await page.getByRole('button', { name: /^add$/i }).first().click();
		await expect(page.getByText('Reusable shopping bag')).toBeVisible();
		await expect(
			page
				.locator('span')
				.filter({ hasText: /^must$/ })
				.first()
		).toBeVisible();

		await page.getByRole('button', { name: 'Edit item' }).last().click();
		await page.locator('input[placeholder="Optional note"]').fill('Use for souvenirs');
		await page
			.getByRole('button', { name: /^save$/i })
			.first()
			.click();
		await expect(page.getByText('Use for souvenirs')).toBeVisible();

		const progressSummary = page.getByText(/\d+ of \d+ items packed/).first();
		const totalItems = Number(
			((await progressSummary.textContent()) ?? '').match(/of (\d+) items packed/)?.[1]
		);
		expect(totalItems).toBeGreaterThan(0);

		await page.getByRole('button', { name: 'Pack Visible', exact: true }).click();
		await expect(progressSummary).toHaveText(`${totalItems} of ${totalItems} items packed`);
		await expect(page.getByText("All packed! You're ready to go!")).toBeVisible();

		await page.getByRole('link', { name: /back to trips/i }).click();
		await expect(page).toHaveURL(/\/app$/);
		await expect(page.getByText(`${totalItems}/${totalItems} packed`)).toBeVisible();
		await expect(page.getByText('100%')).toBeVisible();

		await page.getByRole('link', { name: 'Open Trip' }).first().click();
		await expect(page).toHaveURL(/\/app\/trips\/[a-f0-9]+$/);
		await page.getByRole('button', { name: 'Unpack Visible', exact: true }).click();
		await expect(progressSummary).toHaveText(`0 of ${totalItems} items packed`);

		await page.getByRole('button', { name: /enable day-of-travel mode/i }).click();
		await expect(page.getByText(/day-of-travel sorting enabled/i)).toBeVisible();

		await page.locator('input[placeholder="username"]').fill('missing_user');
		await page.getByRole('button', { name: /^add$/i }).click();
		await expect(page.getByText(/user not found/i)).toBeVisible();

		await page.locator('input[placeholder="Preset name"]').fill('Souvenir preset');
		await page.getByRole('button', { name: /^save$/i }).click();
		await expect(page.getByText('Souvenir preset')).toBeVisible();

		await page.getByRole('link', { name: /ai assistant/i }).click();
		await expect(page).toHaveURL(/\/chat$/);
		await expect(page.getByText(/Trip brief/i)).toBeVisible();

		page.once('dialog', (dialog) => dialog.accept());
		await page.goto(page.url().replace(/\/chat$/, ''));
		await page.getByRole('button', { name: /delete trip/i }).click();
		await expect(page).toHaveURL(/\/app$/);
		await expect(page.getByText(editedTripName)).toHaveCount(0);
	});
});
