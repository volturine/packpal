import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';

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
	const tripName = 'Summer in Lisbon';
	const editedTripName = 'Updated Lisbon Adventure';

	test.beforeEach(async ({ page, baseURL }, testInfo) => {
		// Auth has its own UI tests. Seed a session for these independent trip tests
		// so adding cases cannot exhaust the public registration rate limit.
		await page.request.get('/api/auth/me');
		const testUser = `tripuser_${Date.now()}_${testInfo.retry}_${testInfo.title.replace(/\W+/g, '_')}`;
		const userId = randomBytes(16).toString('hex');
		const sessionId = randomBytes(16).toString('hex');
		const sqlite = new Database('data/packpal-test.db', { fileMustExist: true });
		try {
			sqlite
				.prepare(
					'INSERT INTO users (id,username,password_hash,display_name,created_at) VALUES (?,?,?,?,?)'
				)
				.run(userId, testUser, 'unused-test-password', testUser, Date.now());
			sqlite
				.prepare('INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)')
				.run(sessionId, userId, Date.now() + 3_600_000);
		} finally {
			sqlite.close();
		}
		await page.context().addCookies([
			{
				name: 'packpal_session',
				value: sessionId,
				url: baseURL!,
				httpOnly: true,
				sameSite: 'Lax'
			}
		]);
		await page.goto('/app');
		await expect(page.getByText('No trips yet')).toBeVisible({ timeout: 5000 });
	});

	test('can navigate to new trip wizard', async ({ page }) => {
		await page.getByRole('link', { name: /new trip/i }).click();
		await expect(page).toHaveURL(/\/app\/trips\/new/);
	});

	test('a checkout return cannot create free AI credit', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('link', { name: 'AI credits', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'AI credits', exact: true })).toBeVisible();
		await page.goto('/app/billing?checkout=success');
		await expect(
			page.getByText('Payment processing; credits appear after payment confirmation.')
		).toBeVisible();
		await expect(page.getByText('No credit activity yet.')).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		const response = await page.request.get('/api/billing');
		expect(response.ok()).toBeTruthy();
		expect((await response.json()).balanceMicroUsd).toBe(0);
	});

	test('shows credit history guidance when an AI request is uncertain', async ({ page }) => {
		const tripResponse = await page.request.post('/api/trips', {
			data: {
				name: 'Pending response trip',
				destination: 'Reykjavik',
				country: 'Iceland',
				startDate: Date.now(),
				endDate: Date.now() + 86_400_000,
				activities: ['hiking'],
				climate: 'cold',
				travelers: 1
			}
		});
		expect(tripResponse.ok()).toBeTruthy();
		const tripResult = (await tripResponse.json()) as { id: string };
		expect(tripResult.id).toBeTruthy();

		const serverWarning =
			'The AI request could not be confirmed. Its credit hold is pending review.';
		const fundedLiveBillingSummary = {
			mode: 'live',
			currency: 'usd',
			priceMultiplier: 2,
			minimumTopupCents: 500,
			maximumTopupCents: 10000,
			reservationMicroUsd: 300_000,
			checkoutEnabled: true,
			aiEnabled: true,
			balanceMicroUsd: 1_000_000,
			heldMicroUsd: 0,
			purchases: [],
			requests: []
		};
		let chatRequestCount = 0;
		await page.route('**/api/billing', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(fundedLiveBillingSummary)
			})
		);
		await page.route('**/api/chat', async (route) => {
			chatRequestCount += 1;
			await route.fulfill({
				status: 502,
				contentType: 'application/json',
				body: JSON.stringify({ error: serverWarning })
			});
		});

		await page.goto(`/app/trips/${tripResult.id}/chat`);
		const messageInput = page.getByRole('textbox', { name: 'Ask PackPal AI about your trip' });
		await expect(messageInput).toBeEnabled();
		await messageInput.fill('What should I pack?');
		await page.getByRole('button', { name: 'Send', exact: true }).click();

		const feedback = page.getByRole('alert');
		await expect(feedback).toContainText(serverWarning);
		await expect(feedback.getByRole('link', { name: 'View credit history' })).toHaveAttribute(
			'href',
			'/app/billing'
		);
		await expect(messageInput).toBeEnabled();
		expect(chatRequestCount).toBe(1);

		const messagesResponse = await page.request.get(`/api/chat-messages?tripId=${tripResult.id}`);
		expect(messagesResponse.ok()).toBeTruthy();
		const chatData = (await messagesResponse.json()) as {
			messages: { role: string; content: string }[];
		};
		expect(chatData.messages).toHaveLength(1);
		expect(chatData.messages[0]).toMatchObject({
			role: 'user',
			content: 'What should I pack?'
		});
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

test('anonymous callers cannot use the AI endpoint', async ({ request }) => {
	const response = await request.post('/api/chat', {
		data: {
			tripId: 'unknown',
			requestId: crypto.randomUUID(),
			messages: [{ role: 'user', content: 'Hello' }]
		}
	});
	expect(response.status()).toBe(401);
});
