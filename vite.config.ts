import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const workspaceRoot = path.resolve(process.cwd());

export default defineConfig({
	envDir: workspaceRoot,
	plugins: [tailwindcss(), devtoolsJson(), sveltekit()],
	build: {
		rolldownOptions: {
			checks: {
				// SvelteKit's compile hook necessarily owns most work in a cold application build.
				pluginTimings: false
			}
		}
	},
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
		include: ['src/**/*.test.ts']
	}
});
