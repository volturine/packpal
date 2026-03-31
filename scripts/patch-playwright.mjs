#!/usr/bin/env node

/**
 * Patches Playwright's transform.js to skip the .esm.preflight import on Bun.
 *
 * Playwright v1.58+ uses Node's ESM loader hooks to transpile .ts files.
 * Bun doesn't support these hooks, so the preflight import fails with
 * "Cannot find module ... .esm.preflight". Playwright already detects Bun
 * in esmLoaderHost.js and skips loader registration, but the preflight
 * import in transform.js isn't guarded. This script adds that guard.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRANSFORM_PATH = resolve(process.cwd(), 'node_modules/playwright/lib/transform/transform.js');

const ORIGINAL = `await eval(\`import(\${JSON.stringify(fileName + ".esm.preflight")})\`).finally(nextTask);`;
const PATCHED = `if (!("Bun" in globalThis))\n      await eval(\`import(\${JSON.stringify(fileName + ".esm.preflight")})\`).finally(nextTask);`;

try {
	const content = readFileSync(TRANSFORM_PATH, 'utf-8');
	if (content.includes('"Bun" in globalThis')) {
		// Already patched
		process.exit(0);
	}
	if (!content.includes(ORIGINAL)) {
		console.warn(
			'[patch-playwright] Could not find target string — Playwright version may have changed.'
		);
		process.exit(0);
	}
	writeFileSync(TRANSFORM_PATH, content.replace(ORIGINAL, PATCHED));
	console.log('[patch-playwright] Patched transform.js for Bun compatibility.');
} catch (err) {
	console.warn('[patch-playwright] Skipping — playwright not installed or not accessible.', err);
}
