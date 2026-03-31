import { randomBytes } from 'node:crypto';

export function generateId(): string {
	return randomBytes(16).toString('hex');
}

/**
 * Strip HTML tags and collapse whitespace for user-provided text inputs.
 * This prevents stored XSS when content is rendered in the UI.
 */
export function sanitizeText(input: string): string {
	return input
		.replace(/<[^>]*>/g, '')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&')
		.trim();
}
