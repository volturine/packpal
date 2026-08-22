import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(process.cwd());

export default defineConfig({
	envDir: workspaceRoot,
	plugins: [tailwindcss(), devtoolsJson(), sveltekit()],
	resolve: {
		alias: {
			'@': path.resolve('./src')
		}
	},
	server: {
		fs: {
			allow: [workspaceRoot]
		}
	},
	test: {
		include: ['src/**/*.test.ts'],
		alias: {
			'bun:sqlite': path.resolve('./scripts/bun-sqlite-shim.ts')
		},
		server: {
			deps: {
				inline: ['drizzle-orm/bun-sqlite']
			}
		}
	}
});
