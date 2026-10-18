export const BILLING_CURRENCY = 'usd';
export const AI_PRICE_MULTIPLIER = 2;
export const MIN_TOPUP_CENTS = 500;
export const MAX_TOPUP_CENTS = 10000;
export const AI_RESERVATION_MICRO_USD = 300_000;

/** WebCrypto UUIDs also work on the HTTP Tailscale development origin. */
export function createBillingRequestId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type CreditPurchaseStatus =
	'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'disputed';

export interface BillingSummary {
	mode: 'test' | 'live';
	currency: 'usd';
	priceMultiplier: number;
	minimumTopupCents: number;
	maximumTopupCents: number;
	reservationMicroUsd: number;
	checkoutEnabled: boolean;
	aiEnabled: boolean;
	balanceMicroUsd: number;
	heldMicroUsd: number;
	purchases: {
		status: CreditPurchaseStatus;
		id: string;
		amountCents: number;
		creditedMicroUsd: number;
		createdAt: number;
	}[];
	requests: {
		id: string;
		chargedMicroUsd: number | null;
		reservedMicroUsd: number;
		createdAt: number;
	}[];
}

export function formatCredit(microUsd: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: BILLING_CURRENCY,
		minimumFractionDigits: 2,
		maximumFractionDigits: 4
	}).format(microUsd / 1_000_000);
}
