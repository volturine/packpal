// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { D1Database, ExecutionContext } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// can customize this to be whatever u want
		interface Error {
			readonly message: string;
			readonly kind: string;
			readonly timestamp: number;
			readonly traceId?: string;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// Cloudflare Workers bindings from wrangler.jsonc; undefined under adapter-node.
		interface Platform {
			env: {
				PACKPAL_DB: D1Database;
			};
			context: ExecutionContext;
		}
	}
}

export {};
