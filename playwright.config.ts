import { defineConfig } from '@playwright/test';

const TEST_PORT = 5199;
const TEST_DB_PATH = 'data/packpal-test.db';
const TEST_HOST =
	process.platform === 'darwin' ? 'rolands-mac-mini.bee-justice.ts.net' : '127.0.0.1';
const TEST_ORIGIN = `http://${TEST_HOST}:${TEST_PORT}`;

export default defineConfig({
	globalSetup: './tests/global-setup.ts',
	testDir: './tests',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: 'list',
	use: {
		baseURL: TEST_ORIGIN,
		trace: 'on-first-retry'
	},
	webServer: {
		command: `npm run dev -- --host 0.0.0.0 --port ${TEST_PORT} --strictPort`,
		url: TEST_ORIGIN,
		reuseExistingServer: false,
		timeout: 30000,
		env: {
			DATABASE_PATH: TEST_DB_PATH,
			__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: TEST_HOST
		}
	}
});
