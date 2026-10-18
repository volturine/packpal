import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

const workspaceRoot = path.resolve(process.cwd());

// Modules whose Node implementation (better-sqlite3) cannot run on Workers.
// The Cloudflare build resolves them to their D1 counterparts instead.
const cloudflareModules = new Map([
	[path.resolve('./src/lib/server/db.ts'), path.resolve('./src/lib/server/cloudflare/db.ts')]
]);

const cloudflarePlatform: Plugin = {
	name: 'packpal-cloudflare-platform',
	enforce: 'pre',
	async resolveId(source, importer, options) {
		if (process.env.DEPLOY_TARGET !== 'cloudflare') return null;
		const resolved = await this.resolve(source, importer, options);
		return resolved ? (cloudflareModules.get(resolved.id) ?? null) : null;
	}
};

export default defineConfig({
	envDir: workspaceRoot,
	plugins: [cloudflarePlatform, tailwindcss(), devtoolsJson(), sveltekit()],
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
