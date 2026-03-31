// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
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
		// interface Platform {}
	}
}

export {};
