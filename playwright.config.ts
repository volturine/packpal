import { defineConfig } from '@playwright/test';

const TEST_PORT = 5199;
const TEST_DB_PATH = 'data/packpal-test.db';

export default defineConfig({
	globalSetup: './tests/global-setup.ts',
	testDir: './tests',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: `http://localhost:${TEST_PORT}`,
		trace: 'on-first-retry'
	},
	webServer: {
		command: `DATABASE_PATH=${TEST_DB_PATH} bun run dev -- --port ${TEST_PORT}`,
		url: `http://localhost:${TEST_PORT}`,
		reuseExistingServer: !process.env.CI,
		timeout: 30000,
		env: {
			DATABASE_PATH: TEST_DB_PATH
		}
	}
});
