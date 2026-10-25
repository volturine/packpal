import { defineEnvVars } from '@sveltejs/kit/env';

// Secrets and billing switches, read when the app starts (dynamic, not inlined).
// They stay optional at runtime — features degrade (AI/billing unavailable) rather
// than fail — so an identity validator marks each one as such. Consumers trim and
// default the raw values themselves.
const raw = (value: string | undefined) => value;

export const variables = defineEnvVars({
	OPENROUTER_API_KEY: { schema: raw },
	STRIPE_MODE: { schema: raw },
	STRIPE_SECRET_KEY: { schema: raw },
	STRIPE_WEBHOOK_SECRET: { schema: raw }
});
